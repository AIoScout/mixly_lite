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
            // Server-backed serial: flag the page so chrome that only makes
            // sense for browser WebSerial authorization can hide itself.
            document.body.classList.add('smartcar-ws');
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
            document.body.classList.remove('smartcar-ws');
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
        } else if (obj === 'Mixly.WebSocket.Serial' && func === 'closed') {
            // The server released this port (page-switch handoff via
            // /serial/close-all, or an upload needing exclusive access).
            // Reflect it in the monitor so a later reopen actually reopens.
            try {
                const sb = Mixly.mainStatusBarTabs?.getStatusBarById(args[0]);
                const s = sb?.getSerial?.();
                if (sb && s && s.__serverWs && s.isOpened()) {
                    s.__autoReopen = true;   // reopen on visibility / upload end
                    sb.close().catch(() => {});
                }
            } catch (e) { /* monitor tab gone */ }
            updateMonitorBtnState();
        } else if (func === 'addValue' && args.length >= 1) {
            // Serial line from the server: [portName, line]. Feed the
            // native serial monitor tab when one is open for that port;
            // the smartcar console gets the line too as a fallback.
            const line = args.length >= 2 ? args[1] : args[0];
            if (args.length >= 2) {
                try {
                    const sb = Mixly.mainStatusBarTabs?.getStatusBarById(args[0]);
                    const s = sb?.getSerial?.();
                    if (s?.isOpened?.()) {
                        s.runEvent('onString', line);
                        for (const ch of line) s.runEvent('onChar', ch);
                    }
                } catch (e) { /* monitor closed — console output below */ }
            }
            output(line);
        } else if (func === 'operateSuccess') {
            hideLoader();
            const type = args[0];
            const msg = type === 'compile' ? 'Compile succeeded' : 'Upload succeeded';
            output('\n==' + msg + '==\n');
            // After upload the board resets and the port re-enumerates; refresh
            // promptly so the saved port selection is restored right away,
            // and bring back any monitor the upload's port grab closed.
            if (type === 'upload') {
                refreshRealPorts();
                reopenAutoReopenMonitors(1500);
            }
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
        updateMonitorBtnState();
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

        // Feed mixly's native serial monitor too: the statusbar "Open port"
        // menu reads Serial.getCurrentPortsName(), which is only populated by
        // the Serial.setPorts → renderSelectBox path we intercept above.
        // Without this the monitor's port list stays forever empty.
        try {
            if (window.Mixly && Mixly.Serial && Mixly.Serial.portsName) {
                Mixly.Serial.portsName = realPorts.map(p => p.path).sort();
            }
        } catch (e) { /* non-fatal */ }
    }

    function getSelectedPort() {
        const select = document.getElementById('ports-type');
        if (!select) return null;
        try { return $(select).val() || null; } catch(e) { return select.value || null; }
    }

    // ── Server-WS transport for the native serial monitor ────
    // Web mode binds the statusbar serial monitor to the browser WebSerial
    // API, which needs a user-gesture port picker and holds the port inside
    // the renderer — the desktop shell's port handoff (/serial/close-all,
    // server-side) could never release it. The WebSerial class itself is
    // module-private, so wrap StatusBarSerial.init and rebind each created
    // serial instance to our server's WebSocket serial (the transport
    // compile/upload already use); the monitor then participates in the
    // handoff by construction. Incoming lines arrive via the addValue
    // branch of handleResponse above.
    function patchSerialInstanceToWs(s) {
        if (!s || s.__serverWs) return;
        s.__serverWs = true;
        s.__wsOpen = false;
        // NOTE: sendCommand URI-encodes args itself — pass raw values.
        s.open = async function (baud) {
            const port = this.getPortName();
            if (!port) throw new Error('no port selected');
            sendCommand('Serial', 'open', [port, String(baud ?? 115200)]);
            this.__wsOpen = true;
            this.runEvent('onOpen');
        };
        s.close = async function () {
            const port = this.getPortName();
            if (port) sendCommand('Serial', 'close', [port]);
            this.__wsOpen = false;
            this.runEvent('onClose');
        };
        s.isOpened = function () { return !!this.__wsOpen; };
        s.write = async function (data) {
            const port = this.getPortName();
            if (port && this.__wsOpen) {
                sendCommand('Serial', 'write', [port, String(data)]);
            }
        };
        s.setDTRAndRTS = async function () { /* server transport has no line control */ };
    }

    function installServerWsSerial(attempt) {
        attempt = attempt || 0;
        const SBSCls = window.Mixly?.StatusBarSerial;
        if (!SBSCls?.prototype) {
            if (attempt < 60) setTimeout(() => installServerWsSerial(attempt + 1), 500);
            return;
        }
        if (SBSCls.prototype.__wsWrapped) return;
        SBSCls.prototype.__wsWrapped = true;
        const origInit = SBSCls.prototype.init;
        SBSCls.prototype.init = function (...args) {
            const r = origInit.apply(this, args);
            try { patchSerialInstanceToWs(this.getSerial()); } catch (e) { /* keep native */ }
            return r;
        };
    }
    installServerWsSerial();

    // Reopen monitors the server force-closed (page handoff / upload) once
    // the coding view is visible again or the upload that stole the port
    // finished. The port re-enumerates briefly after an upload, so give it
    // a moment there.
    function reopenAutoReopenMonitors(delayMs) {
        const t = Mixly.mainStatusBarTabs;
        if (!t || typeof t.keys !== 'function') return;
        const reopen = () => {
            for (const id of [...t.keys()]) {
                try {
                    const sb = t.getStatusBarById(id);
                    const s = sb?.getSerial?.();
                    if (s && s.__serverWs && s.__autoReopen && !s.isOpened()) {
                        s.__autoReopen = false;
                        sb.open().catch(() => {}).finally?.(() => updateMonitorBtnState());
                    }
                } catch (e) { /* next tab */ }
            }
            updateMonitorBtnState();
        };
        if (delayMs) setTimeout(reopen, delayMs); else reopen();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reopenAutoReopenMonitors(300);
    });
    // The desktop shell calls this when the coding view is re-attached —
    // WebContentsView visibilityState does not reliably flip on attach, so
    // the explicit signal is the primary trigger.
    window.__aioscoutSignalVisible = () => reopenAutoReopenMonitors(300);

    // ── One-click serial monitor on the footer-selected port ────
    // The native flow needs the statusbar "+" dropdown and its own port
    // picker; the toolbar button below opens/closes the monitor for the
    // port already selected at the top of the page.
    async function ensureMonitorTab(port) {
        const t = Mixly.mainStatusBarTabs;
        let sb = t.getStatusBarById(port);
        if (sb && sb.isInited && sb.isInited()) return sb;
        if (!sb) await t.add('serial', port);
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 300));
            sb = t.getStatusBarById(port);
            if (sb && sb.isInited && sb.isInited()) return sb;
        }
        return t.getStatusBarById(port);
    }

    async function toggleMonitor() {
        const port = getSelectedPort();
        if (!port || port === 'null' || port === 'undefined') {
            alert(msgText('PLUGIN_SELECT_PORT_FIRST', 'Please select a serial port first'));
            return;
        }
        const sb = await ensureMonitorTab(port);
        if (!sb) return;
        // show() unfolds the statusbar container (a collapsed bar leaves the
        // monitor page active-but-invisible and its output gated off).
        if (Mixly.mainStatusBarTabs.show) Mixly.mainStatusBarTabs.show();
        Mixly.mainStatusBarTabs.changeTo(port);
        try {
            if (sb.getSerial().isOpened()) {
                await sb.close();
            } else {
                await sb.open();
            }
        } catch (e) { /* port vanished mid-toggle */ }
        updateMonitorBtnState();
    }

    function updateMonitorBtnState() {
        const btn = document.getElementById('smartcar-monitor-btn');
        if (!btn) return;
        const port = getSelectedPort();
        const sb = port && window.Mixly && Mixly.mainStatusBarTabs
            ? Mixly.mainStatusBarTabs.getStatusBarById(port) : null;
        const open = !!(sb && sb.getSerial && sb.getSerial().isOpened && sb.getSerial().isOpened());
        btn.classList.toggle('layui-btn-warm', open);
        btn.title = open ? msgText('PLUGIN_MONITOR_CLOSE', 'Close serial monitor')
                         : msgText('PLUGIN_MONITOR_OPEN', 'Open serial monitor for the selected port');
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
        // Canonical Mixly path (see common/mfile.js): clear + domToWorkspace on
        // the blockly workspace, then recenter.
        try {
            const dom = Blockly.utils.xml.textToDom(xml);
            const ws = targetWorkspace();
            if (!ws) throw new Error('workspace not ready');
            ws.clear();
            Blockly.Xml.domToWorkspace(dom, ws);
            if (ws.scrollCenter) ws.scrollCenter();
        } catch(e) {
            console.error('[SmartCar] loadWorkspaceXml error:', e);
        }
    }

    // ── Starter programs ────────────────────────────────────
    // A fresh install (no saved blocks for the selected board) opens with a
    // working program instead of an empty canvas: P4 board → AI Eye program,
    // anything else (S3) → AI Body program.
    function starterForCurrentBoard() {
        const fqbn = String(getBoardType() || '');
        return fqbn.indexOf('p4') !== -1 ? '/programs/p4_ai_eye.xml' : '/programs/s3_ai_body.xml';
    }

    // The workspace Mixly actually renders — the one with a flyout attached.
    // Blockly.getMainWorkspace() can point at a temporary workspace during
    // boot (Mixly rebuilds its editor after Loader.init), so waiting for the
    // flyout workspace is also our "fully initialized" signal.
    function targetWorkspace() {
        try {
            if (window.Editor && window.Editor.blockEditor) return window.Editor.blockEditor;
            for (const w of Blockly.Workspace.getAll()) {
                if (w.rendered && w.getFlyout && w.getFlyout()) return w;
            }
        } catch (e) { /* not ready */ }
        return null;
    }

    function workspaceBlockCount() {
        const ws = targetWorkspace();
        return ws ? ws.getAllBlocks(false).length : -1; // -1 = not ready yet
    }

    function ensureStarterProgram(attempt) {
        attempt = attempt || 0;
        if (attempt > 40) return; // ~20s
        const count = workspaceBlockCount();
        if (count === -1) { setTimeout(() => ensureStarterProgram(attempt + 1), 500); return; }
        if (count > 0) return; // user content restored (or already working)
        fetch(starterForCurrentBoard())
            .then((r) => (r.ok ? r.text() : null))
            .then((xml) => {
                if (!xml) return;
                if (workspaceBlockCount() > 0) return; // raced with a restore
                loadWorkspaceXml(xml);
                output('[SmartCar] Starter program loaded — pick a model on the "load AI model" block, then Compile & Upload.\n');
            })
            .catch(() => {});
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
                padding: 0 10px;
                border-radius: 11px;
                font-size: 12px;
                line-height: 1;
                white-space: nowrap;
                height: 26px;
                background: rgba(244,67,54,0.1);
                color: #f44336;
                transition: background .2s, color .2s;
            }
            /* WebSerial authorization button is web-mode only; the embedded
               server lists/opens ports itself. */
            body.smartcar-ws #port-add-btn {
                display: none !important;
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

    // Mixly's license: modified builds must retain the software name and
    // author information. The desktop shell hides the home button (which
    // carries the name), so a permanent footer credit carries it instead.
    function injectMixlyCredit(attempt) {
        // The footerbar mounts after the nav does; retry a few beats so the
        // license credit is never silently dropped on a slow first load.
        attempt = attempt || 0;
        const bar = document.querySelector('.mixly-footerbar .footerbar-item:first-child');
        if (document.getElementById('smartcar-mixly-credit')) return;
        if (!bar) {
            if (attempt < 40) setTimeout(() => injectMixlyCredit(attempt + 1), 500);
            return;
        }
        const credit = document.createElement('div');
        credit.id = 'smartcar-mixly-credit';
        credit.style.cssText = 'display:inline-flex;align-items:center;margin:0 5px;font-size:12px;opacity:.8;';
        credit.textContent = 'Block Coding · Powered by Mixly (Mixly Team @ BNU)';
        bar.appendChild(credit);
    }

    function injectButtons() {
        const container = document.querySelector('.left-btn-container');
        if (!container) {
            setTimeout(injectButtons, 500);
            return;
        }

        if (document.getElementById('smartcar-compile-btn')) return;

        injectMixlyCredit();

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

        // Serial monitor toggle — opens/closes the native monitor for the
        // port selected in the footer, no extra port picking.
        const monitorBtn = document.createElement('button');
        monitorBtn.id = 'smartcar-monitor-btn';
        monitorBtn.className = 'layui-btn layui-btn-xs layui-btn-primary mixly-nav';
        monitorBtn.innerHTML = '<a class="icon-console">' + msgText('PLUGIN_MONITOR', 'Monitor') + '</a>';
        monitorBtn.title = msgText('PLUGIN_MONITOR_OPEN', 'Open serial monitor for the selected port');
        monitorBtn.onclick = () => { toggleMonitor().catch(() => {}); };
        container.appendChild(monitorBtn);
        updateMonitorBtnState();

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

        // Fresh install → open the starter program for the selected board
        // (waits for the workspace, skips if the user already has blocks).
        setTimeout(() => ensureStarterProgram(0), 2500);
        // Switching boards (S3 ↔ P4) may reveal another empty workspace.
        try {
            $('#boards-type').on('select2:select change', () => setTimeout(() => ensureStarterProgram(0), 1500));
        } catch (e) { /* select2 not ready */ }

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
