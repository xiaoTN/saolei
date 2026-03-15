# 统一入口界面 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 modeScreen 模式选择屏，打开游戏直接显示统一大厅（设置面板 + 双按钮 + 加入房间区域）。

**Architecture:** 将 `startScreen` 升级为可滚动的统一大厅，设置面板共用于单人和联机创建房间。移除所有 mp 独立状态变量（`mpSides`/`mpDifficulty` 等），`createRoom()` 直接读取共用的 `sides`/`currentDifficulty`/`rows`/`cols`/`totalMines`。

**Tech Stack:** 原生 HTML/CSS/JS，无构建工具。

---

## Chunk 1: CSS 改造

### Task 1: 删除废弃样式 + 改 startScreen 为可滚动布局

**Files:**
- Modify: `style.css`

- [ ] **Step 1: 删除 mode-screen 相关样式块**

  删除 `style.css` 中以下注释块及其内容（约 474–515 行）：
  ```css
  /* ── 模式选择屏 ─────────────────────────────────────── */
  .mode-screen { ... }
  .mode-container { ... }
  .mode-cards { ... }
  .mode-card { ... }
  .mode-card:hover { ... }
  .mode-icon { ... }
  .mode-name { ... }
  .mode-desc { ... }
  ```

- [ ] **Step 2: 删除 lobby-screen / lobby-container / lobby-header / lobby-back 样式**

  删除以下（约 517–533、573 行）——联机大厅的独立屏容器样式已不再需要，内容将并入 startScreen：
  ```css
  /* ── 联机大厅屏 ─────────────────────────────────────── */
  .lobby-screen { ... }
  .lobby-container { ... }
  .lobby-header { ... }
  .lobby-header h2 { ... }
  .lobby-back { ... }
  ```
  保留 `.lobby-section`、`.lobby-section-title`、`.lobby-divider`、`.join-row` 等（加入房间区域会复用）。

- [ ] **Step 3: 改 .start-screen 为可滚动容器**

  将：
  ```css
  .start-screen {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      transition: opacity 0.3s ease, transform 0.3s ease;
      z-index: 10;
  }
  ```
  改为（保留 `position: fixed; inset: 0`，移除 flex 居中，加 `overflow-y: auto`）：
  ```css
  .start-screen {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      overflow-y: auto;
      padding: 20px;
      transition: opacity 0.3s ease, transform 0.3s ease;
      z-index: 10;
  }
  ```
  注意：`body` 有 `overflow: hidden`，但 `start-screen` 是 `position: fixed` 有自己的高度约束，因此 `overflow-y: auto` 可以形成独立滚动上下文，正常工作（与现有 `lobby-screen` 机制相同）。

- [ ] **Step 4: 改 .start-container 为居中单栏**

  将：
  ```css
  .start-container {
      width: 100%;
      max-width: 420px;
  }
  ```
  改为：
  ```css
  .start-container {
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      padding-bottom: 40px;
  }
  ```

- [ ] **Step 5: 新增 .action-row（双按钮行）**

  在 `.start-btn` 相关样式后添加：
  ```css
  .action-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
  }

  .action-row .start-btn {
      flex: 1;
      margin-bottom: 0;
      font-size: 16px;
      padding: 14px 12px;
  }

  .create-room-btn {
      background: linear-gradient(135deg, #a55eea, #7c3aed) !important;
  }

  .create-room-btn:hover {
      box-shadow: 0 8px 25px rgba(165, 94, 234, 0.4) !important;
  }
  ```

- [ ] **Step 6: 修复 #mineRatio 颜色规则**

  当前 `style.css` 中有硬编码 `#mineRatio` 选择器：
  ```css
  #mineRatio.easy   { color: #2ed573; }
  #mineRatio.medium { color: #ffa502; }
  #mineRatio.hard   { color: #ff4757; }
  ```
  由于合并后只剩一个 `#mineRatio` 元素（`mp-mineRatio` 随联机面板一起移除），这些规则保留不变，无需修改。

- [ ] **Step 7: 提交**

  ```bash
  node --check game.js renderer.js geometry.js
  git add style.css
  git commit -m "style: 删除 modeScreen/lobbyScreen 样式，startScreen 改为可滚动统一大厅"
  ```

---

## Chunk 2: HTML 重构

