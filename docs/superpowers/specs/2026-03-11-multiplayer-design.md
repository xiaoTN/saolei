# 双人联机合作模式 设计文档

> 创建日期：2026-03-11

## 概述

在现有多边形扫雷游戏基础上，新增双人联机合作模式。两人共享同一棋盘，协作完成扫雷。先实现本地/局域网版本（本地 Node.js WebSocket 服务器），后续可平滑迁移至公网服务器。

---

## 用户体验流程

### 1. 主界面改版

原入口界面（直接展示棋盘/难度设置）改为先选模式：

- 展示两张大卡片：**👤 单人游戏** / **👥 双人联机**
- 点「单人游戏」→ 进入原有设置界面（棋盘形状、难度、自定义）
- 点「双人联机」→ 进入联机大厅

### 2. 联机大厅

两个区块：

**创建房间：**
- 选择棋盘形状、难度（与单人相同的控件）
- 点「创建」→ 连接 WebSocket 服务器，生成4位房间码（如 `A3F7`），进入等待室

**加入房间：**
- 输入4位房间码
- 点「加入」→ 连接服务器，验证房间码，进入等待室

### 3. 等待室

- 大字展示房间码（供房主告知对方）
- 显示双方连接状态（己方 🟢 在线 / 对方 ⏳ 等待中）
- 对方加入后自动跳转进入游戏

### 4. 游戏界面（合作模式）

在原有游戏界面基础上：
- 顶部状态栏新增「🟢 对方在线」连接状态指示
- 底部新增双方翻格统计：「你：已翻 N 格 / 对方：已翻 N 格」
- 共享同一棋盘，双方均可翻格和插旗
- 任意一方踩雷 → 游戏失败（共享生命，默认无额外生命机制）
- 共同揭开所有非雷格 → 游戏胜利

---

## 架构设计

### 新增文件

#### `server.js` — 本地 WebSocket 信令服务器

职责：
- 管理房间码 → 房间成员映射
- 转发消息：Player1 的消息转给 Player2，反之亦然
- 不存储任何游戏状态（纯中转）

技术选型：Node.js 原生 `ws` 包，约 80 行

启动方式：
```bash
node server.js
# 默认监听 ws://localhost:8765
```

#### `multiplayer.js` — 前端联机模块

职责：
- Transport 抽象层（封装 WebSocket，后续可切换）
- 房间管理（创建/加入/等待）
- 消息收发接口

核心接口：
```js
MP.connect(url)                    // 连接服务器
MP.createRoom(config)              // 创建房间，返回房间码
MP.joinRoom(code)                  // 加入房间
MP.send({ type, key, ... })        // 发送操作
MP.onMessage = (msg) => {}         // 接收远端操作
MP.onPartnerJoined = () => {}      // 对方加入回调
MP.onPartnerLeft = () => {}        // 对方断开回调
```

### 修改文件

#### `index.html`

- 新增主界面模式选择区（两张大卡片）
- 新增联机大厅界面（创建/加入房间）
- 新增等待室界面
- 游戏界面顶部新增联机状态栏
- 加载顺序末尾追加 `multiplayer.js`

#### `game.js`

在以下操作后触发 `MP.send()`：
- `handleClick()`（插旗）
- `handleRightClick()`（翻格）
- chord 操作

接收远端消息时调用对应游戏函数，传入 `fromRemote: true` 标志，跳过再次发送：
```js
MP.onMessage = ({ type, key }) => {
  if (type === 'reveal') revealCell(key, { fromRemote: true });
  if (type === 'flag')   toggleFlag(key, { fromRemote: true });
  if (type === 'chord')  chordCell(key, { fromRemote: true });
};
```

#### `style.css`

新增：
- 主界面模式选择卡片样式
- 联机大厅布局样式
- 等待室样式（房间码大字展示）
- 联机状态指示器样式
- 双方翻格统计样式

---

## 状态同步协议

### 消息类型

```js
// 客户端 → 服务器 → 对方客户端
{ type: 'reveal', key: 'r3c4' }          // 翻格
{ type: 'flag',   key: 'r3c4' }          // 插旗/取消旗
{ type: 'chord',  key: 'r3c4' }          // 快速开雷

// 服务器 → 客户端（系统消息）
{ type: 'room-created', code: 'A3F7', role: 'host' }
{ type: 'room-joined',  code: 'A3F7', role: 'guest', config: { sides, difficulty, ... } }
{ type: 'partner-joined' }
{ type: 'partner-left' }
```

### 首次点击（放雷）处理

1. 房主（Player 1）首次点击后，按原有逻辑生成安全棋盘（`mineLocations`）
2. 房主通过 WebSocket 把 `mineLocations` 发给 Player 2：
   ```js
   { type: 'board-init', mineLocations: [...] }
   ```
3. Player 2 用相同雷位初始化棋盘
4. 之后只传操作消息，双端各自执行，保持同步

### 防重入

所有游戏函数接受可选的 `fromRemote` 标志：
- `fromRemote: true` → 执行游戏逻辑，**不**调用 `MP.send()`
- `fromRemote: false`（默认）→ 执行游戏逻辑，**并**调用 `MP.send()`

---

## 分支策略

在新分支 `feature/multiplayer` 上开发，完成后合并回 `main`。

---

## 后续扩展路径（Phase 2）

将 `server.js` 部署到公网服务器，前端 `multiplayer.js` 中把：
```js
const WS_URL = 'ws://localhost:8765';
```
改为：
```js
const WS_URL = 'wss://your-server.com';
```
上层逻辑无需改动。

---

## 不在本期范围内

- 角色分工（翻格/插旗分工）
- 视野迷雾
- 抢地盘对战模式
- 公网服务器部署
- 账号/登录系统
- 移动端 App 联机（仅 Web 浏览器）
