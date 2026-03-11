# 双人联机合作模式 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在多边形扫雷游戏中新增双人联机合作模式，支持本地 WebSocket 服务器，两人共享棋盘协作扫雷。

**Architecture:** 新建 `server.js`（Node.js WebSocket 信令服务器，纯中转+缓存 board-init）和 `multiplayer.js`（前端 Transport 抽象层）。修改 `index.html` 添加模式选择/联机大厅/等待室界面，修改 `game.js` 在关键操作处插入联机钩子，修改 `style.css` 添加联机相关样式。

**Tech Stack:** Node.js `ws` 包（服务端），原生 WebSocket API（浏览器端），无框架无构建工具

---

## Chunk 1: server.js — WebSocket 信令服务器

### Task 1: 初始化 Node.js 项目并安装依赖

**Files:**
- Create: `package.json`
- Create: `server.js`

- [ ] **Step 1: 检查是否已有 package.json**

```bash
ls /Users/xiaotn/saolei/package.json 2>/dev/null && echo "exists" || echo "not found"
```

- [ ] **Step 2: 若无则创建 package.json**

```bash
cd /Users/xiaotn/saolei && cat > package.json << 'EOF'
{
  "name": "saolei-multiplayer",
  "version": "1.0.0",
  "description": "多边形扫雷联机服务器",
  "main": "server.js",
  "scripts": {
    "server": "node server.js"
  }
}
EOF
```

- [ ] **Step 3: 安装 ws 包**

```bash
cd /Users/xiaotn/saolei && npm install ws
```

预期输出：`added N packages` 无报错

- [ ] **Step 4: 提交**

```bash
cd /Users/xiaotn/saolei && git add package.json package-lock.json && git commit -m "添加 Node.js 项目配置，安装 ws 依赖"
```

---

### Task 2: 实现 server.js

**Files:**
- Create: `server.js`

服务器职责（完整实现，代码已内嵌）：
- 管理房间（房间码 → `{ host, guest, config, boardInit, reconnectTimer }` 映射）
- `create` 消息：生成4位码，存入房间，向 host 返回 `room-created`
- `join` 消息：
  - 格式校验（`/^[A-Z0-9]{4}$/`）→ 不合法返回 `INVALID_CODE`
  - 房间不存在 → 返回 `ROOM_NOT_FOUND`
  - 断线重连（`room.host === null` 或 `room.guest === null` 且 ws 未在房间中）→ 重新加入，**取消 reconnectTimer**，向重连方重放 `boardInit`，向留守方发 `partner-rejoined`
  - 房间已满（host 和 guest 均在线）→ 返回 `ROOM_FULL`
  - 正常加入：存 `room.config`（来自 join 消息的 config 字段），向 guest 发 `room-joined`（含 config），向 host 发 `partner-joined`
- 转发所有其他消息给对方；`board-init` 时额外缓存到 `room.boardInit`
- `close` 事件：通知对方 `partner-left`，调用 `scheduleRoomDestroy`（30秒后删房间并通知留守方 `room-destroyed`）

- [ ] **Step 1: 手动测试方案准备**

后续通过两个 `wscat` 或浏览器控制台连接来验证，此步骤只需确认 `ws` 已安装：

```bash
cd /Users/xiaotn/saolei && node -e "require('ws'); console.log('ws OK')"
```

预期：`ws OK`

- [ ] **Step 2: 创建 server.js**

