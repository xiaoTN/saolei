# 移动端同步 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 web 端最新游戏逻辑（含联机功能）完整同步到 Android/iOS App

**Architecture:** 方案 A——脚本同步 + 最小改动。修改 `multiplayer.js` 加入平台判断（App 用固定 ngrok 地址），更新 `sync-assets.sh` 补充 `multiplayer.js` 复制，重建 `mobile/src/index.html` 以与 web 版结构完全一致。

**Tech Stack:** HTML/CSS/JS（原生，无构建工具），Capacitor 6，Android/iOS

---

## Chunk 1: 改动源文件

### Task 1: 修改 multiplayer.js — WS_URL 平台判断

**Files:**
- Modify: `multiplayer.js:5`

- [ ] **Step 1: 确认当前 WS_URL 代码**

```bash
grep -n "WS_URL" multiplayer.js
```

预期输出：第 5 行 `const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;`

- [ ] **Step 2: 修改 WS_URL，加入平台判断**

将 `multiplayer.js` 第 5 行替换为：

```js
const WS_URL = (window.Platform && window.Platform.isApp)
    ? 'wss://unsleepy-rickie-gracefully.ngrok-free.dev'
    : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
```

- [ ] **Step 3: 语法检查**

```bash
node --check multiplayer.js
```

预期：无输出（无错误）

- [ ] **Step 4: 验证改动**

```bash
grep -q "Platform.isApp" multiplayer.js && echo "OK" || echo "FAIL"
```

预期：`OK`

- [ ] **Step 5: Commit**

```bash
git add multiplayer.js
git commit -m "feat: multiplayer.js 加入 App 平台 WS_URL 判断，连接固定 ngrok 地址"
```

---

### Task 2: 更新 sync-assets.sh

**Files:**
- Modify: `mobile/scripts/sync-assets.sh`

- [ ] **Step 1: 确认当前脚本内容**

```bash
cat mobile/scripts/sync-assets.sh
```

确认第 15 行是 `cp -r "$ROOT_DIR/shared" "$MOBILE_SRC/"`，且没有 `multiplayer.js` 的复制。

- [ ] **Step 2: 更新脚本**

在 `cp "$ROOT_DIR/game.js" "$MOBILE_SRC/"` 这一行之后，替换整个 shared 目录复制部分为以下内容：

```bash
cp "$ROOT_DIR/multiplayer.js" "$MOBILE_SRC/"

# 复制 shared 目录（先删除再复制，确保无遗留旧文件）
rm -rf "$MOBILE_SRC/shared" && cp -r "$ROOT_DIR/shared" "$MOBILE_SRC/"
```

- [ ] **Step 3: 验证脚本已更新且语法正确**

```bash
grep -q "multiplayer.js" mobile/scripts/sync-assets.sh && echo "内容OK" || echo "FAIL"
bash -n mobile/scripts/sync-assets.sh && echo "语法OK" || echo "语法错误"
```

预期：两行均输出 OK

- [ ] **Step 4: Commit**

```bash
git add mobile/scripts/sync-assets.sh
git commit -m "chore: sync-assets.sh 补充 multiplayer.js 复制，shared/ 改为先删后复制"
```

---

### Task 3: 重建 mobile/src/index.html

**Files:**
- Modify: `mobile/src/index.html`

目标：与根目录 `index.html` 完全一致，但脚本标签不带 `?v=xxx` 缓存参数（Capacitor WebView 不需要）。

