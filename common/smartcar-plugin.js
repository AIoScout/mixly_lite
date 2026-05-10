/**
 * Mixly Lite SmartCar Plugin
 * Injects compile/upload buttons and connects to WebSocket backend.
 * Loaded via <script> tag in index.html.
 */
(function() {
    const WS_URL = `ws://${location.hostname}:${location.port}/socket`;
    let ws = null;
    let connected = false;
    const pendingMessages = [];

    // ── WebSocket ────────────────────────────────────────────
    function connectWS() {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
            console.log('[SmartCar] WebSocket connected');
            connected = true;
            updateStatus('Connected', true);
            // Send pending messages
            while (pendingMessages.length > 0) {
                ws.send(pendingMessages.shift());
            }
            // Request real port list from server
            refreshRealPorts();
        };
        ws.onmessage = (event) => {
            const msg = event.data;
            if (msg === 'HeartBeat') return;
            try {
                const cmd = JSON.parse(msg);
                const decoded = decodeCommand(cmd);
                handleResponse(decoded);
            } catch(e) {}
        };
        ws.onclose = () => {
            connected = false;
            updateStatus('Disconnected', false);
            setTimeout(connectWS, 3000);
        };
        ws.onerror = () => {};
    }

    function sendCommand(obj, func, args) {
        const encoded = {
            obj,
            func,
            args: args.map(a => encodeURIComponent(String(a)))
        };
        const msg = JSON.stringify(encoded);
        if (connected) {
            ws.send(msg);
        } else {
            pendingMessages.push(msg);
        }
    }

    function decodeCommand(cmd) {
        if (!cmd || !cmd.args) return cmd;
        return {
            ...cmd,
            args: cmd.args.map(a => {
                try { return decodeURIComponent(a); } catch { return a; }
            })
        };
    }

    // ── Output Terminal ──────────────────────────────────────
    function getTerminal() {
        try {
            const tabs = Mixly.mainStatusBarTabs;
            if (!tabs) return null;
            return tabs.getStatusBarById('output');
        } catch { return null; }
    }

    function output(text) {
        const term = getTerminal();
        if (term) term.addValue(text);
        else console.log('[SmartCar]', text);
    }

    function showOutput() {
        try {
            const tabs = Mixly.mainStatusBarTabs;
            if (tabs) { tabs.show(); tabs.changeTo('output'); }
        } catch {}
    }

    // ── Response Handler ─────────────────────────────────────
    let currentLayerNum = null;

    function handleResponse(cmd) {
        if (!cmd) return;
        const { obj, func, args = [] } = cmd;

        if (obj === 'Mixly.WebSocket.Serial' && func === 'setPorts') {
            handleSerialPorts(cmd);
        } else if (func === 'addValue' && args.length >= 1) {
            output(args[0]);
        } else if (func === 'operateSuccess') {
            hideLoader();
            const type = args[0];
            const msg = type === 'compile' ? 'Compile succeeded' : 'Upload succeeded';
            output('\n==' + msg + '==\n');
        } else if (func === 'operateEndError') {
            hideLoader();
            const type = args[0];
            const msg = type === 'compile' ? 'Compile failed' : 'Upload failed';
            output('\n==' + msg + '==\n');
        } else if (func === 'operateOnError') {
            if (args[2]) output(args[2]);
        }
    }

    // ── Get Code from Blockly ────────────────────────────────
    function getCode() {
        try {
            // Try to get code from the code editor
            const workspace = Mixly.Workspace.getMain();
            const editorsManager = workspace.getEditorsManager();
            const editor = editorsManager.getActive();
            if (editor && editor.getCode) return editor.getCode();
            // Fallback: generate from blocks
            const blockEditor = editorsManager.getEditorByType('blockly');
            if (blockEditor && blockEditor.getCode) return blockEditor.getCode();
        } catch(e) {
            console.error('[SmartCar] getCode error:', e);
        }
        return '';
    }

    function getBoardType() {
        try {
            return Mixly.Boards.getSelectedBoardCommandParam();
        } catch { return 'esp32:esp32:esp32'; }
    }

    // ── Real Serial Port Selection ──────────────────────────
    // The Mixly #ports-type dropdown uses Web Serial API synthetic names
    // like "serial1" which are NOT valid arduino-cli port paths.
    // Instead, query the server's SerialPort.list() which returns real
    // OS-level paths (/dev/cu.usbserial-xxx, COM3, etc.).

    let realPorts = [];
    let selectedRealPort = null;

    async function refreshRealPorts() {
        try {
            sendCommand('Serial', 'list', []);
            // Response arrives via handleResponse -> handleSerialPorts
        } catch (e) {
            console.error('[SmartCar] refreshRealPorts error:', e);
        }
    }

    function handleSerialPorts(cmd) {
        if (!cmd.args || !cmd.args[0]) return;
        try {
            realPorts = JSON.parse(cmd.args[0]);
            updatePortSelector();
        } catch (e) {
            console.error('[SmartCar] parse ports error:', e);
        }
    }

    function updatePortSelector() {
        const select = document.getElementById('smartcar-port-select');
        if (!select) return;
        const prev = select.value;
        select.innerHTML = '<option value="">-- select port --</option>';
        for (const p of realPorts) {
            const label = p.path + (p.manufacturer ? ' (' + p.manufacturer + ')' : '');
            const opt = document.createElement('option');
            opt.value = p.path;
            opt.textContent = label;
            select.appendChild(opt);
        }
        // Restore previous selection if still available
        if (prev && realPorts.some(p => p.path === prev)) {
            select.value = prev;
        }
        selectedRealPort = select.value || null;
    }

    function getSelectedPort() {
        const select = document.getElementById('smartcar-port-select');
        return select ? select.value || null : null;
    }

    // ── Compile & Upload ─────────────────────────────────────
    function doCompile() {
        if (!connected) { alert('Not connected to backend server'); return; }
        showOutput();
        const term = getTerminal();
        if (term) term.setValue('Compiling...\n');
        showLoader('Compiling...');
        const code = getCode();
        const boardType = getBoardType();
        sendCommand('ArduShell', 'compile', [1, boardType, code]);
    }

    function doUpload() {
        if (!connected) { alert('Not connected to backend server'); return; }
        const port = getSelectedPort();
        if (!port || port === 'null') {
            alert('Please select a serial port first');
            return;
        }
        showOutput();
        const term = getTerminal();
        if (term) term.setValue('Uploading...\n');
        showLoader('Uploading...');
        const code = getCode();
        const boardType = getBoardType();
        sendCommand('ArduShell', 'upload', [1, boardType, port, code]);
    }

    // ── Loader UI ────────────────────────────────────────────
    function showLoader(title) {
        let loader = document.getElementById('smartcar-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'smartcar-loader';
            loader.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:30px 40px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;font-size:16px;';
            loader.innerHTML = `<span id="smartcar-loader-text">${title}</span>
                <button onclick="document.getElementById('smartcar-loader').style.display='none'" style="margin-left:15px;cursor:pointer;">✕</button>`;
            document.body.appendChild(loader);
        } else {
            document.getElementById('smartcar-loader-text').textContent = title;
            loader.style.display = 'block';
        }
    }

    function hideLoader() {
        const loader = document.getElementById('smartcar-loader');
        if (loader) loader.style.display = 'none';
    }

    // ── UI: Add Buttons ─────────────────────────────────────
    function updateStatus(text, ok) {
        const el = document.getElementById('smartcar-status');
        if (el) {
            el.textContent = text;
            el.style.color = ok ? '#4caf50' : '#f44336';
        }
    }

    function hideMixlyPortDropdown() {
        // Hide the Mixly #ports-type dropdown which shows fake Web Serial
        // names like "serial1" that don't work with arduino-cli
        const style = document.createElement('style');
        style.textContent = `
            #ports-type, select[m-id="ports-type"],
            label[for="ports-type"], .ports-type-label {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function injectButtons() {
        // Find the left button container
        const container = document.querySelector('.left-btn-container');
        if (!container) {
            setTimeout(injectButtons, 500);
            return;
        }

        // Check if already injected
        if (document.getElementById('smartcar-compile-btn')) return;

        // Status indicator
        const status = document.createElement('span');
        status.id = 'smartcar-status';
        status.style.cssText = 'font-size:12px;margin-right:8px;color:#f44336;';
        status.textContent = 'Connecting...';

        // Compile button
        const compileBtn = document.createElement('button');
        compileBtn.id = 'smartcar-compile-btn';
        compileBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        compileBtn.innerHTML = '<a class="icon-check">编译</a>';
        compileBtn.onclick = doCompile;

        // Upload button
        const uploadBtn = document.createElement('button');
        uploadBtn.id = 'smartcar-upload-btn';
        uploadBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        uploadBtn.innerHTML = '<a class="icon-upload">上传</a>';
        uploadBtn.onclick = doUpload;

        // Real port selector (not the Mixly #ports-type dropdown)
        const portSelect = document.createElement('select');
        portSelect.id = 'smartcar-port-select';
        portSelect.style.cssText = 'font-size:12px;padding:2px 4px;margin:0 4px;max-width:180px;border:1px solid #ccc;border-radius:3px;';
        portSelect.innerHTML = '<option value="">-- select port --</option>';
        portSelect.onchange = function() { selectedRealPort = this.value; };

        // Refresh ports button
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'smartcar-refresh-ports';
        refreshBtn.style.cssText = 'font-size:12px;padding:2px 6px;margin-right:4px;cursor:pointer;border:1px solid #ccc;border-radius:3px;background:#f5f5f5;';
        refreshBtn.textContent = '🔄';
        refreshBtn.title = 'Refresh ports';
        refreshBtn.onclick = refreshRealPorts;

        container.appendChild(status);
        container.appendChild(portSelect);
        container.appendChild(refreshBtn);
        container.appendChild(compileBtn);
        container.appendChild(uploadBtn);

        console.log('[SmartCar] Buttons injected');
    }

    // ── Init ─────────────────────────────────────────────────
    function init() {
        hideMixlyPortDropdown();
        injectButtons();
        connectWS();
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
        setTimeout(init, 1000);
    }
})();