```javascript
// server.js — 多边形扫雷联机信令服务器
const { WebSocketServer } = require('ws');

const PORT = 8765;
const wss = new WebSocketServer({ port: PORT });

// rooms: code → { host: ws|null, guest: ws|null, boardInit: msg|null, reconnectTimer: id|null }
const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (rooms.has(code));
    return code;
}

function send(ws, data) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function getPartner(room, ws) {
    if (room.host === ws) return room.guest;
    if (room.guest === ws) return room.host;
    return null;
}

function getRoomByWs(ws) {
    for (const [code, room] of rooms) {
        if (room.host === ws || room.guest === ws) return { code, room };
    }
    return null;
}

function scheduleRoomDestroy(code) {
    const room = rooms.get(code);
    if (!room) return;
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
    room.reconnectTimer = setTimeout(() => {
        const r = rooms.get(code);
        if (!r) return;
        // 通知留守方
        const survivor = r.host || r.guest;
        send(survivor, { type: 'room-destroyed' });
        rooms.delete(code);
        console.log(`[room] ${code} destroyed after timeout`);
    }, 30000);
}

wss.on('connection', (ws) => {
    console.log('[ws] client connected');

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'create') {
            const code = generateCode();
            rooms.set(code, { host: ws, guest: null, boardInit: null, reconnectTimer: null });
            ws._roomCode = code;
            ws._role = 'host';
            send(ws, { type: 'room-created', code, role: 'host' });
            console.log(`[room] ${code} created`);
            return;
        }

        if (msg.type === 'join') {
            const code = (msg.code || '').toUpperCase().trim();
            if (!/^[A-Z0-9]{4}$/.test(code)) {
                send(ws, { type: 'error', code: 'INVALID_CODE' }); return;
            }
            const room = rooms.get(code);
            if (!room) {
                send(ws, { type: 'error', code: 'ROOM_NOT_FOUND' }); return;
            }

            // 断线重连：原 host 重连
            if (!room.host && ws._roomCode !== code) {
                if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
                room.reconnectTimer = null;
                room.host = ws;
                ws._roomCode = code;
                ws._role = 'host';
                send(ws, { type: 'room-joined', code, role: 'host', config: room.config || {} });
                if (room.boardInit) send(ws, room.boardInit);
                send(room.guest, { type: 'partner-rejoined' });
                console.log(`[room] ${code} host reconnected`);
                return;
            }

            // 断线重连：原 guest 重连
            if (!room.guest && ws._roomCode !== code) {
                if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
                room.reconnectTimer = null;
                room.guest = ws;
                ws._roomCode = code;
                ws._role = 'guest';
                send(ws, { type: 'room-joined', code, role: 'guest', config: room.config || {} });
                if (room.boardInit) send(ws, room.boardInit);
                send(room.host, { type: 'partner-rejoined' });
                console.log(`[room] ${code} guest reconnected`);
                return;
            }

            // 房间已满
            if (room.host && room.guest) {
                send(ws, { type: 'error', code: 'ROOM_FULL' }); return;
            }

            // 正常加入
            room.guest = ws;
            room.config = msg.config || null;
            ws._roomCode = code;
            ws._role = 'guest';
            const config = room.config || {};
            send(ws, { type: 'room-joined', code, role: 'guest', config });
            send(room.host, { type: 'partner-joined' });
            console.log(`[room] ${code} guest joined`);
            return;
        }

        // 转发消息给对方
        const entry = getRoomByWs(ws);
        if (!entry) return;
        const { code, room } = entry;

        // 缓存 board-init 消息
        if (msg.type === 'board-init') {
            room.boardInit = msg;
        }

        const partner = getPartner(room, ws);
        send(partner, msg);
    });

    ws.on('close', () => {
        const entry = getRoomByWs(ws);
        if (!entry) return;
        const { code, room } = entry;
        const partner = getPartner(room, ws);

        if (room.host === ws) room.host = null;
        else if (room.guest === ws) room.guest = null;

        send(partner, { type: 'partner-left' });
        scheduleRoomDestroy(code);
        console.log(`[room] ${code} a player disconnected`);
    });
});

console.log(`[server] listening on ws://localhost:${PORT}`);
```

- [ ] **Step 3: 启动服务器并做最简冒烟测试**

```bash
cd /Users/xiaotn/saolei && node server.js &
sleep 1
# 用 Node 脚本验证 WebSocket 连接可建立
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => { console.log('smoke test: connected OK'); ws.close(); process.exit(0); });
ws.on('error', (e) => { console.error('smoke test: FAILED', e.message); process.exit(1); });
"
```

预期输出：`smoke test: connected OK`

- [ ] **Step 4: 停止后台服务器**

```bash
kill %1 2>/dev/null || pkill -f "node server.js"
```

- [ ] **Step 5: 提交**

```bash
cd /Users/xiaotn/saolei && git add server.js && git commit -m "新增 WebSocket 信令服务器 server.js"
```

---

## Chunk 2: multiplayer.js — 前端联机模块

### Task 3: 实现 multiplayer.js

**Files:**
- Create: `multiplayer.js`

该模块暴露全局对象 `MP`，封装 WebSocket 连接和房间逻辑。

- [ ] **Step 1: 创建 multiplayer.js**

```javascript
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
```

- [ ] **Step 2: 在 index.html 中正确位置插入 multiplayer.js 的 script 标签**

打开 `index.html`，在 `renderer.js` 与 `game.js` 之间添加（**必须在 `game.js` 之前**，因为 `game.js` 初始化时会检测全局 `MP` 对象是否存在）：

```html
    <script src="multiplayer.js?v=20260311a"></script>
```

最终加载顺序：
```
platform.js → storage.js → haptics.js → geometry.js → renderer.js → multiplayer.js → game.js
```

- [ ] **Step 3: 提交**

```bash
cd /Users/xiaotn/saolei && git add multiplayer.js index.html && git commit -m "新增前端联机模块 multiplayer.js，更新脚本加载顺序"
```

---

## Chunk 3: index.html + style.css — 界面层

### Task 4: 新增联机相关 HTML 界面

**Files:**
- Modify: `index.html`
- Modify: `style.css`

新增三个界面区块：
1. **模式选择屏**（`#modeScreen`）：主界面两张大卡片
2. **联机大厅屏**（`#lobbyScreen`）：创建房间 + 加入房间
3. **等待室屏**（`#waitingScreen`）：展示房间码，等待对方

同时改造原入口屏（`#startScreen`）：去掉「开始游戏」按钮，改为从模式选择进入。

- [ ] **Step 1: 在 `#startScreen` 之前插入模式选择屏**

在 `index.html` 的 `<body>` 开头（`<!-- 入口界面 -->` 之前）插入：

