/**
 * Mixly Lite All-in-One Server
 * Serves static frontend files + WebSocket backend for compile/upload/serial.
 * Also handles TFLite model upload and conversion to C++ header.
 *
 * Standalone usage:
 *   node server.js
 *
 * Embedded usage (e.g. from the AIoScout desktop app's Electron main process):
 *   const { createServer } = require('./server');
 *   const srv = createServer({ port: 0, dataDir: <writable>, resourceDir: <read-only> });
 *   await srv.ready;   // srv.port is now the actual port (0 = ephemeral)
 *   await srv.close();
 *
 * When forked as a child process with an IPC channel, the server reports its
 * port via process.send({ type: 'aioscout:ready', port }) once listening.
 *
 * Environment overrides (lowest precedence, options win):
 *   ARDUINO_CLI            path to the arduino-cli binary
 *   AIOSCOUT_RESOURCE_DIR  read-only root (frontend, SmartCar, Mixly_TFLite,
 *                          board-config.yaml, ESP32-P4-IMX219-PoC)
 *   AIOSCOUT_DATA_DIR      writable root (sketch_build, .build_output,
 *                          libraries, .model_uploads). Defaults to resourceDir.
 *   AIOSCOUT_MODEL_LIBRARY persistent named model library (userData/models in
 *                          the desktop app; each entry is a directory with
 *                          model.tflite + labels.txt + meta.json). Listed by
 *                          GET /models and usable as a compile-time model ref.
 *   P4_IMX219_LIB          path to the P4 IMX219 camera library
 */

'use strict';

const WebSocketServer = require('ws').Server;
const http = require('http');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execFile } = require('child_process');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const crypto = require('crypto');

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const WS_PATH = '/socket';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB — TFLite models for these demos are far smaller

// ── Option resolution ──────────────────────────────────────────
function resolveOptions(userOptions = {}) {
    const resourceDir = path.resolve(
        userOptions.resourceDir || process.env.AIOSCOUT_RESOURCE_DIR || __dirname
    );
    const dataDir = path.resolve(
        userOptions.dataDir || process.env.AIOSCOUT_DATA_DIR || resourceDir
    );
    return {
        port: userOptions.port ?? (process.env.AIOSCOUT_PORT ? parseInt(process.env.AIOSCOUT_PORT, 10) : DEFAULT_PORT),
        host: userOptions.host || process.env.AIOSCOUT_HOST || DEFAULT_HOST,
        arduinoCli: userOptions.arduinoCli || process.env.ARDUINO_CLI || 'arduino-cli',
        resourceDir,
        dataDir,
        staticRoot: path.resolve(userOptions.staticRoot || resourceDir),
        boardConfigPath: userOptions.boardConfigPath || path.join(resourceDir, 'board-config.yaml'),
        smartCarDir: userOptions.smartCarDir || path.join(resourceDir, 'SmartCar'),
        mixlyTfliteDir: userOptions.mixlyTfliteDir || path.join(resourceDir, 'Mixly_TFLite'),
        p4LibDir: userOptions.p4LibDir || process.env.P4_IMX219_LIB || path.join(resourceDir, 'ESP32-P4-IMX219-PoC'),
        modelLibraryDir: userOptions.modelLibraryDir || process.env.AIOSCOUT_MODEL_LIBRARY || null,
        onReady: userOptions.onReady || null,
    };
}

