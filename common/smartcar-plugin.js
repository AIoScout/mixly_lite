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
            while (pendingMessages.length > 0) {
                ws.send(pendingMessages.shift());
            }
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
            const workspace = Mixly.Workspace.getMain();
            const editorsManager = workspace.getEditorsManager();
            const editor = editorsManager.getActive();
            if (editor && editor.getCode) return editor.getCode();
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
    // Repopulate the existing Mixly #ports-type select2 with real
    // OS-level port paths from the server's SerialPort.list(),
    // replacing the fake Web Serial names (serial1, serial2, etc.).

    let realPorts = [];

    async function refreshRealPorts() {
        try {
            sendCommand('Serial', 'list', []);
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
        const select = document.getElementById('ports-type');
        if (!select) return;
        const prev = select.value;
        // Clear and repopulate with real ports
        select.innerHTML = '<option value="">Select Port</option>';
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
        // Trigger select2 to re-render
        try { $(select).trigger('change'); } catch(e) {}
    }

    function getSelectedPort() {
        const select = document.getElementById('ports-type');
        if (!select) return null;
        try { return $(select).val() || null; } catch(e) { return select.value || null; }
    }

    // ── Compile & Upload ─────────────────────────────────────
    async function uploadModel() {
        const tflite = window.__mixly_tflite;
        if (!tflite || !tflite.modelData) return null;

        const formData = new FormData();
        const modelBlob = new Blob([tflite.modelData]);
        formData.append('model', modelBlob, 'model.tflite');
        if (tflite.labelsText) {
            formData.append('labels', new Blob([tflite.labelsText]), 'labels.txt');
        }

        try {
            const resp = await fetch('/upload-model', { method: 'POST', body: formData });
            const data = await resp.json();
            if (data.error) {
                output('[Error] Model upload failed: ' + data.error);
                return null;
            }
            output('[TFLite] Model uploaded (session: ' + data.sessionId + ')\n');
            return data.sessionId;
        } catch (e) {
            output('[Error] Model upload failed: ' + e.message);
            return null;
        }
    }

    async function doCompile() {
        if (!connected) { alert('Not connected to backend server'); return; }
        showOutput();
        const term = getTerminal();
        if (term) term.setValue('Compiling...\n');
        showLoader('Compiling...');
        const code = getCode();
        const boardType = getBoardType();

        let modelSessionId = null;
        if (window.__mixly_tflite && window.__mixly_tflite.modelData) {
            modelSessionId = await uploadModel();
        }

        const args = [1, boardType, code];
        if (modelSessionId) args.push(modelSessionId);
        sendCommand('ArduShell', 'compile', args);
    }

    async function doUpload() {
        if (!connected) { alert('Not connected to backend server'); return; }
        const port = getSelectedPort();
        if (!port || port === 'null' || port === 'undefined' || port === '') {
            alert('Please select a serial port first');
            return;
        }
        showOutput();
        const term = getTerminal();
        if (term) term.setValue('Uploading...\n');
        showLoader('Uploading...');
        const code = getCode();
        const boardType = getBoardType();

        let modelSessionId = null;
        if (window.__mixly_tflite && window.__mixly_tflite.modelData) {
            modelSessionId = await uploadModel();
        }

        const args = [1, boardType, port, code];
        if (modelSessionId) args.push(modelSessionId);
        sendCommand('ArduShell', 'upload', args);
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

    function widenPortSelector() {
        // Make the port select2 wider to fit long port paths
        // e.g. /dev/cu.usbmodem1101 (Silicon Labs)
        const style = document.createElement('style');
        style.textContent = `
            /* Widen the port select2 container and its dropdown */
            .dropdown-container > span.select2:last-of-type,
            .dropdown-container > span.select2:last-of-type .select2-selection {
                width: 280px !important;
            }
            .dropdown-container > span.select2:last-of-type .select2-dropdown {
                width: 280px !important;
            }
        `;
        document.head.appendChild(style);
    }

    function injectButtons() {
        const container = document.querySelector('.left-btn-container');
        if (!container) {
            setTimeout(injectButtons, 500);
            return;
        }

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

        // Refresh ports button in the nav dropdown area
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'smartcar-refresh-ports';
        refreshBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        refreshBtn.innerHTML = '<a style="font-size:14px;">&#x21bb;</a>';
        refreshBtn.title = 'Refresh ports';
        refreshBtn.style.cssText = 'padding:0 4px;';
        refreshBtn.onclick = refreshRealPorts;

        container.appendChild(status);
        container.appendChild(compileBtn);
        container.appendChild(uploadBtn);

        // Add refresh button next to the port selector in dropdown-container
        const dropdownContainer = document.querySelector('.dropdown-container');
        if (dropdownContainer && !document.getElementById('smartcar-refresh-ports')) {
            dropdownContainer.appendChild(refreshBtn);
        }

        console.log('[SmartCar] Buttons injected');
    }

    // ── Init ─────────────────────────────────────────────────
    function init() {
        widenPortSelector();
        injectButtons();
        connectWS();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
        setTimeout(init, 1000);
    }
})();