```html
    <!-- 模式选择屏 -->
    <div class="mode-screen" id="modeScreen">
        <div class="mode-container">
            <h1 class="game-title">💣 多边形扫雷</h1>
            <div class="mode-cards">
                <div class="mode-card" onclick="enterSinglePlayer()">
                    <div class="mode-icon">👤</div>
                    <div class="mode-name">单人游戏</div>
                    <div class="mode-desc">选棋盘 · 选难度 · 开始</div>
                </div>
                <div class="mode-card" onclick="enterMultiplayer()">
                    <div class="mode-icon">👥</div>
                    <div class="mode-name">双人联机</div>
                    <div class="mode-desc">合作模式 · 共同扫雷</div>
                </div>
            </div>
        </div>
    </div>
```

- [ ] **Step 2: 在 `#startScreen` 之后插入联机大厅屏和等待室屏**

在 `</div><!-- end startScreen -->` 之后（`<!-- 游戏界面 -->` 之前）插入：

```html
    <!-- 联机大厅屏 -->
    <div class="lobby-screen" id="lobbyScreen" style="display:none">
        <div class="lobby-container">
            <div class="lobby-header">
                <button class="back-btn" onclick="backToModeSelect()">← 返回</button>
                <h2>👥 双人联机</h2>
            </div>

            <div class="lobby-section">
                <div class="lobby-section-title">创建房间</div>
                <div class="setting-section">
                    <div class="section-label">棋盘形状</div>
                    <div class="shape-row">
                        <button class="side-btn mp-side-btn selected" data-sides="4" onclick="mpSelectSides(4)">正方形</button>
                        <button class="side-btn mp-side-btn" data-sides="6" onclick="mpSelectSides(6)">六边形</button>
                        <button class="side-btn mp-side-btn" data-sides="8" onclick="mpSelectSides(8)">八边形</button>
                        <button class="side-btn mp-side-btn" data-sides="3" onclick="mpSelectSides(3)">三角形</button>
                        <button class="side-btn mp-side-btn" data-sides="5" onclick="mpSelectSides(5)">五边形</button>
                        <button class="side-btn mp-side-btn" data-sides="34" onclick="mpSelectSides(34)">扭棱正方</button>
                        <button class="side-btn mp-side-btn" data-sides="36" onclick="mpSelectSides(36)">三六混合</button>
                    </div>
                </div>
                <div class="setting-section">
                    <div class="section-label">难度选择</div>
                    <div class="difficulty-row">
                        <button class="diff-btn mp-diff-btn" data-diff="easy" onclick="mpSelectDifficulty('easy')">简单</button>
                        <button class="diff-btn mp-diff-btn selected" data-diff="medium" onclick="mpSelectDifficulty('medium')">中等</button>
                        <button class="diff-btn mp-diff-btn" data-diff="hard" onclick="mpSelectDifficulty('hard')">困难</button>
                        <button class="diff-btn mp-diff-btn" data-diff="hell" onclick="mpSelectDifficulty('hell')">地狱</button>
                    </div>
                </div>
                <button class="start-btn" onclick="createRoom()">
                    <span>创建房间</span><span class="start-icon">▶</span>
                </button>
            </div>

            <div class="lobby-divider">— 或加入已有房间 —</div>

            <div class="lobby-section">
                <div class="lobby-section-title">加入房间</div>
                <div class="join-row">
                    <input class="room-code-input" id="joinCodeInput" type="text"
                           maxlength="4" placeholder="输入房间码" oninput="this.value=this.value.toUpperCase()">
                    <button class="join-btn" onclick="joinRoom()">加入</button>
                </div>
                <div class="lobby-error" id="lobbyError"></div>
            </div>
        </div>
    </div>

    <!-- 等待室屏 -->
    <div class="waiting-screen" id="waitingScreen" style="display:none">
        <div class="waiting-container">
            <div class="waiting-header">
                <button class="back-btn" onclick="cancelWaiting()">← 取消</button>
                <h2>等待对方加入</h2>
            </div>
            <div class="room-code-display">
                <div class="room-code-label">房间码</div>
                <div class="room-code-big" id="waitingRoomCode">----</div>
                <div class="room-code-hint">把这个码告诉你的朋友</div>
            </div>
            <div class="waiting-players">
                <div class="waiting-player online">
                    <div class="player-dot"></div>
                    <div class="player-label">你（已就绪）</div>
                </div>
                <div class="waiting-player offline">
                    <div class="player-dot"></div>
                    <div class="player-label" id="waitingPartnerLabel">等待中...</div>
                </div>
            </div>
        </div>
    </div>
```

- [ ] **Step 3: 改造 `#startScreen`**

将原来的 `<button class="start-btn" onclick="startGame()">` 整个按钮替换为（单人游戏直接点这里开始）：

```html
            <button class="start-btn" onclick="startGame()">
                <span>开始游戏</span>
                <span class="start-icon">▶</span>
            </button>
```

保持不变（单人流程不动），但在 `#startScreen` 的 `.start-container` 顶部添加返回按钮：

```html
            <button class="back-btn lobby-back" onclick="backToModeSelect()">← 返回</button>
```

- [ ] **Step 4: 在游戏界面 `#gameScreen` 的状态栏中添加联机状态指示器和翻格统计**

在 `<div class="game-status">` 内的末尾添加：

```html
                <span class="status-badge mp-status" id="mpStatus" style="display:none">🟢 对方在线</span>
```

在 `game-viewport` 之前（`<!-- 全屏游戏区域 -->` 之前）添加：

