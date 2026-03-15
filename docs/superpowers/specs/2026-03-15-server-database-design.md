# 服务端数据库设计

**日期**：2026-03-15
**状态**：待实现

## 背景

多边形扫雷游戏当前服务端（`server.js`）是纯 WebSocket 信令服务器，无任何持久化。本设计为联机对战记录添加 SQLite 持久化能力，为未来排行榜功能奠基。

## 目标

- 每局联机对战正常结束后，将对局数据写入数据库
- 单机游戏不入库
- 接口设计面向未来迁移云数据库（只需替换 `server/db.js` 实现）

## 架构

```
server.js          ← 现有 WebSocket 信令逻辑，改动最小
server/db.js       ← 新增：所有 SQLite 操作封装
saolei.db          ← SQLite 数据库文件（加入 .gitignore）
```

依赖：`better-sqlite3`（同步 API，无回调）

## 联机胜负流程说明

理解写库触发时机的前提：

- **正常结束**：A 踩雷 → A 的 `board[key] === -1` → A 发 `reveal` 消息 → 服务端转发给 B → B 本地判断对方踩雷，调 `showGameResult(false)` 显示结束画面
- `showGameResult(true)`（"你赢了"）仅由 `checkWin()` 触发，即双方合作把所有格子翻完、无人踩雷时才出现（极罕见）
- **踩雷方**是唯一能可靠触发写库的时机；`checkWin()` 场景下无法判断胜方，不入库

## 表结构

表名：`matches`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `room_code` | TEXT NOT NULL | 房间码（4位，联机必有） |
| `board_type` | TEXT NOT NULL | 棋盘类型，取值为 `String(room.config.sides)`，如 "3"/"4"/"6" 等 |
| `difficulty` | TEXT NOT NULL | 难度（"easy"/"medium"/"hard"/"hell"/"custom"） |
| `rows` | INTEGER NOT NULL | 行数 |
| `cols` | INTEGER NOT NULL | 列数 |
| `mines` | INTEGER NOT NULL | 雷数 |
| `winner` | TEXT NOT NULL | 胜方（"host"/"guest"），无平局 |
| `duration_seconds` | INTEGER NOT NULL | 用时（秒，`Math.floor`），服务端计算 |
| `loser_revealed` | INTEGER NOT NULL | 踩雷方揭开格数（随 game-over 消息上报，仅统计用途） |
| `first_click_at` | INTEGER NOT NULL | 服务端收到首个 board-init 的时间戳（毫秒，近似值，含网络延迟） |
| `host_user_id` | TEXT | 留空，未来账号系统用 |
| `guest_user_id` | TEXT | 留空，未来账号系统用 |
| `played_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 对局结束时间 |

索引：
```sql
CREATE INDEX idx_board_difficulty ON matches (board_type, difficulty, duration_seconds);
-- room_code 索引留作未来需求（查询某房间历史对局）
```

**字段说明：**
- `board_type`：从 `room.config.sides`（Number）转字符串，如 `String(6)` → `"6"`
- `winner`：仅由 `result: 'lose'` 推断，发送方为输方，另一方为胜方
- `duration_seconds`：`Math.floor((Date.now() - room.firstClickAt) / 1000)`，写库时计算
- `first_click_at`：first-write-wins，为近似值（含网络延迟）
- `loser_revealed`：踩雷方自报的翻格数，从 game-over 消息中取，仅展示用
- `difficulty: "custom"`：入库但排行榜查询时可按需过滤，不与预设难度混排

## 对外接口（server/db.js）

```js
// 初始化数据库（建表、建索引）
db.init()

// 写入一条对局记录
db.saveMatch({
    room_code,        // ws._roomCode
    board_type,       // String(room.config.sides)
    difficulty,       // room.config.difficulty
    rows,             // room.config.rows
    cols,             // room.config.cols
    mines,            // room.config.mines
    winner,           // 服务端推断："host" | "guest"
    duration_seconds, // Math.floor((Date.now() - room.firstClickAt) / 1000)
    loser_revealed,   // msg.revealedCount（来自 game-over 消息）
    first_click_at,   // room.firstClickAt
})

// 查询排行（留给未来用）
db.getLeaderboard({ board_type, difficulty, limit })
```

## 服务端 room 对象新增字段

```js
// create 时初始化，restart 时重置
room = {
    // 现有字段...
    firstClickAt: null, // 首个 board-init 到达的时间戳
    matchSaved: false,  // 防止重复写库
}
```

**restart 时必须重置：**
```js
room.matchSaved = false;
room.firstClickAt = null;
```

## 数据流与信任模型

**服务端自行维护或计算（不信任客户端）：**
- `room_code`：从 `ws._roomCode` 取
- `winner`：根据谁发了 `result: 'lose'` 推断对方为胜者
- `duration_seconds`：服务端计算
- `first_click_at`：收到 `board-init` 时 first-write-wins 记录

**客户端上报（仅统计用，不影响胜负）：**
- `revealedCount`：踩雷方在 `game-over` 消息中携带，存为 `loser_revealed`

**game-over 消息处理流程：**

```
收到 { type: 'game-over', result: 'lose', revealedCount } 消息
    ↓
1. 转发消息给对方（对方前端据此显示结束画面）
    ↓
2. 若 !room.matchSaved 且 room.firstClickAt 已设置：
   - winner = (ws._role === 'host') ? 'guest' : 'host'
   - db.saveMatch({ ..., loser_revealed: msg.revealedCount ?? 0 })
   - room.matchSaved = true
```

**board-init 处理：**
```js
if (!room.firstClickAt) {
    room.firstClickAt = Date.now(); // first-write-wins，忽略后续重复到达
}
```

## 前端变更（新增发送逻辑）

只需在**踩雷时**发送 game-over 消息（`showGameResult(false)` 调用处）：

```js
if (window.MP && window.MP.connected) {
    MP.send({ type: 'game-over', result: 'lose', revealedCount: mpMyRevealCount });
}
```

无需发送 `result: 'win'`——胜方通过收到对方的 `reveal`（mine）消息已得知结果，服务端也可直接推断胜者。

## 断线/中断处理

| 场景 | 处理方式 |
|------|---------|
| 对局尚未开始（guest 未加入）断线 | 不入库 |
| 对局进行中一方断线 | 不入库（`matchSaved` 为 false，close 事件不触发写库） |
| 对局正常结束后断线 | 已写库，不受影响 |

## 不在本次范围内

- 用户账号/登录系统
- 排行榜展示 UI
- 单机游戏记录
- 云数据库迁移
- 断线重连与续局
- `checkWin()` 场景（双方合作翻完所有格，无人踩雷）：无法判断胜方，不入库