### Task 2: 合并 HTML 结构

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 删除 modeScreen 整块 div**

  删除 `index.html` 中第 12–29 行的整个 `<!-- 模式选择屏 -->` 区块：
  ```html
  <!-- 模式选择屏 -->
  <div class="mode-screen" id="modeScreen">
      ...
  </div>
  ```

- [ ] **Step 2: 修改 startScreen 开头 — 去掉 hidden 类、去掉返回按钮**

  将：
  ```html
  <div class="start-screen hidden" id="startScreen">
      <div class="start-container">
          <button class="back-btn lobby-back" onclick="backToModeSelect()">← 返回</button>
          <h1 class="game-title">💣 多边形扫雷</h1>
  ```
  改为：
  ```html
  <div class="start-screen" id="startScreen">
      <div class="start-container">
          <h1 class="game-title">💣 多边形扫雷</h1>
  ```

- [ ] **Step 3: 将单个 start-btn 改为双按钮行**

  将：
  ```html
  <button class="start-btn" onclick="startGame()">
      <span>开始游戏</span>
      <span class="start-icon">▶</span>
  </button>
  ```
  改为：
  ```html
  <div class="action-row">
      <button class="start-btn" onclick="startGame()">
          <span>开始游戏</span><span class="start-icon">▶</span>
      </button>
      <button class="start-btn create-room-btn" onclick="createRoom()">
          <span>创建房间</span>
      </button>
  </div>
  ```

- [ ] **Step 4: 在 tips 后添加加入房间区域**

  在 `.tips` div 之后（仍在 `.start-container` 内），添加以下内容。
  注意：`joinCodeInput`、`lobbyError`、`roomList` 三个元素必须从原 `lobbyScreen` 搬入此处（Step 5 删除 lobbyScreen 时不得遗漏这三个元素，它们在此处已有新位置）：
  ```html
  <div class="lobby-divider">— 或加入已有房间 —</div>

  <div class="lobby-section">
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
  ```

- [ ] **Step 5: 删除 lobbyScreen 整块 div**

  删除 `index.html` 中 `<!-- 联机大厅屏 -->` 到对应 `</div>` 的整个区块（原第 87–162 行）。

- [ ] **Step 6: 更新脚本缓存版本号**

  将 `index.html` 底部 `game.js` 和 `style.css` 的版本号后缀改为新版本（例如 `v=20260315a`）。

- [ ] **Step 7: 提交**

  ```bash
  git add index.html
  git commit -m "feat: index.html 合并 startScreen+lobbyScreen 为统一大厅"
  ```

---

## Chunk 3: game.js 重构

### Task 3: 清理废弃函数和状态，更新屏幕切换逻辑

**Files:**
- Modify: `game.js`

- [ ] **Step 1: 更新 NEW_SCREENS 和 showScreen()**

  将：
  ```js
  const NEW_SCREENS = ['modeScreen', 'lobbyScreen', 'waitingScreen'];

  function showScreen(id) {
      for (const screenId of NEW_SCREENS) {
          const el = document.getElementById(screenId);
          if (el) el.style.display = screenId === id ? 'flex' : 'none';
      }
      const startEl = document.getElementById('startScreen');
      const gameEl  = document.getElementById('gameScreen');
      if (id === 'startScreen') {
          startEl.classList.remove('hidden');
          gameEl.classList.remove('active');
          gameStarted = false;
          _setSettingsLocked(false);
          document.querySelectorAll('.side-btn:not(.mp-side-btn)').forEach(btn => {
              btn.classList.toggle('selected', parseInt(btn.dataset.sides) === sides);
          });
          document.querySelectorAll('.diff-btn:not(.mp-diff-btn)').forEach(btn => {
              btn.classList.toggle('selected', btn.dataset.diff === currentDifficulty);
          });
      } else if (id === 'gameScreen') {
          startEl.classList.add('hidden');
          gameEl.classList.add('active');
          gameStarted = true;
      } else {
          startEl.classList.add('hidden');
          gameEl.classList.remove('active');
          gameStarted = false;
      }
  }
  ```
  改为：
  ```js
  const NEW_SCREENS = ['waitingScreen'];

  function showScreen(id) {
      // 等待室屏（display 切换）
      for (const screenId of NEW_SCREENS) {
          const el = document.getElementById(screenId);
          if (el) el.style.display = screenId === id ? 'flex' : 'none';
      }
      const startEl = document.getElementById('startScreen');
      const gameEl  = document.getElementById('gameScreen');
      if (id === 'startScreen') {
          startEl.classList.remove('hidden');
          gameEl.classList.remove('active');
          gameStarted = false;
          _setSettingsLocked(false);
          document.querySelectorAll('.side-btn').forEach(btn => {
              btn.classList.toggle('selected', parseInt(btn.dataset.sides) === sides);
          });
          document.querySelectorAll('.diff-btn').forEach(btn => {
              btn.classList.toggle('selected', btn.dataset.diff === currentDifficulty);
          });
      } else if (id === 'gameScreen') {
          startEl.classList.add('hidden');
          gameEl.classList.add('active');
          gameStarted = true;
      } else {
          startEl.classList.add('hidden');
          gameEl.classList.remove('active');
          gameStarted = false;
      }
  }
  ```