// ── Server factory ─────────────────────────────────────────────
function createServer(userOptions = {}) {
    const opts = resolveOptions(userOptions);

    // Writable runtime paths live under dataDir so the read-only resourceDir
    // (which may sit inside a packaged app bundle) is never written to.
    const SKETCH_DIR = path.join(opts.dataDir, 'sketch_build');
    const BUILD_DIR = path.join(opts.dataDir, '.build_output');
    const LIBRARIES_DIR = path.join(opts.dataDir, 'libraries');
    const MODEL_DIR = path.join(opts.dataDir, '.model_uploads');

    // ── State (per server instance) ────────────────────────────
    let currentProcess = null;
    const activeSerialPorts = new Map();
    const modelSessions = new Map(); // sessionId -> {tflitePath, labelsPath, createdAt}
    let BOARD_DEFAULTS = {};
    let configWatcher = null;
    let configReloadTimer = null;

    // ── Board config (board-config.yaml, hot-reloaded) ─────────
    function loadBoardDefaults() {
        try {
            const parsed = yaml.load(fs.readFileSync(opts.boardConfigPath, 'utf8')) || {};
            const normalized = {};
            for (const [board, boardOpts] of Object.entries(parsed)) {
                if (boardOpts && typeof boardOpts === 'object') {
                    normalized[board] = {};
                    for (const [k, v] of Object.entries(boardOpts)) normalized[board][k] = String(v);
                }
            }
            BOARD_DEFAULTS = normalized;
            const summary = Object.keys(BOARD_DEFAULTS)
                .map(b => `${b}={${Object.entries(BOARD_DEFAULTS[b]).map(([k, v]) => `${k}=${v}`).join(',')}}`)
                .join('  ');
            console.log(`[config] loaded board-config.yaml — ${summary}`);
        } catch (e) {
            if (e.code === 'ENOENT') {
                console.warn(`[config] board-config.yaml not found at ${opts.boardConfigPath}`);
            } else {
                // Keep the previous (last-good) defaults on parse error.
                console.error(`[config] failed to parse board-config.yaml (keeping previous defaults): ${e.message}`);
            }
        }
    }
    loadBoardDefaults();

    // Hot-reload: pick up edits to board-config.yaml without restarting the server.
    try {
        configWatcher = fs.watch(opts.boardConfigPath, () => {
            // Editors emit several events per save; debounce them.
            if (configReloadTimer) clearTimeout(configReloadTimer);
            configReloadTimer = setTimeout(loadBoardDefaults, 300);
        });
    } catch (e) {
        if (e.code !== 'ENOENT') console.warn('[config] could not watch board-config.yaml:', e.message);
    }

    // Append default options to a bare FQBN. If the FQBN already carries options
    // (user/IDE override), it is returned unchanged.
    function applyBoardDefaults(boardType) {
        if (!boardType || boardType.includes('=')) return boardType;
        const defaults = BOARD_DEFAULTS[boardType];
        if (!defaults) return boardType;
        const boardOpts = Object.entries(defaults).map(([k, v]) => `${k}=${v}`).join(',');
        return `${boardType}:${boardOpts}`;
    }

    // ── Helpers ────────────────────────────────────────────────
    function ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    function writeSketch(code) {
        ensureDir(SKETCH_DIR);
        // Auto-declare variables that are assigned but never declared
        // (Mixly's "set variable" block generates `var = val;` without a type,
        //  the user needs a separate "declare variable" block for the declaration)
        const assignedVars = new Set();
        const declaredVars = new Set();
        // Match variable assignments: `varname = ...;` (not ==, !=, <=, >=)
        const assignRe = /(?<![.\w])([a-zA-Z_]\w*)\s*=[^=]/g;
        let m;
        while ((m = assignRe.exec(code)) !== null) assignedVars.add(m[1]);
        // Match declarations: `int varname`, `volatile int varname`, `String varname`, etc.
        const declRe = /\b(?:volatile\s+)?(?:int|long|float|double|bool|boolean|char|String|uint\d+_t|int\d+_t|byte|unsigned|short)\s+(\w+)/g;
        while ((m = declRe.exec(code)) !== null) declaredVars.add(m[1]);
        // Match function params and for-loop vars
        const funcParamRe = /\((?:void\s*)?(?:[^)]*\s+)(\w+)[,\)]/g;
        while ((m = funcParamRe.exec(code)) !== null) declaredVars.add(m[1]);
        // Also exclude common keywords and functions
        const keywords = new Set(['setup','loop','return','if','else','while','for','switch','case',
            'delay','Serial','WiFi','true','false','NULL','nullptr','void','task_1','task_2']);
        const undeclared = [...assignedVars].filter(v => !declaredVars.has(v) && !keywords.has(v));
        if (undeclared.length > 0) {
            const declarations = undeclared.map(v => `int ${v};`).join('\n') + '\n';
            // Insert before the first function definition
            const firstFunc = code.search(/\n(?:void|int|bool|char|String|static)\s+\w+\s*\(/);
            if (firstFunc > 0) {
                code = code.slice(0, firstFunc) + '\n' + declarations + code.slice(firstFunc);
            } else {
                code = declarations + code;
            }
            console.log('[sketch] auto-declared variables:', undeclared.join(', '));
        }

        // Inject SmartCar discovery header so arduino-cli recognizes the library
        if (!code.includes('SmartCar.h')) {
            code = '#include <SmartCar.h>\n' + code;
        }

        const sketchPath = path.join(SKETCH_DIR, 'sketch_build.ino');
        fs.writeFileSync(sketchPath, code);
        // Install SmartCar as an Arduino library (so arduino-cli compiles the .cpp files)
        ensureDir(LIBRARIES_DIR);
        const destLib = path.join(LIBRARIES_DIR, 'SmartCar');
        if (fs.existsSync(destLib)) fs.rmSync(destLib, { recursive: true });
        fs.cpSync(opts.smartCarDir, destLib, { recursive: true });
        return sketchPath;
    }

    // ── Model Upload & TFLite Conversion ───────────────────────
    function generateSessionId() {
        return crypto.randomBytes(8).toString('hex');
    }

    function cleanupExpiredSessions() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        for (const [id, session] of modelSessions) {
            if (now - session.createdAt > maxAge) {
                const dir = path.dirname(session.tflitePath);
                fs.rmSync(dir, { recursive: true, force: true });
                modelSessions.delete(id);
            }
        }
    }

    function convertTfliteToHeader(modelBuffer, labelsText) {
        const hexBytes = [];
        for (let i = 0; i < modelBuffer.length; i++) {
            hexBytes.push('0x' + modelBuffer[i].toString(16).padStart(2, '0'));
        }

        // Format hex bytes into lines of 16
        const lines = [];
        for (let i = 0; i < hexBytes.length; i += 16) {
            lines.push('  ' + hexBytes.slice(i, i + 16).join(', '));
        }

        // Parse labels
        let labelsArray = '""';
        let labelsCount = 0;
        if (labelsText) {
            const labels = labelsText.trim().split('\n').map(l => JSON.stringify(l.trim())).filter(l => l !== '""');
            labelsArray = labels.join(', ');
            labelsCount = labels.length;
        }

        return `// Auto-generated by Mixly Lite server from uploaded .tflite model
#ifndef MODEL_DATA_H
#define MODEL_DATA_H
#include <cstdint>
const unsigned char g_model_data[] __attribute__((aligned(16))) = {
${lines.join(',\n')}
};
const unsigned int g_model_data_len = ${modelBuffer.length};
const char* const g_labels[] = {${labelsArray}};
const unsigned int g_labels_count = ${labelsCount};
#endif
`;
    }

    // ── Model library (persistent, owned by the desktop app) ───
    // A model ref is either a library entry id (preferred — durable across
    // restarts) or a legacy ephemeral upload session id (FieldFileUpload).
    function resolveModelRef(ref) {
        if (typeof ref === 'string' && ref && opts.modelLibraryDir && /^[A-Za-z0-9._-]+$/.test(ref)) {
            const dir = path.join(opts.modelLibraryDir, ref);
            const tflitePath = path.join(dir, 'model.tflite');
            if (fs.existsSync(tflitePath)) {
                const labelsPath = path.join(dir, 'labels.txt');
                return { tflitePath, labelsPath: fs.existsSync(labelsPath) ? labelsPath : null };
            }
        }
        const session = modelSessions.get(ref);
        if (session) return { tflitePath: session.tflitePath, labelsPath: session.labelsPath };
        return null;
    }

    function listLibraryModels() {
        if (!opts.modelLibraryDir || !fs.existsSync(opts.modelLibraryDir)) return [];
        const models = [];
        for (const name of fs.readdirSync(opts.modelLibraryDir)) {
            const dir = path.join(opts.modelLibraryDir, name);
            const tflitePath = path.join(dir, 'model.tflite');
            if (!fs.existsSync(tflitePath)) continue;
            let meta = {};
            try {
                meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) || {};
            } catch { /* tolerate missing/corrupt meta */ }
            let labels = Array.isArray(meta.labels) ? meta.labels : [];
            if (!labels.length) {
                try { labels = fs.readFileSync(path.join(dir, 'labels.txt'), 'utf8').split('\n').map(s => s.trim()).filter(Boolean); } catch { /* none */ }
            }
            models.push({
                id: name,
                name: String(meta.name || name),
                createdAt: Number(meta.createdAt) || fs.statSync(tflitePath).birthtimeMs || 0,
                labels,
                sizeBytes: fs.statSync(tflitePath).size
            });
        }
        models.sort((a, b) => b.createdAt - a.createdAt);
        return models;
    }

    function deployMixlyTFLiteLib(modelRef) {
        // Copy Mixly_TFLite library to libraries/
        const destLib = path.join(LIBRARIES_DIR, 'Mixly_TFLite');
        if (fs.existsSync(destLib)) fs.rmSync(destLib, { recursive: true });
        fs.cpSync(opts.mixlyTfliteDir, destLib, { recursive: true });

        // If a model ref is provided, generate model_data.h
        if (modelRef) {
            const resolved = resolveModelRef(modelRef);
            if (!resolved) {
                // Fail loudly: compiling against the empty placeholder model would
                // silently produce a sketch that classifies nothing.
                throw new Error(`Unknown model: ${modelRef}. Pick a model from the AI Vision blocks or re-upload it.`);
            }

            const modelBuffer = fs.readFileSync(resolved.tflitePath);
            let labelsText = '';
            if (resolved.labelsPath && fs.existsSync(resolved.labelsPath)) {
                labelsText = fs.readFileSync(resolved.labelsPath, 'utf-8');
            }

            const headerContent = convertTfliteToHeader(modelBuffer, labelsText);
            const headerPath = path.join(destLib, 'src', 'Mixly_TFLite', 'model_data.h');
            fs.writeFileSync(headerPath, headerContent);

            console.log(`[tflite] Generated model_data.h (${modelBuffer.length} bytes, ${labelsText ? labelsText.trim().split('\n').length : 0} labels)`);
        }
    }

    function ensureTFLiteLibInstalled(callback) {
        // The esp32 3.x core BUNDLES TFLiteMicro (packages/esp32/hardware/
        // esp32/<ver>/libraries/TFLiteMicro) — that's what Mixly_TFLite's
        // tensorflow/lite/... includes resolve against. The older
        // `lib install TensorFlowLiteESP32` step always failed (no such
        // library in the index), so just verify the core is present.
        execFile(opts.arduinoCli, ['core', 'list'], (error, stdout) => {
            if (error || !stdout || !/esp32:esp32\s/.test(stdout)) {
                console.error('[tflite] esp32 core not installed — run: arduino-cli core install esp32:esp32');
            }
            callback();
        });
    }

    // ── ESP32-P4 Board Support ─────────────────────────────────
    function isP4Board(boardType) {
        return boardType && boardType.includes('esp32p4');
    }

    function deployP4IMX219Lib() {
        // Copy P4 IMX219 camera library to libraries/ if it exists
        if (!fs.existsSync(opts.p4LibDir)) {
            console.log('[p4] IMX219 library not found at', opts.p4LibDir, '(skipping)');
            return;
        }
        const destLib = path.join(LIBRARIES_DIR, 'ESP32_P4_IMX219');
        if (fs.existsSync(destLib)) fs.rmSync(destLib, { recursive: true });
        fs.cpSync(opts.p4LibDir, destLib, { recursive: true });
        console.log('[p4] Deployed IMX219 camera library');
    }

    // ── HTTP: model upload ─────────────────────────────────────
    function parseMultipart(req) {
        return new Promise((resolve, reject) => {
            const boundary = req.headers['content-type']?.match(/boundary=(.+)/)?.[1];
            if (!boundary) { reject(new Error('No boundary')); return; }

            const declared = parseInt(req.headers['content-length'] || '0', 10);
            if (declared > MAX_UPLOAD_BYTES) { reject(new Error('Upload too large (max 20 MB)')); return; }

            const chunks = [];
            let received = 0;
            req.on('data', c => {
                received += c.length;
                if (received > MAX_UPLOAD_BYTES) {
                    reject(new Error('Upload too large (max 20 MB)'));
                    req.destroy();
                    return;
                }
                chunks.push(c);
            });
            req.on('end', () => {
                const body = Buffer.concat(chunks);
                const boundaryBuf = Buffer.from('--' + boundary);
                const parts = {};

                let start = 0;
                while (true) {
                    const boundaryStart = body.indexOf(boundaryBuf, start);
                    if (boundaryStart === -1) break;
                    const nextBoundary = body.indexOf(boundaryBuf, boundaryStart + boundaryBuf.length);
                    if (nextBoundary === -1) break;

                    const partData = body.slice(boundaryStart + boundaryBuf.length, nextBoundary);
                    // Separate headers from body
                    const headerEnd = partData.indexOf('\r\n\r\n');
                    if (headerEnd === -1) { start = nextBoundary; continue; }

                    const headers = partData.slice(0, headerEnd).toString();
                    const bodyBuf = partData.slice(headerEnd + 4);
                    // Trim trailing \r\n
                    const trimmed = bodyBuf.length >= 2 && bodyBuf[bodyBuf.length - 2] === 0x0d && bodyBuf[bodyBuf.length - 1] === 0x0a
                        ? bodyBuf.slice(0, -2) : bodyBuf;

                    const nameMatch = headers.match(/name="([^"]+)"/);
                    if (nameMatch) {
                        parts[nameMatch[1]] = trimmed;
                    }

                    start = nextBoundary;
                }
                resolve(parts);
            });
            req.on('error', reject);
        });
    }

    function handleModelUpload(req, res) {
        parseMultipart(req).then(parts => {
            const modelData = parts['model'];
            const labelsData = parts['labels'];

            if (!modelData || modelData.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No model file provided' }));
                return;
            }

            cleanupExpiredSessions();

            const sessionId = generateSessionId();
            const sessionDir = path.join(MODEL_DIR, sessionId);
            ensureDir(sessionDir);

            const tflitePath = path.join(sessionDir, 'model.tflite');
            fs.writeFileSync(tflitePath, modelData);

            let labelsPath = null;
            if (labelsData && labelsData.length > 0) {
                labelsPath = path.join(sessionDir, 'labels.txt');
                fs.writeFileSync(labelsPath, labelsData);
            }

            modelSessions.set(sessionId, { tflitePath, labelsPath, createdAt: Date.now() });

            console.log(`[tflite] Model uploaded: session=${sessionId}, size=${modelData.length} bytes`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessionId }));
        }).catch(err => {
            console.error('[tflite] Upload error:', err.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
    }

    // ── WebSocket command plumbing ─────────────────────────────
    function sendCommand(ws, obj, func, args) {
        if (ws.readyState !== 1) return;
        ws.send(JSON.stringify({
            obj,
            func,
            args: args.map(a => encodeURIComponent(String(a)))
        }));
    }

    function runArduinoCLI(ws, cliArgs, layerNum, type) {
        console.log(`[cli] ${opts.arduinoCli} ${cliArgs.join(' ')}`);
        currentProcess = execFile(opts.arduinoCli, cliArgs, {
            env: { ...process.env, LANG: 'en_US.UTF-8' },
            maxBuffer: 10 * 1024 * 1024
        }, (error, stdout, stderr) => {
            currentProcess = null;
            const output = (stdout || '') + (stderr || '');

            if (error) {
                sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'addValue', [output]);
                sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'operateEndError', [type, layerNum, '']);
            } else {
                sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'addValue', [output]);
                sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'operateSuccess', [type, layerNum, '', '115200', '0s']);
            }
        });

        // Stream output in real-time
        const stream = (data) => {
            const chunk = data.toString();
            if (!currentProcess) return;
            sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'addValue', [chunk]);
        };
        currentProcess.stdout?.on('data', stream);
        currentProcess.stderr?.on('data', stream);
    }

    // ── Command Handlers ───────────────────────────────────────
    function handleCompile(ws, args) {
        const [layerNum, boardType, code, modelSessionId] = args.map(a => decodeURIComponent(a));
        console.log(`[compile] board=${boardType} model=${modelSessionId || 'none'}`);

        const useTFLite = code.includes('Mixly_TFLite');

        const doCompile = () => {
            const sketchPath = writeSketch(code);
            if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
            ensureDir(BUILD_DIR);

            if (useTFLite || modelSessionId) {
                try {
                    deployMixlyTFLiteLib(modelSessionId || null);
                } catch (e) {
                    console.error('[tflite] deploy failed:', e.message);
                    sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'addValue', [`[Error] ${e.message}\n`]);
                    sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'operateEndError', ['compile', layerNum, '']);
                    return;
                }
            }

            // Deploy P4 IMX219 camera library when compiling for ESP32-P4
            if (isP4Board(boardType)) {
                deployP4IMX219Lib();
            }

            runArduinoCLI(ws, [
                'compile', '-b', applyBoardDefaults(boardType),
                '--build-path', BUILD_DIR, '--libraries', LIBRARIES_DIR,
                '--verbose', sketchPath, '--no-color'
            ], layerNum, 'compile');
        };

        // If TFLite blocks are used, ensure the TFLM library is installed
        if (useTFLite) {
            ensureTFLiteLibInstalled(doCompile);
        } else {
            doCompile();
        }
    }

    function handleUpload(ws, args) {
        const [layerNum, boardType, port, code, modelSessionId] = args.map(a => decodeURIComponent(a));
        console.log(`[upload] board=${boardType} port=${port} model=${modelSessionId || 'none'}`);

        if (!port || port === 'null' || port === 'undefined') {
            sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'operateEndError',
                ['upload', layerNum, 'Error: No serial port selected']);
            return;
        }

        const useTFLite = code.includes('Mixly_TFLite');

        const doUpload = () => {
            const sketchPath = writeSketch(code);
            if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
            ensureDir(BUILD_DIR);

            if (useTFLite || modelSessionId) {
                try {
                    deployMixlyTFLiteLib(modelSessionId || null);
                } catch (e) {
                    console.error('[tflite] deploy failed:', e.message);
                    sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'addValue', [`[Error] ${e.message}\n`]);
                    sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'operateEndError', ['upload', layerNum, '']);
                    return;
                }
            }

            // Deploy P4 IMX219 camera library when compiling for ESP32-P4
            if (isP4Board(boardType)) {
                deployP4IMX219Lib();
            }

            runArduinoCLI(ws, [
                'compile', '-b', applyBoardDefaults(boardType),
                '--build-path', BUILD_DIR, '--libraries', LIBRARIES_DIR,
                '--upload', '-p', port,
                '--verbose', sketchPath, '--no-color'
            ], layerNum, 'upload');
        };

        if (useTFLite) {
            ensureTFLiteLibInstalled(doUpload);
        } else {
            doUpload();
        }
    }

    function handleCancel() {
        if (currentProcess) {
            console.log('[cancel]');
            currentProcess.kill('SIGTERM');
            currentProcess = null;
        }
    }

    // ── Serial Port ────────────────────────────────────────────
    async function handleListPorts(ws) {
        try {
            const ports = await SerialPort.list();
            sendCommand(ws, 'Mixly.WebSocket.Serial', 'setPorts', [JSON.stringify(ports)]);
        } catch (e) {
            console.error('[serial] list error:', e.message);
        }
    }

    function handleSerialOpen(ws, args) {
        const [portName, baudRate] = args.map(a => decodeURIComponent(a));
        console.log(`[serial] open ${portName} @ ${baudRate}`);
        if (activeSerialPorts.has(portName)) return;

        try {
            const sp = new SerialPort({ path: portName, baudRate: parseInt(baudRate) || 115200 });
            const parser = sp.pipe(new ReadlineParser());

            parser.on('data', (line) => {
                sendCommand(ws, 'Mixly.WebSocket.Serial', 'addValue', [portName, line + '\n']);
            });

            sp.on('close', () => { activeSerialPorts.delete(portName); });
            sp.on('error', () => { activeSerialPorts.delete(portName); });

            activeSerialPorts.set(portName, { serialPort: sp, ws });
        } catch (e) {
            console.error('[serial] open error:', e.message);
        }
    }

    function handleSerialClose(ws, args) {
        const [portName] = args.map(a => decodeURIComponent(a));
        const entry = activeSerialPorts.get(portName);
        if (entry) { entry.serialPort.close(); activeSerialPorts.delete(portName); }
    }

    function handleSerialWrite(ws, args) {
        const [portName, data] = args.map(a => decodeURIComponent(a));
        const entry = activeSerialPorts.get(portName);
        if (entry) entry.serialPort.write(data);
    }

    // ── HTTP Static Server ─────────────────────────────────────
    const MIME = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.xml': 'text/xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
        '.ttf': 'font/ttf', '.map': 'application/json',
    };

    const httpServer = http.createServer((req, res) => {
        let urlPath = req.url.split('?')[0];
        if (urlPath === '/') urlPath = '/index.html';

        // Health probe for supervisors (Electron service manager, container checks)
        if (urlPath === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, port: handle.port }));
            return;
        }

        // Persistent model library listing (consumed by the AI Vision blocks'
        // model picker dropdown; same-origin so no CORS concerns)
        if (urlPath === '/models') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ models: listLibraryModels() }));
            return;
        }

        // Handle model upload
        if (req.method === 'POST' && urlPath === '/upload-model') {
            handleModelUpload(req, res);
            return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405);
            res.end('Method Not Allowed');
            return;
        }

        // Resolve the file inside staticRoot, rejecting any path that escapes it
        // (raw "..", encoded %2e%2e, absolute paths, null bytes).
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(urlPath);
        } catch {
            res.writeHead(400);
            res.end('Bad Request');
            return;
        }
        if (decodedPath.includes('\0')) {
            res.writeHead(400);
            res.end('Bad Request');
            return;
        }
        const root = opts.staticRoot + path.sep;
        const filePath = path.normalize(path.join(opts.staticRoot, decodedPath));
        if (filePath !== opts.staticRoot && !filePath.startsWith(root)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            res.end(data);
        });
    });

    // ── WebSocket Server (on same port) ────────────────────────
    const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

    wss.on('connection', (ws) => {
        console.log('[ws] client connected');
        // Note: Don't send updateSelectedBoardConfig here — Mixly's internal
        // WebSocket handler tries to call replaceAll on args and crashes in web mode.
        // The smartcar-plugin.js handles its own compile/upload flow instead.

        ws.on('message', (raw) => {
            const msg = raw.toString();
            if (msg === 'HeartBeat') return;

            try {
                const command = JSON.parse(msg);
                const { obj, func, args = [] } = command;
                const decodedArgs = args.map(a => {
                    try { return decodeURIComponent(a); } catch { return a; }
                });
                console.log(`[ws] ${obj}.${func}()`);

                if (obj === 'ArduShell') {
                    switch (func) {
                        case 'compile': handleCompile(ws, args); break;
                        case 'upload':  handleUpload(ws, args); break;
                        case 'cancel':  handleCancel(); break;
                    }
                } else if (obj === 'Serial') {
                    switch (func) {
                        case 'list':   handleListPorts(ws); break;
                        case 'open':   handleSerialOpen(ws, args); break;
                        case 'close':  handleSerialClose(ws, args); break;
                        case 'write':  handleSerialWrite(ws, args); break;
                    }
                }
            } catch (e) {
                console.error('[ws] error:', e.message);
            }
        });

        ws.on('close', () => {
            console.log('[ws] client disconnected');
            for (const [name, entry] of activeSerialPorts) {
                if (entry.ws === ws) { entry.serialPort.close(); activeSerialPorts.delete(name); }
            }
        });
    });

    // ── Handle ─────────────────────────────────────────────────
    const handle = {
        options: opts,
        httpServer,
        wss,
        port: null,
        ready: new Promise((resolve, reject) => {
            httpServer.once('error', reject);
            httpServer.listen(opts.port, opts.host, () => {
                handle.port = httpServer.address().port;
                printBanner();
                try {
                    opts.onReady?.(handle.port);
                } catch (e) {
                    console.error('[server] onReady callback failed:', e.message);
                }
                try {
                    // Report to the parent process when forked with an IPC channel
                    if (process.send) process.send({ type: 'aioscout:ready', port: handle.port });
                } catch { /* IPC channel closed — ignore */ }
                resolve(handle);
            });
        }),
        close() {
            return new Promise((resolve) => {
                if (currentProcess) {
                    try { currentProcess.kill('SIGTERM'); } catch { /* already gone */ }
                    currentProcess = null;
                }
                for (const [, entry] of activeSerialPorts) {
                    try { entry.serialPort.close(); } catch { /* already closed */ }
                }
                activeSerialPorts.clear();
                if (configWatcher) { configWatcher.close(); configWatcher = null; }
                if (configReloadTimer) { clearTimeout(configReloadTimer); configReloadTimer = null; }
                wss.close();
                httpServer.close(() => resolve());
                // In case lingering WS keep the HTTP server from closing
                for (const client of wss.clients) {
                    try { client.terminate(); } catch { /* ignore */ }
                }
            });
        }
    };

    function printBanner() {
        console.log('');
        console.log('  ========================================');
        console.log('    Mixly Lite (SmartCar Edition)');
        console.log('  ========================================');
        console.log(`    Frontend + WebSocket:  http://${opts.host}:${handle.port}`);
        console.log(`    arduino-cli:           ${opts.arduinoCli}`);
        console.log(`    Static root:           ${opts.staticRoot}`);
        console.log(`    Data dir:              ${opts.dataDir}`);
        console.log(`    SmartCar library:      ${opts.smartCarDir}`);
        console.log(`    Mixly_TFLite library:  ${opts.mixlyTfliteDir}`);
        console.log(`    P4 IMX219 library:     ${opts.p4LibDir}`);
        console.log('');
    }

    return handle;
}

module.exports = { createServer };

// ── Standalone entry (node server.js, or forked as a child) ────
if (require.main === module) {
    const server = createServer({});
    server.ready.catch(err => {
        console.error('[server] failed to start:', err.message);
        process.exit(1);
    });

    const shutdown = (signal) => {
        console.log(`[server] ${signal} received, shutting down...`);
        server.close().then(() => process.exit(0));
        // Don't hang forever if something refuses to close
        setTimeout(() => process.exit(0), 3000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