- [ ] **Step 1: 将 mobile/src/index.html 重建为以下内容**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>多边形扫雷</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
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

    <!-- 入口界面 -->
    <div class="start-screen" id="startScreen">
        <div class="start-container">
            <button class="back-btn lobby-back" onclick="backToModeSelect()">← 返回</button>
            <h1 class="game-title">💣 多边形扫雷</h1>

            <div class="settings-card">
                <div class="setting-section">
                    <div class="section-label">棋盘形状</div>
                    <div class="shape-row">
                        <button class="side-btn" data-sides="3" onclick="selectSides(3)">三角形</button>
                        <button class="side-btn selected" data-sides="4" onclick="selectSides(4)">正方形</button>
                        <button class="side-btn" data-sides="5" onclick="selectSides(5)">五边形</button>
                        <button class="side-btn" data-sides="6" onclick="selectSides(6)">六边形</button>
                        <button class="side-btn" data-sides="8" onclick="selectSides(8)">八边形</button>
                        <button class="side-btn" data-sides="34" onclick="selectSides(34)">扭棱正方</button>
                        <button class="side-btn" data-sides="36" onclick="selectSides(36)">三六混合</button>
                    </div>
                </div>

                <div class="setting-section">
                    <div class="section-label">难度选择</div>
                    <div class="difficulty-row">
                        <button class="diff-btn" data-diff="easy" onclick="selectDifficulty('easy')">简单</button>
                        <button class="diff-btn selected" data-diff="medium" onclick="selectDifficulty('medium')">中等</button>
                        <button class="diff-btn" data-diff="hard" onclick="selectDifficulty('hard')">困难</button>
                        <button class="diff-btn" data-diff="hell" onclick="selectDifficulty('hell')">地狱</button>
                        <button class="diff-btn" data-diff="custom" onclick="selectDifficulty('custom')">自定义</button>
                    </div>
                </div>

                <div class="custom-settings" id="customSettings" style="display:none">
                    <div class="setting-item slider-item">
                        <label>行数: <span id="rows-val">10</span></label>
                        <input type="range" id="rows" value="10" min="3" max="100"
                               oninput="document.getElementById('rows-val').textContent=this.value; previewBoardSize()">
                    </div>
                    <div class="setting-item slider-item">
                        <label>列数: <span id="cols-val">10</span></label>
                        <input type="range" id="cols" value="10" min="3" max="100"
                               oninput="document.getElementById('cols-val').textContent=this.value; previewBoardSize()">
                    </div>
                    <div class="setting-item slider-item">
                        <label>雷数: <span id="mines-val">20</span></label>
                        <input type="range" id="mines" value="20" min="1" max="2500"
                               oninput="document.getElementById('mines-val').textContent=this.value; previewMineCount()">
                    </div>
                </div>

                <div class="preview-info" id="previewInfo">
                    <span class="preview-item">📐 <span id="cellCount">64</span> 格</span>
                    <span class="preview-item">💣 <span id="mineRatio">—</span></span>
                </div>
            </div>

            <button class="start-btn" onclick="startGame()">
                <span>开始游戏</span>
                <span class="start-icon">▶</span>
            </button>

            <div class="tips">左键标记地雷 🚩 · 右键/长按打开格子</div>
        </div>
    </div>

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

                <div class="room-list-section">
                    <div class="room-list-header">
                        <span class="room-list-label">当前可加入的房间</span>
                        <button class="room-list-refresh" onclick="refreshRoomList()">刷新</button>
                    </div>
                    <div class="room-list" id="roomList">
                        <div class="room-list-empty">暂无等待中的房间</div>
                    </div>
                </div>
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

    <!-- 游戏界面 -->
    <div class="game-screen" id="gameScreen">
        <!-- 顶部状态栏 -->
        <div class="game-header" id="gameHeader">
            <button class="back-btn" onclick="backToMenu()">← 返回</button>
            <div class="game-status">
                <span class="status-badge">🚩 <span id="flagProgress">0</span>/<span id="totalMinesDisplay">10</span></span>
                <span class="status-badge">⏱️ <span id="timer">0</span>s</span>
                <span class="status-badge mp-status" id="mpStatus" style="display:none">🟢 对方在线</span>
            </div>
            <button class="restart-btn" id="restartBtn" onclick="restartGame()">🔄</button>
        </div>

        <!-- 联机翻格统计（合作模式时显示） -->
        <div class="mp-stats" id="mpStats" style="display:none">
            <span id="mpMyReveal">你：已翻 0 格</span>
            <span id="mpPartnerReveal">对方：已翻 0 格</span>
        </div>

        <!-- 全屏游戏区域 -->
        <div class="game-viewport" id="boardViewport">
            <div class="game-board" id="board"></div>
        </div>

        <!-- 游戏结果弹窗 -->
        <div class="game-result" id="gameResult">
            <div class="result-content">
                <div class="result-icon" id="resultIcon">🎉</div>
                <div class="result-text" id="resultText">恭喜！你赢了！</div>
                <div class="result-time" id="resultTime">用时 0 秒</div>
                <div class="result-actions">
                    <button class="result-btn secondary" onclick="backToMenu()">返回菜单</button>
                    <button class="result-btn primary" id="restartResultBtn" onclick="restartGame()">再来一局</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Toast 通知容器 -->
    <div id="toastContainer" class="toast-container"></div>

    <!-- 加载顺序：platform → storage → haptics → geometry → renderer → multiplayer → game -->
    <script src="shared/platform.js"></script>
    <script src="shared/storage.js"></script>
    <script src="shared/haptics.js"></script>
    <script src="geometry.js"></script>
    <script src="renderer.js"></script>
    <script src="multiplayer.js"></script>
    <script src="game.js"></script>