```html
        <!-- 联机翻格统计（合作模式时显示） -->
        <div class="mp-stats" id="mpStats" style="display:none">
            <span id="mpMyReveal">你：已翻 0 格</span>
            <span id="mpPartnerReveal">对方：已翻 0 格</span>
        </div>
```

- [ ] **Step 5: 为初始显示逻辑设置正确状态**

现有机制：`#startScreen` 用 `.hidden` class（`opacity:0; pointer-events:none`）隐藏，`#gameScreen` 用 `.active` class 显示。新增屏幕统一用 `display:none`/`display:flex` 切换（因为这些屏幕不需要过渡动画）。

在 `index.html` 中：
- `#startScreen` 的 div 标签**不需要修改**（它已经通过 CSS `.start-screen` 默认可见，由 `showStartScreen()`/`showGameScreen()` 的 `.hidden` class 控制）
- `#modeScreen` 默认显示，CSS 中 `.mode-screen { display:flex }` 即可
- `#lobbyScreen`、`#waitingScreen` 已有 `style="display:none"`（在 Step 2 已加）

**初始化时隐藏 `#startScreen`**：在 `game.js` 末尾（页面加载后）调用 `showScreen('modeScreen')` 来确保 startScreen 被 `.hidden` class 隐藏。

- [ ] **Step 6: 提交**

```bash
cd /Users/xiaotn/saolei && git add index.html && git commit -m "新增联机相关 HTML 界面：模式选择、联机大厅、等待室"
```

---

### Task 5: 新增 style.css 联机相关样式

**Files:**
- Modify: `style.css`

- [ ] **Step 1: 在 style.css 末尾追加联机相关样式**

```css
/* ── 模式选择屏 ─────────────────────────────────────── */
.mode-screen {
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-dark, #0a0a1a);
    z-index: 10;
}

.mode-container {
    display: flex; flex-direction: column; align-items: center; gap: 32px;
    padding: 24px;
}

.mode-cards {
    display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;
}

.mode-card {
    background: var(--card-bg, #1a1a2e);
    border: 2px solid var(--border-color, #2a2a4c);
    border-radius: 16px;
    padding: 28px 36px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
    min-width: 140px;
}

.mode-card:hover {
    border-color: var(--accent, #7c7cff);
    transform: translateY(-2px);
}

.mode-icon { font-size: 40px; margin-bottom: 10px; }

.mode-name {
    font-size: 18px; font-weight: bold;
    color: var(--text-primary, #eee);
    margin-bottom: 6px;
}

.mode-desc { font-size: 12px; color: var(--text-secondary, #888); }

/* ── 联机大厅屏 ─────────────────────────────────────── */
.lobby-screen {
    position: fixed; inset: 0; overflow-y: auto;
    background: var(--bg-dark, #0a0a1a);
    z-index: 10;
}

.lobby-container {
    max-width: 480px; margin: 0 auto; padding: 20px 16px 40px;
}

.lobby-header {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 24px;
}

.lobby-header h2 { margin: 0; font-size: 20px; }

.lobby-section { margin-bottom: 20px; }

.lobby-section-title {
    font-size: 13px; color: var(--text-secondary, #888);
    text-transform: uppercase; letter-spacing: 0.05em;
    margin-bottom: 10px;
}

.lobby-divider {
    text-align: center; color: var(--text-secondary, #555);
    font-size: 13px; margin: 20px 0;
}

.join-row { display: flex; gap: 10px; }

.room-code-input {
    flex: 1; background: var(--card-bg, #1a1a2e);
    border: 1px solid var(--border-color, #444);
    border-radius: 8px; padding: 12px 16px;
    font-size: 20px; letter-spacing: 6px; text-align: center;
    color: var(--text-primary, #eee); text-transform: uppercase;
    outline: none;
}

.room-code-input:focus { border-color: var(--accent, #7c7cff); }

.join-btn {
    background: var(--accent, #7c7cff); border: none; border-radius: 8px;
    padding: 12px 20px; color: #fff; font-size: 15px;
    cursor: pointer; white-space: nowrap;
}

.join-btn:hover { opacity: 0.85; }

.lobby-error {
    color: #ff6b6b; font-size: 13px; margin-top: 8px; min-height: 18px;
}

.lobby-back { margin-bottom: 16px; }

/* ── 等待室屏 ────────────────────────────────────────── */
.waiting-screen {
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-dark, #0a0a1a);
    z-index: 10;
}

.waiting-container {
    display: flex; flex-direction: column; align-items: center;
    gap: 28px; padding: 24px; max-width: 360px; width: 100%;
}

.waiting-header {
    width: 100%; display: flex; align-items: center; gap: 12px;
}

.waiting-header h2 { margin: 0; font-size: 18px; }

.room-code-display { text-align: center; }

.room-code-label {
    font-size: 13px; color: var(--text-secondary, #888);
    margin-bottom: 8px;
}

.room-code-big {
    font-size: 48px; font-weight: bold; letter-spacing: 12px;
    color: var(--text-primary, #fff); font-family: monospace;
    margin-bottom: 8px;
}

.room-code-hint { font-size: 13px; color: var(--text-secondary, #666); }

.waiting-players {
    display: flex; gap: 20px;
}

.waiting-player {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; color: var(--text-secondary, #888);
}

.player-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: #555;
}

.waiting-player.online .player-dot { background: #4eff4e; }

/* ── 游戏内联机状态 ──────────────────────────────────── */
.mp-status { transition: opacity 0.3s; }

.mp-stats {
    display: flex; gap: 12px; justify-content: center;
    padding: 6px 16px; font-size: 12px;
    color: var(--text-secondary, #888);
    background: var(--card-bg, #1a1a2e);
    border-bottom: 1px solid var(--border-color, #2a2a4c);
}

#mpMyReveal { color: #4eff4e; }
```