- [ ] **Step 2: 更新 backToMenu() — 回到统一大厅并刷新房间列表**

  将：
  ```js
  function backToMenu() {
      ...
      showScreen('modeScreen');
  }
  ```
  将最后一行改为：
  ```js
      showScreen('startScreen');
      refreshRoomList();
  }
  ```

- [ ] **Step 3: 删除 enterSinglePlayer() / enterMultiplayer() / backToModeSelect()**

  删除这三个函数（约第 283–292、376–379 行）：
  ```js
  function enterSinglePlayer() { showScreen('startScreen'); }
  function enterMultiplayer() { showScreen('lobbyScreen'); refreshRoomList(); }
  function backToModeSelect() { showScreen('modeScreen'); }
  ```

- [ ] **Step 4: 更新 cancelWaiting() — 回到统一大厅**

  将：
  ```js
  function cancelWaiting() {
      MP.disconnect();
      mpRole = null;
      showScreen('modeScreen');
  }
  ```
  改为：
  ```js
  function cancelWaiting() {
      MP.disconnect();
      mpRole = null;
      showScreen('startScreen');
      refreshRoomList();
  }
  ```

- [ ] **Step 5: 删除 mp 独立状态变量**

  删除约 381–384 行：
  ```js
  let mpSides = 4;
  let mpDifficulty = 'medium';
  let mpRows = 10, mpCols = 10, mpMines = 20;
  ```

- [ ] **Step 6: 删除 mp 独立设置函数**

  删除以下函数（约 386–433 行）：
  - `mpSelectSides()`
  - `mpSelectDifficulty()`
  - `_mpApplyDifficultyPreset()`
  - `mpPreviewBoardSize()`
  - `mpPreviewMineCount()`

- [ ] **Step 7: 简化 createRoom() — 直接读取共用设置**

  将 `createRoom()` 中最后几行：
  ```js
  MP._onRoomCreated = (code) => {
      mpRole = 'host';
      document.getElementById('waitingRoomCode').textContent = code;
      document.getElementById('waitingPartnerLabel').textContent = '等待中...';
      showScreen('waitingScreen');
      MP.onPartnerJoined = () => {
          sides = mpSides;               // ← 删除此行
          currentDifficulty = mpDifficulty; // ← 删除此行
          cellSize = _effectiveCellSize();
          initGame();
          showScreen('gameScreen');
          setTimeout(() => { if (window._panCenter) window._panCenter(); }, 100);
      };
  };
  const preset = (DIFFICULTY_PRESETS[mpSides] || DIFFICULTY_PRESETS[4])[mpDifficulty] || [10, 10, 20];
  const r = mpDifficulty === 'custom' ? mpRows  : preset[0];
  const c = mpDifficulty === 'custom' ? mpCols  : preset[1];
  const m = mpDifficulty === 'custom' ? mpMines : preset[2];
  MP.createRoom({ sides: mpSides, difficulty: mpDifficulty, rows: r, cols: c, mines: m });
  ```
  改为（删除 `sides = mpSides`、`currentDifficulty = mpDifficulty` 赋值，改用共用变量）：
  ```js
  MP._onRoomCreated = (code) => {
      mpRole = 'host';
      document.getElementById('waitingRoomCode').textContent = code;
      document.getElementById('waitingPartnerLabel').textContent = '等待中...';
      showScreen('waitingScreen');
      MP.onPartnerJoined = () => {
          cellSize = _effectiveCellSize();
          initGame();
          showScreen('gameScreen');
          setTimeout(() => { if (window._panCenter) window._panCenter(); }, 100);
      };
  };
  MP.createRoom({ sides, difficulty: currentDifficulty, rows, cols, mines: totalMines });
  ```

