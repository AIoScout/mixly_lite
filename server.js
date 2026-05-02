/**
 * Mixly Lite All-in-One Server
 * Serves static frontend files + WebSocket backend for compile/upload/serial.
 * Also handles TFLite model upload and conversion to C++ header.
 *
 * Usage: node server.js
 */

const WebSocketServer = require('ws').Server;
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const crypto = require('crypto');

// ── Configuration ──────────────────────────────────────────────
const PORT = 3000;
const WS_PATH = '/socket';
const ARDUINO_CLI = process.env.ARDUINO_CLI || 'arduino-cli';
const PROJECT_ROOT = path.resolve(__dirname);
const SKETCH_DIR = path.join(PROJECT_ROOT, 'sketch_build');
const SMARTCAR_LIB = path.join(PROJECT_ROOT, 'SmartCar');
const MIXLY_TFLITE_LIB = path.join(PROJECT_ROOT, 'Mixly_TFLite');
const LIBRARIES_DIR = path.join(PROJECT_ROOT, 'libraries');
const MODEL_DIR = path.join(PROJECT_ROOT, '.model_uploads');

// ── MIME types ─────────────────────────────────────────────────
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.xml': 'text/xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.ttf': 'font/ttf', '.map': 'application/json',
};

// ── State ──────────────────────────────────────────────────────
let currentProcess = null;
const activeSerialPorts = new Map();
const modelSessions = new Map(); // sessionId -> {tflitePath, labelsPath, createdAt}

// ── Helpers ────────────────────────────────────────────────────
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
    fs.cpSync(SMARTCAR_LIB, destLib, { recursive: true });
    return sketchPath;
}

// ── Model Upload & TFLite Conversion ───────────────────────────
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

function deployMixlyTFLiteLib(modelSessionId) {
    // Copy Mixly_TFLite library to libraries/
    const destLib = path.join(LIBRARIES_DIR, 'Mixly_TFLite');
    if (fs.existsSync(destLib)) fs.rmSync(destLib, { recursive: true });
    fs.cpSync(MIXLY_TFLITE_LIB, destLib, { recursive: true });

    // If model session provided, generate model_data.h
    if (modelSessionId) {
        const session = modelSessions.get(modelSessionId);
        if (!session) {
            console.error('[tflite] Invalid model session:', modelSessionId);
            return;
        }

        const modelBuffer = fs.readFileSync(session.tflitePath);
        let labelsText = '';
        if (session.labelsPath && fs.existsSync(session.labelsPath)) {
            labelsText = fs.readFileSync(session.labelsPath, 'utf-8');
        }

        const headerContent = convertTfliteToHeader(modelBuffer, labelsText);
        const headerPath = path.join(destLib, 'src', 'Mixly_TFLite', 'model_data.h');
        fs.writeFileSync(headerPath, headerContent);

        console.log(`[tflite] Generated model_data.h (${modelBuffer.length} bytes, ${labelsText ? labelsText.trim().split('\\n').length : 0} labels)`);
    }
}

function ensureTFLiteLibInstalled(callback) {
    // Check if TensorFlowLiteESP32 is already installed
    execFile(ARDUINO_CLI, ['lib', 'list'], (error, stdout) => {
        if (stdout && stdout.includes('TensorFlowLiteESP32')) {
            callback();
            return;
        }
        console.log('[tflite] Installing TensorFlowLiteESP32 library...');
        execFile(ARDUINO_CLI, ['lib', 'install', 'TensorFlowLiteESP32'], (installErr) => {
            if (installErr) {
                console.error('[tflite] Failed to install TensorFlowLiteESP32:', installErr.message);
            } else {
                console.log('[tflite] TensorFlowLiteESP32 installed');
            }
            callback();
        });
    });
}

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const boundary = req.headers['content-type']?.match(/boundary=(.+)/)?.[1];
        if (!boundary) { reject(new Error('No boundary')); return; }

        const chunks = [];
        req.on('data', c => chunks.push(c));
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

function sendCommand(ws, obj, func, args) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({
        obj,
        func,
        args: args.map(a => encodeURIComponent(String(a)))
    }));
}

function runArduinoCLI(ws, cliArgs, layerNum, type) {
    console.log(`[cli] ${ARDUINO_CLI} ${cliArgs.join(' ')}`);
    currentProcess = execFile(ARDUINO_CLI, cliArgs, {
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

// ── Command Handlers ───────────────────────────────────────────
function handleCompile(ws, args) {
    const [layerNum, boardType, code, modelSessionId] = args.map(a => decodeURIComponent(a));
    console.log(`[compile] board=${boardType} model=${modelSessionId || 'none'}`);

    const useTFLite = code.includes('Mixly_TFLite');

    const doCompile = () => {
        const sketchPath = writeSketch(code);
        const buildPath = path.join(PROJECT_ROOT, '.build_output');
        if (fs.existsSync(buildPath)) fs.rmSync(buildPath, { recursive: true, force: true });
        ensureDir(buildPath);

        if (useTFLite || modelSessionId) {
            deployMixlyTFLiteLib(modelSessionId || null);
        }

        runArduinoCLI(ws, [
            'compile', '-b', boardType,
            '--build-path', buildPath, '--libraries', LIBRARIES_DIR,
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
        const buildPath = path.join(PROJECT_ROOT, '.build_output');
        if (fs.existsSync(buildPath)) fs.rmSync(buildPath, { recursive: true, force: true });
        ensureDir(buildPath);

        if (useTFLite || modelSessionId) {
            deployMixlyTFLiteLib(modelSessionId || null);
        }

        runArduinoCLI(ws, [
            'compile', '-b', boardType,
            '--build-path', buildPath, '--libraries', LIBRARIES_DIR,
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

// ── Serial Port ────────────────────────────────────────────────
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

// ── HTTP Static Server ─────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    // Handle model upload
    if (req.method === 'POST' && urlPath === '/upload-model') {
        handleModelUpload(req, res);
        return;
    }

    const filePath = path.join(PROJECT_ROOT, urlPath);
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

// ── WebSocket Server (on same port) ────────────────────────────
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

// ── Start ──────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log('');
    console.log('  ========================================');
    console.log('    Mixly Lite (SmartCar Edition)');
    console.log('  ========================================');
    console.log(`    Frontend + WebSocket:  http://localhost:${PORT}`);
    console.log(`    arduino-cli:           ${ARDUINO_CLI}`);
    console.log(`    SmartCar library:      ${SMARTCAR_LIB}`);
    console.log(`    Mixly_TFLite library:  ${MIXLY_TFLITE_LIB}`);
    console.log('');
    console.log('    Open http://localhost:3000 in your browser');
    console.log('');
});