- [ ] **Step 2: 确认 style.css 中是否有 CSS 变量定义，若无则在前面补充**

```bash
grep -n '\-\-bg-dark\|:root' /Users/xiaotn/saolei/style.css | head -5
```

若无 `--bg-dark` 变量，直接用硬编码颜色值替换上述变量引用。

- [ ] **Step 3: 提交**

```bash
cd /Users/xiaotn/saolei && git add style.css && git commit -m "新增联机相关 CSS 样式：模式选择、大厅、等待室、游戏内状态"
```

---

## Chunk 4: game.js — 联机钩子

### Task 6: 在 game.js 中接入联机逻辑

**Files:**
- Modify: `game.js`

核心改动：
1. 新增 `mpRole`/`mpGuestLocked` 等联机状态变量
2. `initGame()` 末尾注册 `MP.onMessage` 等回调
3. `_revealCell_firstClick()` 根据角色分支：host 放雷后发 `board-init`，guest 锁定
4. `handleClick()` 插旗后发 `MP.send({ type:'flag', key })`
5. `handleRightClick()` 翻格后发 `MP.send({ type:'reveal', key })`
6. chord 操作收集翻开格子列表后发 `MP.send({ type:'chord', keys })`
7. 新增 `revealCells(keys)`、`initBoardFromRemote(mineLocations)` 函数
8. `backToMenu()` 时重置联机状态

- [ ] **Step 1: 在 game.js 顶部的状态变量区末尾（`let gameStarted = false;` 之后）新增联机状态变量**

```javascript
// ─── 联机状态 ──────────────────────────────────────────
let mpRole = null;         // 'host' | 'guest' | null
let mpGuestLocked = false; // guest 等待 board-init 时锁定交互
let mpMyRevealCount = 0;   // 本端翻格计数（近似）
let mpPartnerRevealCount = 0; // 对端翻格计数（近似）
```

- [ ] **Step 2: 新增 `revealCells(keys, fromRemote)` 函数（在 `revealCell` 函数之后）**

`fromRemote` 参数用于区分本端/远端调用，决定翻格计数归属。

```javascript
// 批量翻格（供远端 chord 消息使用）
function revealCells(keys, fromRemote) {
    for (const key of keys) {
        const [r, c] = key.split(',').map(Number);
        revealCell(r, c, fromRemote);
    }
}
```

- [ ] **Step 3: 新增 `initBoardFromRemote(mineLocationKeys)` 函数**

```javascript
// Guest 收到 board-init 后用房主的雷位初始化棋盘
function initBoardFromRemote(mineLocationKeys) {
    // mineLocationKeys 是字符串数组，如 ['3,4', '1,2']
    mineLocations = mineLocationKeys.map(k => k.split(',').map(Number));
    // 同步实际雷数（host 可能因格子不足而调整了雷数）
    totalMines = mineLocations.length;
    mineCount = totalMines;
    for (const [r, c] of mineLocations) {
        board[`${r},${c}`] = -1;
    }
    // 计算相邻数字
    for (const [r, c] of mineLocations) {
        for (const [nr, nc] of _getNeighborsCached(r, c)) {
            const nKey = `${nr},${nc}`;
            if (board[nKey] !== -1) board[nKey]++;
        }
    }
    firstClick = false;
    mpGuestLocked = false;
    _setSettingsLocked(true);
    _updateGameStatus(); // 更新旗子计数 UI
    startTimer();
}
```

- [ ] **Step 4: 修改 `_revealCell_firstClick()` 函数，Host 发送 board-init**

在 `_revealCell_firstClick` 函数中，`_placeMines(row, col)` 调用之后、`startTimer()` 之前插入：

```javascript
    // 联机模式：Host 将雷位发送给 Guest
    if (mpRole === 'host' && MP.isMultiplayer()) {
        MP.send({
            type: 'board-init',
            mineLocations: mineLocations.map(([r, c]) => `${r},${c}`)
        });
    }
```

- [ ] **Step 5: 修改 `handleClick()` — Guest 锁定 + 插旗后发 flag 消息**

在 `handleClick` 函数开头（`if (_isPanning) return;` 之后）插入：

```javascript
    // Guest 等待棋盘初始化时锁定交互
    if (mpGuestLocked) return;
```

在插旗逻辑末尾（`_updateGameStatus();` 之前）的 flagged/unflagged 两个分支各自末尾，在 `vibrate(15);` 之后插入：

```javascript
    // 联机同步
    if (MP.isMultiplayer()) MP.send({ type: 'flag', key });
```

注意：只在非 `fromRemote` 路径发送（需在 `handleClick` 末尾添加 `fromRemote` 参数支持，或通过全局标志）。

**实际做法：** 给 `handleClick` 和 `handleRightClick` 增加 `opts = {}` 参数，内部检查 `opts.fromRemote`：