- [ ] **Step 8: 简化 _updatePreviewInfo() — 移除 mp 分支**

  将：
  ```js
  function _updatePreviewInfo(prefix) {
      const p = prefix || '';
      const s = p ? mpSides : sides;
      const r = p ? mpRows  : rows;
      const c = p ? mpCols  : cols;
      const m = p ? mpMines : totalMines;

      const totalCells = _calcTotalCells(s, r, c);
      const ratioNum = totalCells > 0 ? (m / totalCells * 100) : 0;

      document.getElementById(p + 'cellCount').textContent = totalCells;
      const ratioEl = document.getElementById(p + 'mineRatio');
      ratioEl.textContent = ratioNum.toFixed(1) + '%';
      ratioEl.className = ratioNum < 15 ? 'easy' : ratioNum < 25 ? 'medium' : 'hard';
  }
  ```
  改为：
  ```js
  function _updatePreviewInfo() {
      const totalCells = _calcTotalCells(sides, rows, cols);
      const ratioNum = totalCells > 0 ? (totalMines / totalCells * 100) : 0;
      document.getElementById('cellCount').textContent = totalCells;
      const ratioEl = document.getElementById('mineRatio');
      ratioEl.textContent = ratioNum.toFixed(1) + '%';
      ratioEl.className = ratioNum < 15 ? 'easy' : ratioNum < 25 ? 'medium' : 'hard';
  }
  ```
  并同步更新所有 `_updatePreviewInfo()` 的调用（原来传 `'mp-'` 参数的调用均已随 mp 函数删除，无需处理）。

- [ ] **Step 9: 清理 initGame() 中的 mp 残留选择器**

  在 `initGame()` 函数中找到：
  ```js
  const selectedBtn = document.querySelector('.side-btn.selected:not(.mp-side-btn)');
  ```
  改为：
  ```js
  const selectedBtn = document.querySelector('.side-btn.selected');
  ```
  （合并后不再有 `.mp-side-btn`，选择器可简化）

- [ ] **Step 10: 更新入口初始化代码**

  将底部入口区块：
  ```js
  renderShapeButtons('shapeButtons', 'selectSides', 4);
  renderShapeButtons('mpShapeButtons', 'mpSelectSides', 4, 'mp-side-btn');

  selectSides(4);
  selectDifficulty('medium');
  _updatePreviewInfo();

  // 联机大厅初始化预览
  _mpApplyDifficultyPreset('medium');

  // 初始显示模式选择屏
  showScreen('modeScreen');
  ```
  改为：
  ```js
  renderShapeButtons('shapeButtons', 'selectSides', 4);

  selectSides(4);
  selectDifficulty('medium');

  // 初始显示统一大厅，并拉取房间列表
  showScreen('startScreen');
  refreshRoomList();
  ```

- [ ] **Step 11: 语法检查**
  ```
  预期：无报错输出。

- [ ] **Step 12: 提交**

  ```bash
  git add game.js
  git commit -m "refactor: game.js 移除 modeScreen/lobbyScreen，统一使用共用设置面板"
  ```

---

## Chunk 4: 手工验证

### Task 4: 验证功能完整性

- [ ] **Step 1: 启动本地服务并打开游戏**

  ```bash
  python3 -m http.server 8000
  # 浏览器打开 http://127.0.0.1:8000/
  ```
  预期：直接显示统一大厅（无模式选择屏），页面包含设置面板 + 双按钮 + 加入房间区域。

- [ ] **Step 2: 验证单人流程**

  - 选棋盘形状，选难度，点「▶ 开始游戏」
  - 预期：正常进入游戏
  - 游戏内「← 返回」→ 回到统一大厅，设置参数保留

- [ ] **Step 3: 验证联机创建流程（需本地服务器）**

  ```bash
  node server.js
  ```
  - 设置棋盘参数，点「创建房间」
  - 预期：跳转等待室，显示房间码

- [ ] **Step 4: 验证加入房间流程**

  - 创建房间后，另一浏览器输入房间码加入
  - 预期：双方进入游戏

- [ ] **Step 5: 验证手机适配**

  - 在手机或移动端模拟器上打开，页面可纵向滚动查看全部内容
  - 长按开格、标旗等触控操作正常

- [ ] **Step 6: 提交最终版本号（如需）**

  如果 index.html 中忘了更新版本号，补充更新后提交：
  ```bash
  git add index.html
  git commit -m "chore: 更新脚本版本号缓存参数"
  ```
