# 服务端数据库 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为联机对战添加 SQLite 持久化，每局踩雷结束后将对局记录写入数据库。

**Architecture:** 新增 `server/db.js` 封装所有 SQLite 操作（better-sqlite3，同步 API）。`server.js` 最小化改动：board-init 时记录计时起点，收到 `game-over` 消息时写库。`game.js` 在本端踩雷的三处位置发送 `game-over` 消息。

**Tech Stack:** Node.js, better-sqlite3, Node.js built-in test runner (`node --test`)

**Spec:** `docs/superpowers/specs/2026-03-15-server-database-design.md`

---

## Chunk 1: 环境准备 + server/db.js

### Task 1: 安装依赖，修复 .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

**注意：** 现有 `.gitignore` 中有 `server/` 规则（整个目录排除），会导致 `server/db.js` 无法被 git 追踪。需要先删除该规则。

- [ ] **Step 1: 安装 better-sqlite3**

```bash
npm install better-sqlite3
```

Expected: `package.json` 的 `dependencies` 中出现 `"better-sqlite3": "^x.x.x"`

- [ ] **Step 2: 验证依赖安装成功**

```bash
node -e "require('better-sqlite3'); console.log('ok')"
```

Expected: 输出 `ok`

- [ ] **Step 3: 修复 .gitignore**

将 `.gitignore` 中的 `server/` 规则删除，并添加数据库文件排除：

找到：
```
# 服务端临时文件
server/
```

替换为：
```
# 数据库文件
saolei.db
saolei.db-shm
saolei.db-wal
```

- [ ] **Step 4: 确认 server/db.js 将来可被追踪**

```bash
echo "server/db.js" | git check-ignore --stdin
```

Expected: 无输出（表示该路径不被忽略）

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: 安装 better-sqlite3，修复 .gitignore 移除 server/ 排除规则"
```

---

### Task 2: 创建 server/db.js

**Files:**
- Create: `server/db.js`
- Create: `tests/unit/db.test.js`

**背景知识：**
- `better-sqlite3` 是同步 API，无需 async/await
- `db.prepare(sql).run(...values)` 执行写操作
- `db.prepare(sql).all(...values)` 执行读操作，返回数组
- 用 `:memory:` 路径可创建内存数据库（测试专用）

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/db.test.js`：

```js
'use strict';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// 每个 test 用独立内存数据库，避免状态共享
function createDb() {
    const Database = require('better-sqlite3');
    const sqlite = new Database(':memory:');
    const db = require('../../server/db');
    db._initWithDb(sqlite);
    return { db, sqlite };
}

describe('db.saveMatch', () => {
    let db, sqlite;

    afterEach(() => { if (sqlite) { sqlite.close(); sqlite = null; } });

    test('写入一条记录后可查询到', () => {
        ({ db, sqlite } = createDb());
        db.saveMatch({
            room_code: 'ABCD',
            board_type: '6',
            difficulty: 'hard',
            rows: 20,
            cols: 20,
            mines: 84,
            winner: 'host',
            duration_seconds: 137,
            loser_revealed: 42,
            first_click_at: Date.now() - 137000,
        });
        const rows = db.getLeaderboard({ board_type: '6', difficulty: 'hard', limit: 10 });
        assert.equal(rows.length, 1);
        assert.equal(rows[0].room_code, 'ABCD');
        assert.equal(rows[0].winner, 'host');
        assert.equal(rows[0].loser_revealed, 42);
    });

    test('多次调用 saveMatch 均可成功写入', () => {
        ({ db, sqlite } = createDb());
        db.saveMatch({ room_code: 'AA11', board_type: '4', difficulty: 'easy', rows: 9, cols: 9, mines: 10, winner: 'guest', duration_seconds: 60, loser_revealed: 5, first_click_at: Date.now() - 60000 });
        db.saveMatch({ room_code: 'BB22', board_type: '4', difficulty: 'easy', rows: 9, cols: 9, mines: 10, winner: 'host',  duration_seconds: 90, loser_revealed: 8, first_click_at: Date.now() - 90000 });
        const rows = db.getLeaderboard({ board_type: '4', difficulty: 'easy', limit: 10 });
        assert.equal(rows.length, 2);
    });

    test('getLeaderboard 按 duration_seconds 升序排列', () => {
        ({ db, sqlite } = createDb());
        const base = { room_code: 'XX99', board_type: '6', difficulty: 'hard', rows: 20, cols: 20, mines: 84, winner: 'host', loser_revealed: 10, first_click_at: Date.now() - 200000 };
        db.saveMatch({ ...base, room_code: 'CC33', duration_seconds: 200 });
        db.saveMatch({ ...base, room_code: 'DD44', duration_seconds: 50  });
        db.saveMatch({ ...base, room_code: 'EE55', duration_seconds: 120 });
        const rows = db.getLeaderboard({ board_type: '6', difficulty: 'hard', limit: 10 });
        assert.equal(rows[0].duration_seconds, 50);
        assert.equal(rows[1].duration_seconds, 120);
        assert.equal(rows[2].duration_seconds, 200);
    });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
node --test tests/unit/db.test.js
```