```javascript
function handleClick(row, col, opts = {}) {
    if (_isPanning) return;
    const key = `${row},${col}`;
    if (gameOver) return;
    if (mpGuestLocked) return;
    // ... 原有逻辑 ...
    // 在插旗/取消旗分支末尾：
    if (MP.isMultiplayer() && !opts.fromRemote) MP.send({ type: 'flag', key });
}
```

- [ ] **Step 6: 修改 `handleRightClick()` — Guest 锁定 + 翻格后发 reveal 消息**

同上，增加 `opts = {}` 参数，在 `handleRightClick` 开头加锁定检查，在 `revealCell(row, col)` 调用之后加联机发送：

```javascript
function handleRightClick(e, row, col, opts = {}) {
    e.preventDefault();
    if (_isPanning) return;
    const key = `${row},${col}`;
    if (gameOver) return;
    if (mpGuestLocked) return;
    // ... 首次点击逻辑（含 mpRole === 'guest' 锁定）...
    // 在正常 revealCell 之后：
    if (MP.isMultiplayer() && !opts.fromRemote) MP.send({ type: 'reveal', key });
}
```

**首次点击 Guest 锁定** 需要在 `handleRightClick` 的 `if (firstClick)` 分支中加：

```javascript
    if (firstClick) {
        if (mpRole === 'guest') return; // Guest 等待 host 触发
        _revealCell_firstClick(row, col);
        return;
    }
```

同样在 `handleClick` 的 `if (firstClick)` 分支：

```javascript
    if (firstClick) {
        if (mpRole === 'guest') { mpGuestLocked = true; return; }
        _revealCell_firstClick(row, col);
        return;
    }
```

- [ ] **Step 7: 修改 chord 操作，收集翻格列表并发送**

`handleClick` 和 `handleRightClick` 中各有一处 chord 逻辑（循环 neighbors 调用 `revealCell`）。修改为：

```javascript
    // chord 操作
    if (revealed[key] && board[key] > 0) {
        const neighbors = _getNeighborsCached(row, col);
        const flaggedCount = neighbors.filter(([r, c]) => flagged[`${r},${c}`]).length;
        if (flaggedCount === board[key]) {
            startTimer();
            const chordRevealedKeys = []; // 收集本次翻开的格子
            let hitMine = false;
            let mineKey = null;
            for (const [r, c] of neighbors) {
                const nKey = `${r},${c}`;
                if (!revealed[nKey] && !flagged[nKey]) {
                    if (board[nKey] === -1) {
                        hitMine = true;
                        mineKey = nKey;
                        // 显示所有雷
                        mineLocations.forEach(([mr, mc]) => {
                            if (!flagged[`${mr},${mc}`]) setCellState(mr, mc, 'mine');
                        });
                        gameOver = true;
                        clearInterval(timerInterval);
                        vibrate([100, 50, 100]);
                        // 联机同步踩雷
                        if (MP.isMultiplayer() && !opts.fromRemote) {
                            MP.send({ type: 'reveal', key: mineKey });
                        }
                        showGameResult(false);
                        return;
                    } else {
                        revealCell(r, c);
                        chordRevealedKeys.push(nKey);
                    }
                }
            }
            if (gameOver) return;
            // 联机同步 chord 结果
            if (MP.isMultiplayer() && !opts.fromRemote && chordRevealedKeys.length > 0) {
                MP.send({ type: 'chord', keys: chordRevealedKeys });
            }
            vibrate(30);
            checkWin();
        }
        return;
    }
```

- [ ] **Step 8: 在 `initGame()` 末尾（`_buildBoard()` 之后）注册 MP 回调**

```javascript
    // 联机模式初始化
    mpMyRevealCount = 0;
    mpPartnerRevealCount = 0;
    _updateMpStats();

    if (MP.isMultiplayer()) {
        MP.onMessage = (msg) => {
            const { type, key, keys } = msg;
            if (type === 'reveal') {
                // 直接调 revealCell（BFS 可能展开多格），传 fromRemote=true 计入对方计数
                const [r, c] = key.split(',').map(Number);
                revealCell(r, c, true);
            }
            if (type === 'flag')       { handleClick(...key.split(',').map(Number), { fromRemote: true }); }
            if (type === 'chord')      { revealCells(keys, true); }
            if (type === 'board-init') { initBoardFromRemote(msg.mineLocations); }
        };
        MP.onPartnerLeft = () => {
            if (!gameOver) {
                document.getElementById('mpStatus').textContent = '⚠️ 对方已断线';
            }
        };
        MP.onPartnerRejoined = () => {
            document.getElementById('mpStatus').textContent = '🟢 对方在线';
            document.getElementById('mpStatus').style.display = '';
        };
        MP.onRoomDestroyed = () => {
            alert('房间已断开，返回主菜单');
            backToMenu();
        };
        document.getElementById('mpStatus').style.display = '';
        document.getElementById('mpStats').style.display = '';
    } else {
        document.getElementById('mpStatus').style.display = 'none';
        document.getElementById('mpStats').style.display = 'none';
    }
```

- [ ] **Step 9: 新增 `_updateMpStats()` 辅助函数，并修改 `revealCell` 签名以区分来源**

