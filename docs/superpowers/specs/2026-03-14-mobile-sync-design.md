# 移动端同步设计文档

**日期**：2026-03-14
**状态**：待实施
**目标**：将 web 端最新游戏逻辑（含联机功能）完整同步到 Android/iOS App

---

## 背景

项目已有 Capacitor 移动端基础架构（`mobile/` 目录），但根目录 web 版持续迭代（新增联机模式、Toast、多屏幕管理、Retina 渲染支持等），导致 `mobile/src/` 落后约 538 行差异。

---

## 方案：脚本同步 + 最小改动（方案 A）

### 架构

```
根目录（web 源）          mobile/src（App 产物）
────────────────          ──────────────────────
geometry.js     ──cp──>   geometry.js
renderer.js     ──cp──>   renderer.js
game.js         ──cp──>   game.js
style.css       ──cp──>   style.css
multiplayer.js  ──cp──>   multiplayer.js
shared/         ──cp──>   shared/（整目录覆盖合并）
                          index.html        ← 独立维护，不覆盖
```

### 改动 1：multiplayer.js — WS_URL 平台判断

找到 `const WS_URL = ...` 这一行，修改为：

```js
const WS_URL = (window.Platform && window.Platform.isApp)
    ? 'wss://unsleepy-rickie-gracefully.ngrok-free.dev'
    : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
```

`window.Platform` 来自 `shared/platform.js`，在脚本加载顺序中排首位，WS_URL 求值时已可用，无时序风险。

**ngrok 地址变更维护路径**：修改 WS_URL 三元表达式 `isApp` 分支的字符串字面量，重新运行 `sync-assets.sh`，然后 `npx cap sync` 并重新打包发布 App（Capacitor 不支持热更新 JS 逻辑）。

### 改动 2：mobile/scripts/sync-assets.sh

补充 `multiplayer.js` 的复制，并确保 shared/ 整目录替换（避免遗留旧文件）：

```bash
cp "$ROOT_DIR/multiplayer.js" "$MOBILE_SRC/"
rm -rf "$MOBILE_SRC/shared" && cp -r "$ROOT_DIR/shared" "$MOBILE_SRC/"
```

注：Capacitor 桥接脚本由 `npx cap sync` 自动注入，无需手动添加任何 `capacitor.js` 标签。

### 改动 3：mobile/src/index.html 重建

**完整基于 web 版 `index.html` 重建**，仅做以下差异处理：

**viewport meta 替换为移动端专用版本**：
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

**确保以下 DOM 元素全部存在**（与 web 版保持一致）：

*顶层屏幕：*
- `#startScreen`（开始界面）
- `#gameScreen`（游戏界面）
- `#modeScreen`（模式选择屏：单人/联机入口）
- `#lobbyScreen`（联机大厅屏：房间列表、创建、输入房间码）
- `#waitingScreen`（等待室屏：等待对方加入、取消）
- `<div id="toastContainer" class="toast-container"></div>`

*gameScreen 内联机专有元素（缺失会导致 JS 报错）：*
- `#mpStatus`（对方在线状态 badge）
- `#mpStats` + `#mpMyReveal` + `#mpPartnerReveal`（联机翻格统计）
- `#restartBtn`（带 id，联机时会被隐藏）
- `#restartResultBtn`（结果弹窗内的再来一局按钮）

**脚本加载顺序**（`</body>` 前，严格按此顺序，不加 `?v=xxx` 缓存参数）：
```html
<script src="shared/platform.js"></script>
<script src="shared/storage.js"></script>
<script src="shared/haptics.js"></script>
<script src="geometry.js"></script>
<script src="renderer.js"></script>
<script src="multiplayer.js"></script>
<script src="game.js"></script>
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `multiplayer.js` | 修改 | `WS_URL` 加平台判断，App 用固定 ngrok 地址 |
| `mobile/scripts/sync-assets.sh` | 修改 | 补充 `multiplayer.js` 复制 |
| `mobile/src/index.html` | 重建 | 完整同步 web 版结构，保留移动端 meta，补全所有屏幕和 script 标签 |
| `mobile/src/` 其他文件 | 同步 | 运行脚本后自动复制（shared/ 整目录覆盖合并） |

---

## 验证清单

### 前置检查（机器可验证）

```bash
# 1. 确认 WS_URL 已加平台判断
grep -q "Platform.isApp" multiplayer.js && echo "OK" || echo "FAIL: WS_URL 未改"

# 2. 确认 sync-assets.sh 已含 multiplayer.js
grep -q "multiplayer.js" mobile/scripts/sync-assets.sh && echo "OK" || echo "FAIL: 脚本未更新"

# 3. 确认 mobile/src/index.html 含关键屏幕
grep -q "modeScreen" mobile/src/index.html && echo "OK" || echo "FAIL: index.html 未重建"
grep -q "multiplayer.js" mobile/src/index.html && echo "OK" || echo "FAIL: script 标签缺失"
grep -q "toastContainer" mobile/src/index.html && echo "OK" || echo "FAIL: toastContainer 缺失"

# 4. JS 语法检查
node --check geometry.js renderer.js game.js multiplayer.js
```

### 构建与同步

```bash
cd mobile && bash scripts/sync-assets.sh && npx cap sync
```

### 设备验证

**Android**（`npx cap open android`）：
- 七种棋盘形状切换正常
- 单人游戏完整对局（标旗、开格、胜负判定）
- 联机大厅能连接 `wss://unsleepy-rickie-gracefully.ngrok-free.dev`、创建/加入房间
- 震动反馈（Haptics）正常

**iOS**（`npx cap open ios`）：
- 同 Android 所有项
- **重点验证**：联机大厅能成功连接 ngrok WebSocket（iOS ATS 对证书链有严格要求）。若连接失败且日志报证书错误，在 `ios/App/App/Info.plist` 的 `NSExceptionDomains` 中添加 ngrok 域名白名单条目
- ngrok 地址变更时需同步发布强制更新，否则新旧版本 App 用户无法联机
- 震动走 `@capacitor/haptics`，而非 `navigator.vibrate`（iOS 不支持后者）
