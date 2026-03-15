# 服务端数据库设计

**日期**：2026-03-15
**状态**：待实现

## 背景

多边形扫雷游戏当前服务端（`server.js`）是纯 WebSocket 信令服务器，无任何持久化。本设计为联机对战记录添加 SQLite 持久化能力，为未来排行榜功能奠基。

## 目标

- 每局联机对战结束后，将对局数据写入数据库
- 单机游戏不入库
- 接口设计面向未来迁移云数据库（只需替换 `server/db.js` 实现）

## 架构

```
server.js          ← 现有 WebSocket 信令逻辑，改动最小
server/db.js       ← 新增：所有 SQLite 操作封装
saolei.db          ← SQLite 数据库文件（加入 .gitignore）
```

依赖：`better-sqlite3`（同步 API，无回调）

## 表结构

表名：`matches`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `room_code` | TEXT NOT NULL | 房间码（4位，联机必有） |
| `board_type` | TEXT NOT NULL | 棋盘类型（"3"/"4"/"5"/"6"/"8"/"34"/"36"） |
| `difficulty` | TEXT NOT NULL | 难度（"easy"/"medium"/"hard"/"hell"） |
| `rows` | INTEGER NOT NULL | 行数 |
| `cols` | INTEGER NOT NULL | 列数 |
| `mines` | INTEGER NOT NULL | 雷数 |
| `winner` | TEXT NOT NULL | 胜方（"host"/"guest"/"draw"） |
| `duration_seconds` | INTEGER NOT NULL | 用时（秒） |
| `host_revealed` | INTEGER NOT NULL | host 揭开格数 |
| `host_flagged` | INTEGER NOT NULL | host 标旗数 |
| `guest_revealed` | INTEGER NOT NULL | guest 揭开格数 |
| `guest_flagged` | INTEGER NOT NULL | guest 标旗数 |
| `first_click_at` | INTEGER NOT NULL | 首次点击时间戳（毫秒） |
| `host_user_id` | TEXT | 留空，未来账号系统用 |
| `guest_user_id` | TEXT | 留空，未来账号系统用 |
| `played_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 对局结束时间 |

## 对外接口（server/db.js）

```js
// 初始化数据库（建表）
db.init()

// 写入一条对局记录
db.saveMatch({
    room_code,
    board_type,
    difficulty,
    rows,
    cols,
    mines,
    winner,           // "host" | "guest" | "draw"
    duration_seconds,
    host_revealed,
    host_flagged,
    guest_revealed,
    guest_flagged,
    first_click_at,   // 毫秒时间戳
    host_user_id,     // null
    guest_user_id,    // null
})

// 查询排行（留给未来用）
db.getLeaderboard({ board_type, difficulty, limit })
```

## 数据流

```
前端 host/guest 发送 game-over 消息（携带对局统计数据）
        ↓
server.js 收到，转发给对方
        ↓
server.js 调用 db.saveMatch(从消息中提取字段)
        ↓
server/db.js 同步写入 SQLite
```

前端在 `game-over` 消息中需新增字段：
- `difficulty`
- `duration_seconds`
- `host_revealed` / `host_flagged`
- `guest_revealed` / `guest_flagged`
- `first_click_at`

## 不在本次范围内

- 用户账号/登录系统
- 排行榜展示 UI
- 单机游戏记录
- 云数据库迁移
