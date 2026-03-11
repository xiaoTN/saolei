// multiplayer.js — 前端联机模块（Transport 抽象层）
// 暴露全局对象 MP，供 game.js 调用

const MP = (() => {
    const WS_URL = 'ws://localhost:8765';

    let _ws = null;
    let _role = null;   // 'host' | 'guest' | null
    let _code = null;   // 当前房间码

    // ── 外部回调（由 game.js 赋值）──
    let onMessage    = null;  // (msg) => {}  接收游戏操作消息
    let onPartnerJoined   = null;  // () => {}
    let onPartnerLeft     = null;  // () => {}
    let onPartnerRejoined = null;  // () => {}
    let onRoomDestroyed   = null;  // () => {}
    let onError      = null;  // (code) => {}

    // ── 连接 ──────────────────────────────────────────
    function connect() {
        return new Promise((resolve, reject) => {
            if (_ws && _ws.readyState === WebSocket.OPEN) { resolve(); return; }
            _ws = new WebSocket(WS_URL);
            _ws.onopen = () => resolve();
            _ws.onerror = () => reject(new Error('WebSocket 连接失败，请确认服务器已启动'));
            _ws.onmessage = (e) => _handleMessage(JSON.parse(e.data));
            _ws.onclose = () => {
                // 意外断开时通知 game.js
                if (onPartnerLeft) onPartnerLeft();
            };
        });
    }

    function _send(data) {
        if (_ws && _ws.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify(data));
        }
    }

    // ── 消息分发 ─────────────────────────────────────
    function _handleMessage(msg) {
        switch (msg.type) {
            case 'room-created':
                _role = msg.role;
                _code = msg.code;
                if (MP._onRoomCreated) MP._onRoomCreated(msg.code);
                break;
            case 'room-joined':
                _role = msg.role;
                _code = msg.code;
                if (MP._onRoomJoined) MP._onRoomJoined(msg);
                break;
            case 'partner-joined':
                if (onPartnerJoined) onPartnerJoined();
                break;
            case 'partner-left':
                if (onPartnerLeft) onPartnerLeft();
                break;
            case 'partner-rejoined':
                if (onPartnerRejoined) onPartnerRejoined();
                break;
            case 'room-destroyed':
                if (onRoomDestroyed) onRoomDestroyed();
                break;
            case 'error':
                if (onError) onError(msg.code);
                break;
            default:
                // 游戏操作消息（reveal/flag/chord/board-init）
                if (onMessage) onMessage(msg);
        }
    }

    // ── 房间操作 ─────────────────────────────────────
    function createRoom(config) {
        _send({ type: 'create', config });
    }

    function joinRoom(code, config) {
        _send({ type: 'join', code: code.toUpperCase(), config });
    }

    // ── 游戏消息 ─────────────────────────────────────
    function send(data) {
        _send(data);
    }

    // ── 断开连接 ─────────────────────────────────────
    function disconnect() {
        if (_ws) { _ws.close(); _ws = null; }
        _role = null;
        _code = null;
    }

    // ── Getters ──────────────────────────────────────
    function getRole() { return _role; }
    function getCode() { return _code; }
    function isMultiplayer() { return _role !== null; }

    return {
        connect,
        createRoom,
        joinRoom,
        send,
        disconnect,
        getRole,
        getCode,
        isMultiplayer,
        // 回调属性（由 game.js 赋值）
        set onMessage(fn) { onMessage = fn; },
        set onPartnerJoined(fn) { onPartnerJoined = fn; },
        set onPartnerLeft(fn) { onPartnerLeft = fn; },
        set onPartnerRejoined(fn) { onPartnerRejoined = fn; },
        set onRoomDestroyed(fn) { onRoomDestroyed = fn; },
        set onError(fn) { onError = fn; },
        // 内部回调（由 UI 层赋值）
        _onRoomCreated: null,
        _onRoomJoined: null,
    };
})();