Expected: FAIL，报错 `Cannot find module '../../server/db'`

- [ ] **Step 3: 实现 server/db.js**

创建 `server/db.js`：

```js
'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'saolei.db');

let _db = null;

function _getDb() {
    if (!_db) {
        _db = new Database(DB_PATH);
        _initSchema(_db);
    }
    return _db;
}

// 测试专用：注入外部 db 实例（内存数据库）
function _initWithDb(sqlite) {
    _db = sqlite;
    _initSchema(_db);
}

function _initSchema(sqlite) {
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS matches (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code        TEXT NOT NULL,
            board_type       TEXT NOT NULL,
            difficulty       TEXT NOT NULL,
            rows             INTEGER NOT NULL,
            cols             INTEGER NOT NULL,
            mines            INTEGER NOT NULL,
            winner           TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL,
            loser_revealed   INTEGER NOT NULL,
            first_click_at   INTEGER NOT NULL,
            host_user_id     TEXT,
            guest_user_id    TEXT,
            played_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_board_difficulty
            ON matches (board_type, difficulty, duration_seconds);
    `);
}

function init() {
    _getDb();
}

function saveMatch(match) {
    if (match.duration_seconds < 0) {
        console.warn(`[db] saveMatch: 异常 duration_seconds=${match.duration_seconds}，room=${match.room_code}`);
    }
    const db = _getDb();
    const stmt = db.prepare(`
        INSERT INTO matches
            (room_code, board_type, difficulty, rows, cols, mines,
             winner, duration_seconds, loser_revealed, first_click_at)
        VALUES
            (@room_code, @board_type, @difficulty, @rows, @cols, @mines,
             @winner, @duration_seconds, @loser_revealed, @first_click_at)
    `);
    stmt.run(match);
}

function getLeaderboard({ board_type, difficulty, limit = 20 } = {}) {
    const db = _getDb();
    const stmt = db.prepare(`
        SELECT * FROM matches
        WHERE board_type = @board_type AND difficulty = @difficulty
        ORDER BY duration_seconds ASC
        LIMIT @limit
    `);
    return stmt.all({ board_type, difficulty, limit });
}

