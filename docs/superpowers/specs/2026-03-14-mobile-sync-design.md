# 移动端同步设计文档

**日期**：2026-03-14
**状态**：已批准
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
shared/         ──cp──>   shared/
                          index.html        ← 独立维护，不覆盖
```

### 唯一平台适配点

`multiplayer.js` 第 5 行，增加 App 环境的 ngrok 地址：

```js
const WS_URL = (window.Platform && window.Platform.isApp)
    ? 'wss://unsleepy-rickie-gracefully.ngrok-free.dev'
    : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
```

`window.Platform` 来自已有的 `shared/platform.js`，无需新增依赖。

### sync-assets.sh 改动

补充 `multiplayer.js` 的复制：

```bash
cp "$ROOT_DIR/multiplayer.js" "$MOBILE_SRC/"
```

### mobile/src/index.html 重建策略

以 web 版 `index.html` 为基础，保留移动端专用内容：

1. 移动端 viewport meta 标签（`user-scalable=no, viewport-fit=cover`）
2. Apple Web App meta 标签
3. 额外加载 `shared/platform.js` 和 `shared/haptics.js`

UI 结构、所有屏幕（modeScreen、lobbyScreen、waitingScreen）、难度预设、脚本加载顺序与 web 完全一致。

### renderer.js DPR 适配

web 版已有 Retina 屏适配（`devicePixelRatio` 缩放），直接通过 `sync-assets.sh` 复制即可，无需额外改动。

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `multiplayer.js` | 修改 | 加平台判断，App 用固定 ngrok 地址 |
| `mobile/scripts/sync-assets.sh` | 修改 | 补充 `multiplayer.js` 复制 |
| `mobile/src/index.html` | 重建 | 基于 web index.html，保留移动端 meta |
| `mobile/src/` 其他文件 | 同步 | 运行脚本后自动复制 |

---

## 验证清单

1. `node --check geometry.js renderer.js game.js multiplayer.js`
2. 运行 `mobile/scripts/sync-assets.sh`，确认所有文件复制成功
3. `cd mobile && npx cap sync`
4. Android：`npx cap open android`
   - 七种棋盘形状切换正常
   - 单人游戏完整对局（标旗、开格、胜负判定）
   - 联机大厅连接 ngrok 服务器、创建/加入房间
   - 震动反馈（Haptics）正常
5. iOS：`npx cap open ios`（同上，震动走 Haptics 而非 navigator.vibrate）
