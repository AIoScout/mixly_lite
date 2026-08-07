/**
 * Mixly Lite All-in-One Server
 * Serves static frontend files + WebSocket backend for compile/upload/serial.
 *
 * Usage: node server.js
 */

const WebSocketServer = require('ws').Server;
const http = require('http');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execFile } = require('child_process');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// ── Configuration ──────────────────────────────────────────────
const PORT = 3000;
const WS_PATH = '/socket';
const ARDUINO_CLI = process.env.ARDUINO_CLI || 'arduino-cli';
const PROJECT_ROOT = path.resolve(__dirname);
const SKETCH_DIR = path.join(PROJECT_ROOT, 'sketch_build');
const SMARTCAR_LIB = path.join(PROJECT_ROOT, 'SmartCar');
const LIBRARIES_DIR = path.join(PROJECT_ROOT, 'libraries');

// Per-board default options loaded from board-config.yaml (see that file for
// details). Reloaded automatically on file change — no restart required.
const BOARD_CONFIG_PATH = path.join(PROJECT_ROOT, 'board-config.yaml');
let BOARD_DEFAULTS = {};

function loadBoardDefaults() {
    try {
        const parsed = yaml.load(fs.readFileSync(BOARD_CONFIG_PATH, 'utf8')) || {};
        const normalized = {};
        for (const [board, opts] of Object.entries(parsed)) {
            if (opts && typeof opts === 'object') {
                normalized[board] = {};
                for (const [k, v] of Object.entries(opts)) normalized[board][k] = String(v);
            }
        }
        BOARD_DEFAULTS = normalized;
        const summary = Object.keys(BOARD_DEFAULTS)
            .map(b => `${b}={${Object.entries(BOARD_DEFAULTS[b]).map(([k, v]) => `${k}=${v}`).join(',')}}`)
            .join('  ');
        console.log(`[config] loaded board-config.yaml — ${summary}`);
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.warn(`[config] board-config.yaml not found at ${BOARD_CONFIG_PATH}`);
        } else {
            // Keep the previous (last-good) defaults on parse error.
            console.error(`[config] failed to parse board-config.yaml (keeping previous defaults): ${e.message}`);
        }
    }
}
loadBoardDefaults();

// Hot-reload: pick up edits to board-config.yaml without restarting the server.
let configReloadTimer = null;
try {
    fs.watch(BOARD_CONFIG_PATH, () => {
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
    const opts = Object.entries(defaults).map(([k, v]) => `${k}=${v}`).join(',');
    return `${boardType}:${opts}`;
}

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
    let streamed = '';
    const stream = (data) => {
        const chunk = data.toString();
        // Avoid duplicate output - only stream what hasn't been sent
        if (!currentProcess) return;
        sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'addValue', [chunk]);
    };
    currentProcess.stdout?.on('data', stream);
    currentProcess.stderr?.on('data', stream);
}

// ── Command Handlers ───────────────────────────────────────────
function handleCompile(ws, args) {
    const [layerNum, boardType, code] = args.map(a => decodeURIComponent(a));
    console.log(`[compile] board=${boardType}`);
    const sketchPath = writeSketch(code);
    const buildPath = path.join(PROJECT_ROOT, '.build_output');
    if (fs.existsSync(buildPath)) fs.rmSync(buildPath, { recursive: true, force: true });
    ensureDir(buildPath);

    runArduinoCLI(ws, [
        'compile', '-b', applyBoardDefaults(boardType),
        '--build-path', buildPath, '--libraries', LIBRARIES_DIR,
        '--verbose', sketchPath, '--no-color'
    ], layerNum, 'compile');
}

function handleUpload(ws, args) {
    const [layerNum, boardType, port, code] = args.map(a => decodeURIComponent(a));
    console.log(`[upload] board=${boardType} port=${port}`);

    if (!port || port === 'null' || port === 'undefined') {
        sendCommand(ws, 'Mixly.WebSocket.ArduShell', 'operateEndError',
            ['upload', layerNum, 'Error: No serial port selected']);
        return;
    }

    const sketchPath = writeSketch(code);
    const buildPath = path.join(PROJECT_ROOT, '.build_output');
    if (fs.existsSync(buildPath)) fs.rmSync(buildPath, { recursive: true, force: true });
    ensureDir(buildPath);

    runArduinoCLI(ws, [
        'compile', '-b', applyBoardDefaults(boardType),
        '--build-path', buildPath, '--libraries', LIBRARIES_DIR,
        '--upload', '-p', port,
        '--verbose', sketchPath, '--no-color'
    ], layerNum, 'upload');
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
    console.log('');
    console.log('    Open http://localhost:3000 in your browser');
    console.log('');
});