```javascript
function _updateMpStats() {
    document.getElementById('mpMyReveal').textContent = `你：已翻 ${mpMyRevealCount} 格`;
    document.getElementById('mpPartnerReveal').textContent = `对方：已翻 ${mpPartnerRevealCount} 格`;
}
```

修改 `revealCell` 函数签名，加 `fromRemote = false` 参数：

```javascript
function revealCell(row, col, fromRemote = false) {
    // ... 原有 BFS 逻辑不变 ...
    // 末尾追加（`for (const [ur, uc, value] of updates)` 循环之后）：
    if (MP.isMultiplayer() && updates.length > 0) {
        if (fromRemote) { mpPartnerRevealCount += updates.length; }
        else            { mpMyRevealCount += updates.length; }
        _updateMpStats();
    }
}
```

- [ ] **Step 10: 修改 `backToMenu()` 函数，重置联机状态并显示模式选择屏**

在 `backToMenu()` 函数内适当位置添加：

```javascript
    mpRole = null;
    mpGuestLocked = false;
    mpMyRevealCount = 0;
    mpPartnerRevealCount = 0;
    showScreen('modeScreen');
```

- [ ] **Step 11: 提交**

```bash
cd /Users/xiaotn/saolei && git add game.js && git commit -m "game.js 接入联机钩子：首次点击分支、插旗/翻格/chord 同步、远端消息处理"
```

---

## Chunk 5: UI 控制函数 + 界面切换逻辑

### Task 7: 在 game.js 中新增联机 UI 控制函数

**Files:**
- Modify: `game.js`

- [ ] **Step 1: 新增 `showScreen(id)` 辅助函数**

现有机制：`#startScreen` 用 `.hidden` class 隐藏，`#gameScreen` 用 `.active` class 显示。新增屏幕（modeScreen/lobbyScreen/waitingScreen）用 `display:none`/`display:flex` 切换。`showScreen` 统一处理：

```javascript
// ─── 界面切换 ──────────────────────────────────────────
// 新增屏幕（display 控制）
const NEW_SCREENS = ['modeScreen', 'lobbyScreen', 'waitingScreen'];

function showScreen(id) {
    // 处理新增屏幕（display 切换）
    for (const screenId of NEW_SCREENS) {
        const el = document.getElementById(screenId);
        if (el) el.style.display = screenId === id ? 'flex' : 'none';
    }
    // 处理原有屏幕（class 切换，保持原有动画效果）
    const startEl = document.getElementById('startScreen');
    const gameEl  = document.getElementById('gameScreen');
    if (id === 'startScreen') {
        startEl.classList.remove('hidden');
        gameEl.classList.remove('active');
        gameStarted = false;
    } else if (id === 'gameScreen') {
        startEl.classList.add('hidden');
        gameEl.classList.add('active');
        gameStarted = true;
    } else {
        // 其他屏幕（modeScreen/lobbyScreen/waitingScreen）显示时，隐藏原有屏幕
        startEl.classList.add('hidden');
        gameEl.classList.remove('active');
        gameStarted = false;
    }
}
```

- [ ] **Step 2: 修改 `startGame()` 和 `backToMenu()` 使用 `showScreen`**

- `startGame()` 中将 `showGameScreen()` 替换为 `showScreen('gameScreen')`
- `backToMenu()` 中将 `showStartScreen()` 替换为 `showScreen('modeScreen')`（返回模式选择，而非直接返回单人设置）

并在 `backToMenu()` 内重置联机状态：

```javascript
    mpRole = null;
    mpGuestLocked = false;
    mpMyRevealCount = 0;
    mpPartnerRevealCount = 0;
```

- [ ] **Step 3: 新增联机入口函数**