</body>
</html>
```

- [ ] **Step 2: 验证关键 DOM 元素存在**

```bash
grep -q "modeScreen" mobile/src/index.html && echo "modeScreen: OK" || echo "FAIL"
grep -q "lobbyScreen" mobile/src/index.html && echo "lobbyScreen: OK" || echo "FAIL"
grep -q "waitingScreen" mobile/src/index.html && echo "waitingScreen: OK" || echo "FAIL"
grep -q "toastContainer" mobile/src/index.html && echo "toastContainer: OK" || echo "FAIL"
grep -q "mpStatus" mobile/src/index.html && echo "mpStatus: OK" || echo "FAIL"
grep -q "mpStats" mobile/src/index.html && echo "mpStats: OK" || echo "FAIL"
grep -q "restartResultBtn" mobile/src/index.html && echo "restartResultBtn: OK" || echo "FAIL"
grep -q "multiplayer.js" mobile/src/index.html && echo "multiplayer script: OK" || echo "FAIL"
```

预期：全部 OK

- [ ] **Step 3: Commit**

```bash
git add mobile/src/index.html
git commit -m "feat: mobile/src/index.html 同步 web 版结构，补全联机 UI 和脚本加载"
```

---

## Chunk 2: 同步并验证

### Task 4: 运行同步脚本

**Files:**
- Run: `mobile/scripts/sync-assets.sh`

> **前置条件：Chunk 1 全部 Task 完成并已 commit。**
> 以下所有命令均在**项目根目录**执行。

- [ ] **Step 1: 全量语法检查**

```bash
node --check geometry.js renderer.js game.js multiplayer.js
```

预期：无错误

- [ ] **Step 2: 运行同步脚本**

```bash
bash mobile/scripts/sync-assets.sh
```

预期输出：`Assets synced to mobile/src/`

- [ ] **Step 3: 验证同步结果**

```bash
ls mobile/src/
```

预期包含：`geometry.js renderer.js game.js style.css multiplayer.js shared/ index.html`

```bash
diff game.js mobile/src/game.js && echo "game.js: OK" || echo "game.js: FAIL"
diff multiplayer.js mobile/src/multiplayer.js && echo "multiplayer.js: OK" || echo "multiplayer.js: FAIL"
ls mobile/src/shared/
diff -r shared/ mobile/src/shared/ && echo "shared: OK" || echo "shared: FAIL"
```

- [ ] **Step 4: Capacitor 同步**

```bash
(cd mobile && npx cap sync)
```

预期：输出 `Sync finished` 或类似，无错误。
注：`npx cap sync` 写入的平台产物（android/ios 目录）按项目 `.gitignore` 处理，无需手动 add。

- [ ] **Step 5: Commit**

```bash
git add mobile/src/
git commit -m "chore: 运行 sync-assets.sh，同步最新 web 版代码到 mobile/src/"
```

注：首次运行时 `mobile/src/shared/` 为新增目录，`git add mobile/src/` 会一并追踪。

---

### Task 5: 设备验证（手动）

> 验证前先确认 ngrok 隧道处于运行状态：
> ```bash
> curl -s https://unsleepy-rickie-gracefully.ngrok-free.dev/health || echo "ngrok 未运行，请先启动 server.js + ngrok"
> ```

- [ ] **Android 验证**

```bash
(cd mobile && npx cap open android)
```

在 Android Studio 中运行到真机或模拟器，验证：
- 启动显示模式选择屏（单人/联机两张卡片）
- 单人游戏：七种棋盘形状切换正常，开局、标旗、开格、胜负判定均正常
- 联机：进入大厅，能连接 `wss://unsleepy-rickie-gracefully.ngrok-free.dev`，创建或加入房间
- **双设备合作对局**：两台设备同一房间，翻格同步正常，胜负判定同步
- 震动反馈正常（Haptics）

- [ ] **iOS 验证**

```bash
(cd mobile && npx cap open ios)
```

在 Xcode 中运行到真机或模拟器，验证：
- 同 Android 所有项
- 重点：联机大厅 WebSocket 连接成功（ngrok 使用 Let's Encrypt 证书，iOS ATS 通常允许；若连接失败且日志报证书错误，在 `ios/App/App/Info.plist` 的 `NSExceptionDomains` 添加 ngrok 域名白名单，并提交：
  ```bash
  git add mobile/ios/App/App/Info.plist
  git commit -m "fix: iOS ATS 豁免 ngrok 域名"
  ```
- 震动走 `@capacitor/haptics`，而非 `navigator.vibrate`