module.exports = { init, saveMatch, getLeaderboard, _initWithDb };
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
node --test tests/unit/db.test.js
```

Expected: 3 个测试全部 PASS

- [ ] **Step 5: 确认语法**

```bash
node --check server/db.js
```

Expected: 无输出

- [ ] **Step 6: Commit**

```bash
git add server/db.js tests/unit/db.test.js
git commit -m "feat: 新增 server/db.js，封装 SQLite 对局记录读写"
```

---

## Chunk 2: 修改 server.js

### Task 3: 在 server.js 中集成 db，处理 board-init 和 game-over

**Files:**
- Modify: `server.js`

**需要了解的现有代码：**

- 第 99 行：`rooms.set(code, { host, guest, config, boardInit, hostReady, guestReady, createdAt })`
  → 需在此处新增 `firstClickAt: null, matchSaved: false`
- 第 150-157 行：`ready-restart` 处理，广播 `restart` 时需重置 room 状态
- 第 162-163 行：`board-init` 缓存处 → 需新增 `firstClickAt` 记录
- 第 166-167 行：消息转发出口 → game-over 需在此之前拦截处理

- [ ] **Step 1: 写失败测试**

`server.js` 是 WebSocket 服务，不直接单元测试。在 `tests/unit/db.test.js` 末尾追加对 duration 警告的测试：

```js
describe('db.saveMatch 参数校验', () => {
    let db, sqlite;
    afterEach(() => { if (sqlite) { sqlite.close(); sqlite = null; } });

    test('duration_seconds 为负数时打印警告并仍可写入', () => {
        ({ db, sqlite } = createDb());
        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));
        db.saveMatch({
            room_code: 'ZZZZ', board_type: '4', difficulty: 'easy',
            rows: 9, cols: 9, mines: 10, winner: 'host',
            duration_seconds: -1, loser_revealed: 0,
            first_click_at: Date.now(),
        });
        console.warn = origWarn;
        assert.ok(warnings.some(w => w.includes('duration')), '应有 duration 警告日志');
        const rows = db.getLeaderboard({ board_type: '4', difficulty: 'easy', limit: 5 });
        assert.equal(rows.length, 1);
    });
});
```

```bash
node --test tests/unit/db.test.js
```

Expected: PASS（告警逻辑已在 Task 2 的 `server/db.js` 实现中包含，测试应直接通过）

- [ ] **Step 2: 修改 server.js — 顶部引入 db**

在 `server.js` 第 1 行之后（`const { WebSocketServer } = require('ws');` 之后）添加：

```js
const db = require('./server/db');
db.init();
```

- [ ] **Step 3: 修改 server.js — create 时初始化新字段**

找到第 99 行：
```js
rooms.set(code, { host: ws, guest: null, config: msg.config || null, boardInit: null, hostReady: false, guestReady: false, createdAt: Date.now() });
```

替换为：
```js
rooms.set(code, { host: ws, guest: null, config: msg.config || null, boardInit: null, hostReady: false, guestReady: false, createdAt: Date.now(), firstClickAt: null, matchSaved: false });
```

- [ ] **Step 4: 修改 server.js — restart 时重置新字段**

找到第 150-157 行的 restart 广播处：
```js
if (fwdRoom.hostReady && fwdRoom.guestReady) {
    // 双方都准备好，广播 restart 并重置状态
    fwdRoom.hostReady = false;
    fwdRoom.guestReady = false;
    send(fwdRoom.host, { type: 'restart' });
    send(fwdRoom.guest, { type: 'restart' });
    console.log(`[room] ${fwdCode} restart confirmed`);
}
```

替换为：
```js
if (fwdRoom.hostReady && fwdRoom.guestReady) {
    // 双方都准备好，广播 restart 并重置状态
    fwdRoom.hostReady = false;
    fwdRoom.guestReady = false;
    fwdRoom.firstClickAt = null;
    fwdRoom.matchSaved = false;
    send(fwdRoom.host, { type: 'restart' });
    send(fwdRoom.guest, { type: 'restart' });
    console.log(`[room] ${fwdCode} restart confirmed`);
}
```

- [ ] **Step 5: 修改 server.js — board-init 时记录 firstClickAt**

找到第 162-163 行：
```js
// 缓存 board-init 消息
if (msg.type === 'board-init') {
    fwdRoom.boardInit = msg;
}
```

替换为：
```js
// 缓存 board-init 消息，记录首次点击时间（first-write-wins）
if (msg.type === 'board-init') {
    fwdRoom.boardInit = msg;
    if (!fwdRoom.firstClickAt) {
        fwdRoom.firstClickAt = Date.now();
    }
}
```

- [ ] **Step 6: 修改 server.js — 处理 game-over 消息**

找到第 162 行 `if (msg.type === 'board-init')` 块之后、第 166 行 `const partner = getPartner(...)` 之前，插入：

```js
// 处理 game-over：踩雷方上报，服务端写库
if (msg.type === 'game-over' && msg.result === 'lose') {
    if (!fwdRoom.matchSaved && fwdRoom.firstClickAt && fwdRoom.config) {
        const winner = ws._role === 'host' ? 'guest' : 'host';
        const duration_seconds = Math.floor((Date.now() - fwdRoom.firstClickAt) / 1000);
        try {
            db.saveMatch({
                room_code:        fwdCode,
                board_type:       String(fwdRoom.config.sides),
                difficulty:       fwdRoom.config.difficulty || 'custom',
                rows:             fwdRoom.config.rows,
                cols:             fwdRoom.config.cols,
                mines:            fwdRoom.config.mines,
                winner,
                duration_seconds,
                loser_revealed:   msg.revealedCount ?? 0,
                first_click_at:   fwdRoom.firstClickAt,
            });
            fwdRoom.matchSaved = true;
            console.log(`[db] ${fwdCode} match saved, winner=${winner}, duration=${duration_seconds}s`);
        } catch (e) {
            console.error('[db] saveMatch failed:', e);
        }
    }
    // 不 return，让 game-over 消息继续向下转发给对方（对方前端可据此做扩展处理）
}
```

- [ ] **Step 7: 确认语法**

```bash
node --check server.js
```

Expected: 无输出

- [ ] **Step 8: Commit**

```bash
git add server.js
git commit -m "feat: server.js 集成数据库，board-init 计时，game-over 写库"
```

---

## Chunk 3: 修改 game.js，发送 game-over 消息

### Task 4: 在踩雷的三处位置发送 game-over

**Files:**
- Modify: `game.js`

**需要了解的现有代码（三处踩雷位置）：**

1. **第 833-836 行**（handleRightClick chord 踩雷）：
```js
if (MP.isMultiplayer() && !opts.fromRemote) {
    MP.send({ type: 'reveal', key: nKey });
}
showGameResult(false);
```

2. **第 909-912 行**（handleClick chord 踩雷）：
```js
if (MP.isMultiplayer() && !opts.fromRemote) {
    MP.send({ type: 'reveal', key: nKey });
}
showGameResult(false);
```

3. **第 946-947 行**（直接踩雷）：
```js
if (MP.isMultiplayer() && !opts.fromRemote) MP.send({ type: 'reveal', key });
showGameResult(false);
```

**规则：** 只在 `MP.isMultiplayer() && !opts.fromRemote` 条件下发送（单机不发，对方消息触发的不发）。

- [ ] **Step 1: 修改第一处（handleRightClick chord，第 832-836 行，有 vibrate）**

找到（包含 vibrate 行以唯一定位，避免与下方第二处混淆）：
```js
                        vibrate([100, 50, 100]);
                        if (MP.isMultiplayer() && !opts.fromRemote) {
                            MP.send({ type: 'reveal', key: nKey });
                        }
                        showGameResult(false);