```javascript
// 进入单人流程
function enterSinglePlayer() {
    showScreen('startScreen');
}

// 进入联机大厅
function enterMultiplayer() {
    showScreen('lobbyScreen');
}

// 从大厅返回模式选择
function backToModeSelect() {
    showScreen('modeScreen');
}

// 联机大厅：形状/难度选择
let mpSides = 4;
let mpDifficulty = 'medium';

function mpSelectSides(s) {
    mpSides = s;
    document.querySelectorAll('.mp-side-btn').forEach(b => {
        b.classList.toggle('selected', parseInt(b.dataset.sides) === s);
    });
}

function mpSelectDifficulty(diff) {
    mpDifficulty = diff;
    document.querySelectorAll('.mp-diff-btn').forEach(b => {
        b.classList.toggle('selected', b.dataset.diff === diff);
    });
}

// 创建房间
async function createRoom() {
    document.getElementById('lobbyError').textContent = '';
    try {
        await MP.connect();
    } catch (e) {
        document.getElementById('lobbyError').textContent = e.message;
        return;
    }
    MP._onRoomCreated = (code) => {
        mpRole = 'host';
        document.getElementById('waitingRoomCode').textContent = code;
        document.getElementById('waitingPartnerLabel').textContent = '等待中...';
        showScreen('waitingScreen');
        MP.onPartnerJoined = () => {
            // 对方加入，用房主设置初始化游戏
            sides = mpSides;
            currentDifficulty = mpDifficulty;
            cellSize = _effectiveCellSize();
            initGame();
            showScreen('gameScreen');
        };
    };
    const preset = (DIFFICULTY_PRESETS[mpSides] || DIFFICULTY_PRESETS[4])[mpDifficulty] || [10, 10, 20];
    MP.createRoom({ sides: mpSides, difficulty: mpDifficulty, rows: preset[0], cols: preset[1], mines: preset[2] });
}

// 加入房间
async function joinRoom() {
    const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
    if (code.length !== 4) {
        document.getElementById('lobbyError').textContent = '请输入4位房间码';
        return;
    }
    document.getElementById('lobbyError').textContent = '';
    try {
        await MP.connect();
    } catch (e) {
        document.getElementById('lobbyError').textContent = e.message;
        return;
    }
    MP.onError = (errCode) => {
        const msgs = { ROOM_FULL: '房间已满', ROOM_NOT_FOUND: '房间不存在', INVALID_CODE: '房间码格式错误' };
        document.getElementById('lobbyError').textContent = msgs[errCode] || '加入失败';
    };
    MP._onRoomJoined = (msg) => {
        mpRole = 'guest';
        // 注意：不在此处设 mpGuestLocked，由 handleClick/handleRightClick 的 firstClick 分支自然处理
        const cfg = msg.config || {};
        sides = cfg.sides || 4;
        currentDifficulty = cfg.difficulty || 'medium';
        if (cfg.rows) rows = cfg.rows;
        if (cfg.cols) cols = cfg.cols;
        if (cfg.mines) { totalMines = cfg.mines; mineCount = cfg.mines; }
        cellSize = _effectiveCellSize();
        initGame();
        showScreen('gameScreen');
    };
    MP.joinRoom(code);
}

// 取消等待
function cancelWaiting() {
    MP.disconnect(); // 使用 MP 暴露的 disconnect() 方法关闭连接并重置状态
    mpRole = null;
    showScreen('modeScreen');
}
```

- [ ] **Step 4: 初始化时显示模式选择屏**

检查 `game.js` 末尾是否有 DOMContentLoaded 或其他初始化调用，若无则追加：

```javascript
// 初始显示模式选择屏
showScreen('modeScreen');
```

- [ ] **Step 5: 提交**

```bash
cd /Users/xiaotn/saolei && git add game.js && git commit -m "新增联机 UI 控制函数：界面切换、创建房间、加入房间逻辑"
```

---

## Chunk 6: 集成验证

### Task 8: 端对端手动测试

**Files:** 无需修改文件，验证集成正确性

- [ ] **Step 1: 启动服务器**

```bash
cd /Users/xiaotn/saolei && node server.js &
```

预期输出：`[server] listening on ws://localhost:8765`

- [ ] **Step 2: 用浏览器打开两个窗口访问游戏**

打开 `file:///Users/xiaotn/saolei/index.html` 或通过本地 HTTP 服务：

```bash
cd /Users/xiaotn/saolei && npx serve . -p 3000 &
```

两个浏览器窗口均访问 `http://localhost:3000`

- [ ] **Step 3: 验证模式选择屏**

检查：进入页面看到「👤 单人游戏」和「👥 双人联机」两张卡片

- [ ] **Step 4: 验证单人流程不受影响**

点「单人游戏」→ 进入原有设置界面 → 开始游戏 → 游戏正常运行，无联机元素（mpStatus/mpStats 隐藏）

- [ ] **Step 5: 验证创建房间流程**

窗口 A：点「双人联机」→「创建房间」→ 进入等待室，看到4位房间码

- [ ] **Step 6: 验证加入房间流程**

窗口 B：点「双人联机」→ 输入窗口 A 的房间码 →「加入」→ 两窗口均自动进入游戏界面

- [ ] **Step 7: 验证游戏同步**

- 窗口 A（host）右键/长按点击任意格子 → 两个窗口同步显示翻格结果
- 窗口 B 左键插旗 → 两窗口同步显示旗子
- chord 操作同步
- 顶部「🟢 对方在线」状态显示
- 底部翻格统计更新

- [ ] **Step 8: 验证错误处理**

- 窗口 B 输入不存在的房间码 → 显示「房间不存在」提示
- 第三个窗口尝试加入已满房间 → 显示「房间已满」提示

- [ ] **Step 9: 验证胜利/失败**

- 任一方踩雷 → 两个窗口均显示失败结果弹窗
- 共同揭开所有非雷格 → 两窗口均显示胜利

- [ ] **Step 10: 提交验证通过后的最终状态**

```bash
cd /Users/xiaotn/saolei && git add -A && git status
# 确认无意外文件后提交
git commit -m "双人联机合作模式集成完成，验证通过" --allow-empty
```

- [ ] **Step 11: 停止后台服务**

```bash
pkill -f "node server.js"; pkill -f "npx serve"
```

---

## 附：.gitignore 更新

- [ ] **确认 .gitignore 包含 node_modules 和 .superpowers**

```bash
grep -n 'node_modules\|superpowers' /Users/xiaotn/saolei/.gitignore || echo "需要添加"
```

若缺失，在 `.gitignore` 中添加：

```
node_modules/
.superpowers/
```

```bash
cd /Users/xiaotn/saolei && git add .gitignore && git commit -m "更新 .gitignore：排除 node_modules 和 .superpowers"
```
