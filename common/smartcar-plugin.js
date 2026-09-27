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
    let portPollTimer = null;
    let portSelectRetries = 0;

    // Persist the user's port choice so it survives upload-time re-enumeration
    // (the ESP32 briefly vanishes during upload) and browser restarts.
    const PREF_PORT = 'smartcar:selectedPort';
    function prefGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function prefSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

    // UI strings live in the board language files (language/{en,zh-hans,zh-hant}.js,
    // PLUGIN_* keys) so the plugin follows the app language like the blocks do.
    function msgText(key, fallback) {
        const v = (window.Blockly && Blockly.Msg && Blockly.Msg[key]) || fallback;
        return String(v || fallback);
    }

    // ── WebSocket ────────────────────────────────────────────
    function connectWS() {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
            console.log('[SmartCar] WebSocket connected');
            connected = true;
            updateStatus('connected');
            while (pendingMessages.length > 0) {
                ws.send(pendingMessages.shift());
            }
            refreshRealPorts();
            // Keep the port list live so hot-plugged boards appear without a manual refresh.
            if (portPollTimer) clearInterval(portPollTimer);
            portPollTimer = setInterval(refreshRealPorts, 4000);
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
            updateStatus('disconnected');
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
            // After upload the board resets and the port re-enumerates; refresh
            // promptly so the saved port selection is restored right away.
            if (type === 'upload') refreshRealPorts();
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
        if (!select) {
            // Mixly's toolbar hasn't rendered the port selector yet; retry shortly
            // so the first port list (received on WS open) isn't silently lost.
            if (portSelectRetries < 15) {
                portSelectRetries++;
                setTimeout(updatePortSelector, 400);
            }
            return;
        }
        portSelectRetries = 0;

        // Remember the user's choice when they pick a port (user action only, not
        // the programmatic restore below, so the saved choice isn't overwritten).
        if (!select._smartcarPrefBound) {
            select._smartcarPrefBound = true;
            $(select).on('select2:select', () => {
                prefSet(PREF_PORT, getSelectedPort() || '');
            });
        }

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
        // Restore selection: prefer the persisted port, fall back to the transient
        // value. This re-selects the port automatically after it briefly vanishes
        // during upload (board reset) and reappears on the next refresh.
        const saved = prefGet(PREF_PORT);
        const want = [saved, prev].find(v => v && realPorts.some(p => p.path === v)) || '';
        if (want) select.value = want;
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

    // Resolve which model to compile with. Priority: a manually uploaded file
    // (ephemeral session), else the model picked from the library dropdown on
    // the "load AI model" block. If the sketch uses AI Vision blocks but no
    // model is selected, abort with a clear message instead of compiling the
    // empty placeholder.
    async function resolveModelRef(code) {
        if (!code.includes('Mixly_TFLite')) return null;
        const t = window.__mixly_tflite || {};
        if (t.modelData) return await uploadModel();
        if (t.selectedModelRef) return t.selectedModelRef;
        hideLoader();
        alert('No AI model selected. Pick one on the "load AI model" block (from the AI Training tab) or upload a .tflite file.');
        return undefined; // sentinel: abort
    }

    async function doCompile() {
        if (!connected) { alert('Not connected to backend server'); return; }
        showOutput();
        const term = getTerminal();
        if (term) term.setValue('Compiling...\n');
        showLoader('Compiling...');
        const code = getCode();
        const boardType = getBoardType();

        const modelSessionId = await resolveModelRef(code);
        if (modelSessionId === undefined) return;

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

        const modelSessionId = await resolveModelRef(code);
        if (modelSessionId === undefined) return;

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

    // ── File Manager (.mix save/load) ───────────────────────
    let fileHandle = null;          // File System Access API handle
    let autoSaveTimer = null;
    const AUTO_SAVE_MS = 30000;     // auto-save every 30s

    function getWorkspaceXml() {
        try {
            const workspace = Mixly.Workspace.getMain();
            const editorsManager = workspace.getEditorsManager();
            const editor = editorsManager.getActive();
            if (editor && editor.getXml) return editor.getXml();
            const blockEditor = editorsManager.getEditorByType('blockly');
            if (blockEditor && blockEditor.getXml) return blockEditor.getXml();
        } catch(e) {
            console.error('[SmartCar] getWorkspaceXml error:', e);
        }
        return null;
    }

    function loadWorkspaceXml(xml) {
        try {
            const workspace = Mixly.Workspace.getMain();
            const editorsManager = workspace.getEditorsManager();
            const editor = editorsManager.getActive();
            if (editor && editor.setXml) { editor.setXml(xml); return; }
            const blockEditor = editorsManager.getEditorByType('blockly');
            if (blockEditor && blockEditor.setXml) blockEditor.setXml(xml);
        } catch(e) {
            console.error('[SmartCar] loadWorkspaceXml error:', e);
        }
    }

    function updateSaveIndicator() {
        const el = document.getElementById('smartcar-filename');
        if (el && fileHandle) el.textContent = fileHandle.name;
    }

    async function writeFile(handle, xml) {
        const writable = await handle.createWritable();
        await writable.write(xml);
        await writable.close();
    }

    async function doSaveAs() {
        if (!window.showSaveFilePicker) {
            alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
            return;
        }
        try {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: 'my_program.mix',
                types: [{ description: 'Mixly Program', accept: { 'text/xml': ['.mix'] } }]
            });
            const xml = getWorkspaceXml();
            if (xml) {
                await writeFile(fileHandle, xml);
                updateSaveIndicator();
                output('[File] Saved as ' + fileHandle.name + '\n');
                startAutoSave();
            }
        } catch(e) {
            if (e.name !== 'AbortError') console.error('[SmartCar] SaveAs error:', e);
        }
    }

    async function doSave() {
        if (!fileHandle) {
            return doSaveAs();
        }
        try {
            // Check permission
            const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                const req = await fileHandle.requestPermission({ mode: 'readwrite' });
                if (req !== 'granted') { doSaveAs(); return; }
            }
            const xml = getWorkspaceXml();
            if (xml) {
                await writeFile(fileHandle, xml);
                updateSaveIndicator();
            }
        } catch(e) {
            console.error('[SmartCar] Save error:', e);
            // Permission may have been revoked — fall back to Save As
            fileHandle = null;
            doSaveAs();
        }
    }

    async function doOpen(handle) {
        try {
            if (!handle) {
                if (!window.showOpenFilePicker) {
                    alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
                    return;
                }
                const [picked] = await window.showOpenFilePicker({
                    types: [{ description: 'Mixly Program', accept: { 'text/xml': ['.mix'] } }]
                });
                handle = picked;
            }
            const file = await handle.getFile();
            const xml = await file.text();
            if (xml) {
                loadWorkspaceXml(xml);
                fileHandle = handle;
                updateSaveIndicator();
                output('[File] Loaded ' + handle.name + '\n');
                startAutoSave();
            }
        } catch(e) {
            if (e.name !== 'AbortError') console.error('[SmartCar] Open error:', e);
        }
    }

    function startAutoSave() {
        if (autoSaveTimer) clearInterval(autoSaveTimer);
        autoSaveTimer = setInterval(() => {
            if (fileHandle) doSave().catch(() => {});
        }, AUTO_SAVE_MS);
    }

    function handleDragDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer?.files?.[0];
        if (file && (file.name.endsWith('.mix') || file.name.endsWith('.xml'))) {
            const reader = new FileReader();
            reader.onload = async () => {
                loadWorkspaceXml(reader.result);
                output('[File] Loaded ' + file.name + ' (drag-drop)\n');
                // Can't get fileHandle from drag-drop, so first save will be "Save As"
                fileHandle = null;
                updateSaveIndicator();
            };
            reader.readAsText(file);
        }
    }

    // ── UI: Add Buttons ─────────────────────────────────────
    function updateStatus(state) {
        const states = {
            connecting: { color: '#fb8c00', label: msgText('PLUGIN_STATUS_CONNECTING', 'Connecting'), pulse: true },
            connected: { color: '#4caf50', label: msgText('PLUGIN_STATUS_CONNECTED', 'Connected'), pulse: false },
            disconnected: { color: '#f44336', label: msgText('PLUGIN_STATUS_DISCONNECTED', 'Not connected'), pulse: false }
        };
        const s = states[state] || states.disconnected;
        const dot = document.getElementById('smartcar-status-dot');
        const text = document.getElementById('smartcar-status-text');
        const pill = document.getElementById('smartcar-status');
        if (dot) {
            dot.style.background = s.color;
            dot.classList.toggle('smartcar-status-pulse', s.pulse);
        }
        if (text) text.textContent = s.label;
        if (pill) {
            pill.style.background = s.color + '1a';
            pill.style.color = s.color;
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
            /* Connection status badge */
            .smartcar-status-pill {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin-right: 8px;
                padding: 2px 9px;
                border-radius: 11px;
                font-size: 12px;
                line-height: 18px;
                background: rgba(244,67,54,0.1);
                color: #f44336;
                transition: background .2s, color .2s;
            }
            .smartcar-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #f44336;
                display: inline-block;
            }
            .smartcar-status-dot.smartcar-status-pulse {
                animation: smartcar-status-blink 1s ease-in-out infinite;
            }
            @keyframes smartcar-status-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
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

        // Status indicator (dot + label pill)
        const status = document.createElement('span');
        status.id = 'smartcar-status';
        status.className = 'smartcar-status-pill';
        status.innerHTML = '<span id="smartcar-status-dot" class="smartcar-status-dot"></span>'
            + '<span id="smartcar-status-text">…</span>';

        // Compile button
        const compileBtn = document.createElement('button');
        compileBtn.id = 'smartcar-compile-btn';
        compileBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        compileBtn.innerHTML = '<a class="icon-check">' + msgText('PLUGIN_COMPILE', 'Compile') + '</a>';
        compileBtn.onclick = doCompile;

        // Upload button
        const uploadBtn = document.createElement('button');
        uploadBtn.id = 'smartcar-upload-btn';
        uploadBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        uploadBtn.innerHTML = '<a class="icon-upload">' + msgText('PLUGIN_UPLOAD', 'Upload') + '</a>';
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
        updateStatus('connecting');

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.id = 'smartcar-save-btn';
        saveBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        saveBtn.innerHTML = '<a class="icon-save">' + msgText('PLUGIN_SAVE', 'Save') + '</a>';
        saveBtn.onclick = doSave;

        // Open button
        const openBtn = document.createElement('button');
        openBtn.id = 'smartcar-open-btn';
        openBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        openBtn.innerHTML = '<a class="icon-folder-open">' + msgText('PLUGIN_OPEN', 'Open') + '</a>';
        openBtn.onclick = () => doOpen(null);

        container.appendChild(saveBtn);
        container.appendChild(openBtn);
        container.appendChild(compileBtn);
        container.appendChild(uploadBtn);

        // Filename indicator (shows current file name)
        const filename = document.createElement('span');
        filename.id = 'smartcar-filename';
        filename.style.cssText = 'font-size:11px;margin-left:6px;color:#999;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle;';
        filename.textContent = '';
        container.appendChild(filename);

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

        // Ctrl+S = Save, Ctrl+O = Open
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                doSave();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                doOpen(null);
            }
        });

        // Drag-drop .mix/.xml files
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', handleDragDrop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
        setTimeout(init, 1000);
    }
})();