```

替换为：
```js
                        vibrate([100, 50, 100]);
                        if (MP.isMultiplayer() && !opts.fromRemote) {
                            MP.send({ type: 'reveal', key: nKey });
                            MP.send({ type: 'game-over', result: 'lose', revealedCount: mpMyRevealCount });
                        }
                        showGameResult(false);
```

- [ ] **Step 2: 修改第二处（handleClick chord，第 908-912 行，无 vibrate）**

找到（此处无 vibrate 行，与第一处不同；缩进层级与代码实际一致，位于双重循环内约 24 个空格缩进）：
```js
                        if (MP.isMultiplayer() && !opts.fromRemote) {
                            MP.send({ type: 'reveal', key: nKey });
                        }
                        showGameResult(false);
```

替换为：
```js
                        if (MP.isMultiplayer() && !opts.fromRemote) {
                            MP.send({ type: 'reveal', key: nKey });
                            MP.send({ type: 'game-over', result: 'lose', revealedCount: mpMyRevealCount });
                        }
                        showGameResult(false);
```

- [ ] **Step 3: 修改第三处（直接踩雷，第 946-947 行）**

找到：
```js
        if (MP.isMultiplayer() && !opts.fromRemote) MP.send({ type: 'reveal', key });
        showGameResult(false);
```

替换为：
```js
        if (MP.isMultiplayer() && !opts.fromRemote) {
            MP.send({ type: 'reveal', key });
            MP.send({ type: 'game-over', result: 'lose', revealedCount: mpMyRevealCount });
        }
        showGameResult(false);
```

- [ ] **Step 4: 确认语法**

```bash
node --check game.js
```

Expected: 无输出

- [ ] **Step 5: 运行全部单元测试，确认无回归**

```bash
npm test
```

Expected: 所有测试 PASS

- [ ] **Step 6: Commit**

```bash
git add game.js
git commit -m "feat: 联机踩雷时发送 game-over 消息给服务端"
```

---

## 手工验证清单

完成以上所有任务后，手工验证：

1. 启动服务：`node server.js`
2. 打开两个浏览器标签页，均访问 `http://localhost:8765`
3. 一个标签页创建房间，另一个加入
4. 开局后，其中一方故意踩雷
5. 验证：`ls -la saolei.db`（数据库文件已创建）
6. 验证数据写入：
   ```bash
   node -e "const db = require('./server/db'); db.init(); console.log(db.getLeaderboard({ board_type: '4', difficulty: 'easy', limit: 5 }))"
   ```
   Expected: 打印出包含刚才对局数据的数组
7. 再来一局，踩雷，确认数据库中有两条记录
8. 点击 restart，再踩雷，确认第三条记录正常写入（restart 重置验证）
