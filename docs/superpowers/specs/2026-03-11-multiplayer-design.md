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
- 底部新增双方翻格统计：「你：已翻 N 格 / 对方：已翻 N 格」（本地近似计数，不保证双端完全一致）
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
- 不存储 revealed/flagged 等游戏运行状态，但缓存最新的 `board-init` 消息，断线重连时补发给重连方
- 持有断线计时器，30秒内未重连则销毁房间

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
MP.connect(url)                    // 连接服务器（异步，返回 Promise）
MP.createRoom(config)              // 发送创建请求，房间码通过 room-created 消息异步返回
MP.joinRoom(code)                  // 加入房间，结果通过 room-joined/error 消息异步返回
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
- 加载顺序：`multiplayer.js` 在 `game.js` **之前**加载（game.js 初始化时需检测 `MP` 对象）
  ```
  platform.js → storage.js → haptics.js → geometry.js → renderer.js → multiplayer.js → game.js
  ```

#### `game.js`

**新增函数 `revealCells(keys, opts)`：** 批量翻格，用于接收远端 chord 列表时调用，内部循环调用 `revealCell`，传入 `fromRemote: true` 避免再次发送。

在以下操作后触发 `MP.send()`：
- `handleClick()`（**左键 = 插旗**，符合项目约定）：同时同步 `mineCount` 增减
- `handleRightClick()`（**右键/长按 = 翻格**，符合项目约定）
- chord 操作：本地展开完成后（含踩雷判断），将实际翻开的格子列表（不含雷格）发送给对方；若 chord 过程中踩雷，额外发送 `{ type: 'reveal', key: mineKey }`，让对方同步踩雷
- 首次点击（`role === 'host'`）生成棋盘后，发送 `board-init`

联机模式下新增逻辑分支：
- `firstClick === true` 且 `role === 'guest'` → **在 `handleClick` 和 `handleRightClick` 两个入口均需检测**，锁定交互，等待 `board-init`
- `firstClick === true` 且 `role === 'host'` → 正常生成棋盘，然后发送 `board-init`

**mineCount（旗子计数）同步：** `mineCount` 通过操作同步自然保持一致——对方插旗/取消旗的 `flag` 消息到达后，本地执行 `toggleFlag`，会同步调整 `mineCount`，无需额外处理。

接收远端消息时调用对应游戏函数：
```js
MP.onMessage = (msg) => {
  const { type, key, keys } = msg;
  if (type === 'reveal')     revealCell(key, { fromRemote: true });
  if (type === 'flag')       toggleFlag(key, { fromRemote: true });
  if (type === 'chord')      revealCells(keys, { fromRemote: true });
  if (type === 'board-init') initBoardFromRemote(msg.mineLocations);
  // msg.mineLocations 是字符串数组，initBoardFromRemote 内部解析为内部格式
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
{ type: 'reveal', key: '3,4' }           // 翻格（key 格式与 geometry.js 一致：'row,col'）
{ type: 'flag',   key: '3,4' }           // 插旗/取消旗
{ type: 'chord',  keys: ['3,4','3,5'] }  // 快速开雷，携带展开后所有格子的 key 列表

// 客户端 → 服务器（房间操作）
{ type: 'create', config: { sides, difficulty, rows, cols, mines } }
{ type: 'join',   code: 'A3F7' }

// 服务器 → 客户端（系统消息）
{ type: 'room-created', code: 'A3F7', role: 'host' }
{ type: 'room-joined',  code: 'A3F7', role: 'guest', config: { sides, difficulty, rows, cols, mines } }
  // config 仅用于客户端渲染棋盘外形，不含雷位信息；实际雷位以 board-init 为准
{ type: 'partner-joined' }
{ type: 'partner-left' }
{ type: 'board-init', mineLocations: ['3,4', '1,2', ...] }
  // mineLocations：字符串数组，格式与 geometry.js 的 key 格式（'row,col'）一致

// 服务器 → 客户端（错误消息）
{ type: 'error', code: 'ROOM_FULL' }        // 房间已有2人
{ type: 'error', code: 'ROOM_NOT_FOUND' }   // 房间码不存在
{ type: 'error', code: 'INVALID_CODE' }     // 格式非法
```

### 首次点击（放雷）处理

1. **只有房主（Player 1）的首次点击触发棋盘生成**
2. Player 2 在收到 `board-init` 消息前，UI 层锁定交互（棋盘显示但不可点击），并显示「等待对方初始化...」提示
3. 房主首次点击后，按原有逻辑生成安全棋盘（`mineLocations`），然后发送：
   ```js
   { type: 'board-init', mineLocations: ['3,4', '1,2', ...] }
   ```
4. Player 2 收到 `board-init` 后用相同雷位初始化棋盘，解锁交互
5. 之后只传操作消息，双端各自执行，保持同步

### chord 操作同步

chord（快速开雷）在本地展开后，将展开的完整格子列表发送给对方，而非仅发送触发格。对方收到后直接调用 `revealCells(keys, { fromRemote: true })`，避免因双端本地状态微小差异导致展开结果不一致。

### 防重入

所有游戏函数接受可选的 `fromRemote` 标志：
- `fromRemote: true` → 执行游戏逻辑，**不**调用 `MP.send()`
- `fromRemote: false`（默认）→ 执行游戏逻辑，**并**调用 `MP.send()`

### 断线处理

- 任一方断线 → 另一方收到 `partner-left`，游戏**暂停**，显示「对方已断线，等待重连...」
- 断线方在 30 秒内重连并发送 `{ type: 'join', code: 'A3F7' }` 重新加入同一房间
- 服务器重新配对成功后，向重连方重放缓存的 `board-init` 消息（雷位信息），重连方在本地重建棋盘；由于翻格/插旗状态不缓存，双端棋盘视觉状态会有差异，这是可接受的简化行为（留言提示「已重新连接，但部分状态可能不同步」）
- 超过 30 秒未重连 → 服务器销毁房间，留守方显示「连接已断开」，回到主界面

### 错误处理（前端）

收到 `{ type: 'error' }` 消息时：
- `ROOM_FULL` → 提示「该房间已满」，返回联机大厅
- `ROOM_NOT_FOUND` → 提示「房间不存在，请检查房间码」
- `INVALID_CODE` → 提示「房间码格式错误」

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
