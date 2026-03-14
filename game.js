// game.js
// 游戏状态与核心逻辑
// 依赖：geometry.js（getNeighbors, getBoardSize, getCellVertices, getCellCenter）
//       renderer.js（createSVGBoard, setCellState）

// ─── 工具函数 ──────────────────────────────────────────────────

// 震动功能已迁移到 shared/haptics.js
// 保留此函数作为兼容层
function vibrate(pattern) {
    if (window.HapticsAdapter) {
        // 根据参数判断震动类型
        if (Array.isArray(pattern)) {
            HapticsAdapter.error();
        } else if (pattern <= 20) {
            HapticsAdapter.tick();
        } else {
            HapticsAdapter.light();
        }
    } else if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// ─── 常量 ─────────────────────────────────────────────────────

const NUM_COLORS = {
    1: '#4a9eff', 2: '#2ed573', 3: '#ff4757',
    4: '#a55eea', 5: '#ffa502', 6: '#1dd1a1',
    7: '#ff6b81', 8: '#70a1ff',
};

// ─── 游戏状态 ──────────────────────────────────────────────────

let board       = {};   // key → -1(mine) | 0-8(数字)
let revealed    = {};   // key → bool
let flagged     = {};   // key → bool
let mineLocations = [];
let gameOver    = false;
let firstClick  = true; // 首次点击标记，用于安全放雷
let mineCount   = 0;    // 当前剩余标记数（用于 UI 显示）
let totalMines  = 0;    // 初始雷数
let revealedCount = 0;  // 已揭示格子数（用于 O(1) 胜利判断）
let totalCellsCount = 0;// 当前棋盘总格子数
let allCellsCache = []; // 当前棋盘有效格子列表缓存
let neighborsCache = {}; // key -> 邻居列表缓存
let timer       = 0;
let timerInterval = null;
let touchHoldTimers = {};
let touchLongPressFired = {};

// ─── 联机状态 ──────────────────────────────────────────
let mpRole = null;         // 'host' | 'guest' | null
let mpWaitingBoardInit = false; // 等待对方发 board-init（对方先点击时）
let mpSentBoardInit = false;    // 本端已发出 board-init（用于竞态仲裁）
let mpMyRevealCount = 0;   // 本端翻格计数（近似）
let mpPartnerRevealCount = 0; // 对端翻格计数（近似）

// 由 HTML 控件读取/设置
let rows     = 10;
let cols     = 10;
let sides    = 4;
let cellSize = 44;
const DEFAULT_CELL_SIZE = 40; // 基准格子大小（sides=4 正方形边长 / sides=6|8 的参考尺寸）

// 各模式的有效 cellSize，确保主要多边形面积与 sides=4 正方形面积（40²=1600px²）一致：
//   sides=4:  正方形面积 = cellSize²                          → cellSize = 40
//   sides=34: 正方形面积 = (cellSize/2)²                     → cellSize = 80
//   sides=8:  正八边形面积 = 2(1+√2)·(cellSize/(1+√2))²      → cellSize = √(800(1+√2)) ≈ 43.95
//   sides=6:  正六边形面积 = (3√3/2)·(cellSize/2)²           → cellSize = 2√(3200/(3√3)) ≈ 49.63
//   sides=36: rectification 六边形面积 = 9√3·cellSize²/8     → cellSize = √(12800/(9√3)) ≈ 28.64
//   其他模式（3,5）：不缩放
function _effectiveCellSize() {
    const S = DEFAULT_CELL_SIZE; // 基准边长 40
    const TARGET_AREA = S * S;   // 目标面积 1600
    if (sides === 34) return S * 2;
    if (sides === 8)  return Math.sqrt(TARGET_AREA * (1 + Math.SQRT2) / 2);
    if (sides === 6)  return 2 * Math.sqrt(TARGET_AREA * 2 / (3 * Math.sqrt(3)));
    if (sides === 36) return Math.sqrt(TARGET_AREA * 8 / (9 * Math.sqrt(3)));
    return S;
}
const MIN_SCALE = 1;          // 最小缩放比例
const MAX_SCALE = 2;          // 最大缩放比例
const SUPPORTED_SIDES = new Set([3, 4, 5, 6, 8, 34, 36]);

let currentDifficulty = 'medium';
let gameStarted = false; // 游戏是否已开始（用于界面切换）

// 各难度在不同边数下的预设 [rows, cols, mines]
// 难度预设 [rows, cols, mines]
// 目标雷密度：easy≈12%，medium≈16%，hard≈21%，hell≈25%
// 注意：不同模式格子数计算方式不同（见各模式注释），雷数按实际格子数×目标密度取整
const DIFFICULTY_PRESETS = {
    3: {
        // 三角形：实际格子数 = rows*(cols*2)，密度对齐经典标准
        easy:   [9,  16,  35],   // 288格，密度 12.2%
        medium: [12, 20,  77],   // 480格，密度 16.0%
        hard:   [16, 28, 188],   // 896格，密度 21.0%
        hell:   [100, 100, 5000],// 20000格，密度 25.0%
    },
    4: {
        // 对齐 Windows 经典标准
        easy:   [9,  9,  10],    // 81格，密度 12.3%
        medium: [16, 16, 41],    // 256格，密度 16.0%
        hard:   [16, 30, 101],   // 480格，密度 21.0%
        hell:   [100, 100, 2500],// 10000格，密度 25.0%
    },
    5: {
        // Cairo 五边形：实际格子数 = rows*cols*4
        easy:   [5,  5,  12],    // 100格，密度 12.0%
        medium: [8,  8,  41],    // 256格，密度 16.0%
        hard:   [10, 10, 84],    // 400格，密度 21.0%
        hell:   [50, 50, 2500],  // 10000格，密度 25.0%
    },
    6: {
        // 六边形：实际格子数 = rows*cols
        easy:   [10, 10, 12],    // 100格，密度 12.0%
        medium: [13, 15, 31],    // 195格，密度 15.9%
        hard:   [16, 20, 67],    // 320格，密度 20.9%
        hell:   [100, 100, 2500],// 10000格，密度 25.0%
    },
    8: {
        // 八边形+正方形：实际格子数 = rows*cols + (rows-1)*(cols-1)
        easy:   [6,  8,  10],    // 83格，密度 12.0%
        medium: [9,  10, 26],    // 162格，密度 16.0%
        hard:   [12, 13, 60],    // 288格，密度 20.8%
        hell:   [100, 100, 4950],// 19801格，密度 25.0%
    },
    36: {
        // 三六混合：实际格子数 = 2*rows*cols + rows + cols
        easy:   [7,  8,  15],   // 127格，密度 11.8%
        medium: [9,  10, 32],   // 199格，密度 16.1%
        hard:   [12, 13, 71],   // 337格，密度 21.1%
        hell:   [100, 100, 5050],// 20200格，密度 25.0%
    },
    34: {
        // 扭棱正方形：实际格子数 ≈ 6*rows*cols（每基本域 2 正方形 + 4 三角形）
        easy:   [4,  4,  12],    // ≈96格，密度 ≈12.5%
        medium: [5,  5,  24],    // ≈150格，密度 ≈16%
        hard:   [7,  7,  62],    // ≈294格，密度 ≈21%
        hell:   [41, 41, 2521],  // ≈10086格，密度 ≈25.0%
    },
};

// ─── 界面切换 ──────────────────────────────────────────────────

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

function showStartScreen() {
    showScreen('startScreen');
}

function showGameScreen() {
    showScreen('gameScreen');
}

function startGame() {
    initGame();
    showGameScreen();
    // 延迟居中棋盘，等待 DOM 更新
    setTimeout(() => {
        if (window._panCenter) window._panCenter();
    }, 100);
}

function backToMenu() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    hideGameResult();
    MP.disconnect();
    mpRole = null;
    mpWaitingBoardInit = false;
    mpSentBoardInit = false;
    mpMyRevealCount = 0;
    mpPartnerRevealCount = 0;
    showScreen('modeScreen');
}

function restartGame() {
    // 联机模式：只有房主才能重新开始
    if (MP.isMultiplayer() && mpRole !== 'host') return;
    hideGameResult();
    // 联机模式：通知对方重置
    if (MP.isMultiplayer()) MP.send({ type: 'restart' });
    initGame();
    setTimeout(() => {
        if (window._panCenter) window._panCenter();
    }, 100);
}

// ─── 联机 UI 控制函数 ──────────────────────────────────────────

// 进入单人流程
function enterSinglePlayer() {
    showScreen('startScreen');
}

// 进入联机大厅
function enterMultiplayer() {
    showScreen('lobbyScreen');
    refreshRoomList();
}

// 刷新房间列表
async function refreshRoomList() {
    const listEl = document.getElementById('roomList');
    try {
        const res = await fetch('/api/rooms');
        const rooms = await res.json();
        if (rooms.length === 0) {
            listEl.innerHTML = '<div class="room-list-empty">暂无等待中的房间</div>';
            return;
        }
        const sidesLabel = { 3: '三角形', 4: '正方形', 5: '五边形', 6: '六边形', 8: '八边形', 34: '扭棱正方', 36: '三六混合' };
        const diffLabel = { easy: '简单', medium: '中等', hard: '困难', hell: '地狱' };
        listEl.innerHTML = rooms.map(r => {
            const shape = sidesLabel[r.config.sides] || `${r.config.sides}边形`;
            const diff = diffLabel[r.config.difficulty] || r.config.difficulty || '';
            const desc = [shape, diff].filter(Boolean).join(' · ');
            return `<div class="room-item" onclick="quickJoinRoom('${r.code}')">
                <div class="room-item-info">
                    <div class="room-item-code">${r.code}</div>
                    <div class="room-item-desc">${desc}</div>
                </div>
                <div class="room-item-join">加入 →</div>
            </div>`;
        }).join('');
    } catch {
        listEl.innerHTML = '<div class="room-list-empty">获取房间列表失败</div>';
    }
}

// 点击房间列表直接加入
async function quickJoinRoom(code) {
    document.getElementById('joinCodeInput').value = code;
    await joinRoom();
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
            sides = mpSides;
            currentDifficulty = mpDifficulty;
            cellSize = _effectiveCellSize();
            initGame();
            showScreen('gameScreen');
            setTimeout(() => { if (window._panCenter) window._panCenter(); }, 100);
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
        const cfg = msg.config || {};
        sides = cfg.sides || 4;
        currentDifficulty = cfg.difficulty || 'medium';
        if (cfg.rows) rows = cfg.rows;
        if (cfg.cols) cols = cfg.cols;
        if (cfg.mines) { totalMines = cfg.mines; mineCount = cfg.mines; }
        cellSize = _effectiveCellSize();
        initGame();
        showScreen('gameScreen');
        setTimeout(() => { if (window._panCenter) window._panCenter(); }, 100);
    };
    MP.joinRoom(code);
}

// 取消等待
function cancelWaiting() {
    MP.disconnect();
    mpRole = null;
    showScreen('modeScreen');
}

function showGameResult(won) {
    const resultEl = document.getElementById('gameResult');
    const iconEl = document.getElementById('resultIcon');
    const textEl = document.getElementById('resultText');
    const timeEl = document.getElementById('resultTime');
    
    iconEl.textContent = won ? '🎉' : '💥';
    textEl.textContent = won ? '恭喜！你赢了！' : '游戏结束';
    timeEl.textContent = `用时 ${timer} 秒`;
    
    resultEl.classList.add('show');
}

function hideGameResult() {
    document.getElementById('gameResult').classList.remove('show');
}

// ─── 初始化 ────────────────────────────────────────────────────

// 边数按钮选择
function selectSides(s) {
    sides = SUPPORTED_SIDES.has(s) ? s : 4;
    document.querySelectorAll('.side-btn:not(.mp-side-btn)').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.sides) === sides);
    });
    cellSize = _effectiveCellSize();
    if (!gameStarted) {
        // 切换边数时同步应用当前难度预设（自定义模式只预览尺寸）
        if (currentDifficulty !== 'custom') _applyDifficultyPreset(currentDifficulty);
        else previewBoardSize();
    }
}

// 难度选择
function selectDifficulty(diff) {
    currentDifficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.diff === diff);
    });
    const customEl = document.getElementById('customSettings');
    if (diff === 'custom') {
        customEl.style.display = 'flex';
        if (!gameStarted) previewBoardSize();
    } else {
        customEl.style.display = 'none';
        if (!gameStarted) _applyDifficultyPreset(diff);
    }
}

// 将难度预设同步到滑动条并更新预览信息
function _applyDifficultyPreset(diff) {
    const preset = (DIFFICULTY_PRESETS[sides] || DIFFICULTY_PRESETS[4])[diff];
    if (!preset) return;
    const [r, c, m] = preset;

    rows = r; cols = c;
    document.getElementById('rows').value = r;
    document.getElementById('rows-val').textContent = r;
    document.getElementById('cols').value = c;
    document.getElementById('cols-val').textContent = c;

    totalMines = m; mineCount = m;
    document.getElementById('mines').value = m;
    document.getElementById('mines-val').textContent = m;

    _updatePreviewInfo();
}

// 游戏未开始时，雷数滑动条变化时立即更新预览
function previewMineCount() {
    if (gameStarted) return;
    totalMines = parseInt(document.getElementById('mines').value);
    mineCount = totalMines;
    _updatePreviewInfo();
}

// 游戏未开始时，边数/行列滑动条变化时立即更新预览
function previewBoardSize() {
    if (gameStarted) return;

    rows = parseInt(document.getElementById('rows').value);
    cols = parseInt(document.getElementById('cols').value);

    _updatePreviewInfo();
}

function _updatePreviewInfo() {
    // 计算总格子数
    let totalCells;
    if (sides === 8) {
        totalCells = rows * cols + (rows - 1) * (cols - 1);
    } else if (sides === 34) {
        // 扭棱正方形：使用缓存计算精确格子数
        totalCells = rows * cols * 6; // 每基本域 2 正方形 + 4 三角形
    } else if (sides === 36) {
        // 三六混合：六边形 rows*cols + 三角形 rows*cols + rows + cols
        totalCells = rows * cols + rows * cols + rows + cols;
    } else if (sides === 5) {
        // Cairo 五边形：每组4个，共 rows*cols 组
        totalCells = rows * cols * 4;
    } else {
        totalCells = rows * cols;
    }

    const ratioNum = totalCells > 0 ? (totalMines / totalCells * 100) : 0;

    document.getElementById('cellCount').textContent = totalCells;
    const ratioEl = document.getElementById('mineRatio');
    ratioEl.textContent = ratioNum.toFixed(1) + '%';
    ratioEl.className = ratioNum < 15 ? 'easy' : ratioNum < 25 ? 'medium' : 'hard';
}

function initGame() {
    // 联机模式下 sides 已由房间配置设定，不从 DOM 读取覆盖
    if (!mpRole) {
        const selectedBtn = document.querySelector('.side-btn.selected:not(.mp-side-btn)');
        sides = selectedBtn ? parseInt(selectedBtn.dataset.sides) : 4;
        if (!SUPPORTED_SIDES.has(sides)) sides = 4;
    }
    cellSize = _effectiveCellSize();

    // 非自定义模式：直接从预设读取，不依赖滑动条当前值
    if (currentDifficulty !== 'custom') {
        const preset = (DIFFICULTY_PRESETS[sides] || DIFFICULTY_PRESETS[4])[currentDifficulty];
        if (preset) {
            rows = preset[0]; cols = preset[1];
            totalMines = preset[2]; mineCount = preset[2];
        }
    } else {
        rows = parseInt(document.getElementById('rows').value);
        cols = parseInt(document.getElementById('cols').value);
        totalMines = parseInt(document.getElementById('mines').value);
        mineCount = totalMines;
    }

    const maxMines = Math.floor(rows * cols * 0.8);
    if (mineCount > maxMines) {
        mineCount = maxMines;
        totalMines = mineCount;
        document.getElementById('mines').value = mineCount;
    }
    if (mineCount < 1) {
        mineCount = 1;
        totalMines = 1;
        document.getElementById('mines').value = 1;
    }
    document.getElementById('mines-val').textContent = String(mineCount);

    board = {}; revealed = {}; flagged = {};
    mineLocations = []; gameOver = false; firstClick = true; timer = 0;
    revealedCount = 0;
    totalCellsCount = 0;
    touchHoldTimers = {};
    touchLongPressFired = {};
    // 联机模式：guest 必须等待 host 触发首次点击（board-init）才能获得棋盘雷位
    mpWaitingBoardInit = MP.isMultiplayer() && mpRole === 'guest';
    mpSentBoardInit = false;

    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    document.getElementById('timer').textContent = '0';
    _setSettingsLocked(false);

    _buildBoard();

    // 联机模式初始化
    mpMyRevealCount = 0;
    mpPartnerRevealCount = 0;
    _updateMpStats();

    if (MP.isMultiplayer()) {
        MP.onMessage = (msg) => {
            const { type, key, keys } = msg;
            if (type === 'reveal') {
                const [r, c] = key.split(',').map(Number);
                if (board[key] === -1) {
                    // 对方踩雷，显示失败界面
                    mineLocations.forEach(([mr, mc]) => {
                        if (!flagged[`${mr},${mc}`]) setCellState(mr, mc, 'mine');
                    });
                    gameOver = true;
                    clearInterval(timerInterval);
                    showGameResult(false);
                } else {
                    revealCell(r, c, true);
                }
            }
            if (type === 'flag') { handleClick(...key.split(',').map(Number), { fromRemote: true }); }
            if (type === 'chord') { revealCells(keys, true); }
            if (type === 'board-init') {
                // 如果本端已先触发首次点击并发出 board-init，忽略对方的（竞态仲裁）
                if (!mpSentBoardInit) {
                    initBoardFromRemote(msg.mineLocations);
                }
            }
            if (type === 'restart') {
                // 房主重新开始，guest 同步重置棋盘
                hideGameResult();
                initGame();
                if (window._panCenter) setTimeout(() => window._panCenter(), 100);
            }
        };
        MP.onPartnerLeft = () => {
            if (!gameOver) {
                gameOver = true;
                clearInterval(timerInterval);
                alert('对方已退出，游戏结束');
                backToMenu();
            }
        };
        MP.onPartnerRejoined = () => {
            const el = document.getElementById('mpStatus');
            if (el) { el.textContent = '🟢 对方在线'; el.style.display = ''; }
        };
        MP.onRoomDestroyed = () => {
            alert('房间已断开，返回主菜单');
            backToMenu();
        };
        const statusEl = document.getElementById('mpStatus');
        const statsEl = document.getElementById('mpStats');
        if (statusEl) statusEl.style.display = '';
        if (statsEl) statsEl.style.display = '';
        // 非房主隐藏重新开始按钮，并提示等待房主首次点击
        _updateRestartBtnVisibility();
        if (mpRole === 'guest') {
            const st = document.getElementById('mpStatus');
            if (st) st.textContent = '⏳ 等待房主首次点击…';
        }
    } else {
        const statusEl = document.getElementById('mpStatus');
        const statsEl = document.getElementById('mpStats');
        if (statusEl) statusEl.style.display = 'none';
        if (statsEl) statsEl.style.display = 'none';
        _updateRestartBtnVisibility();
    }
}

function _updateRestartBtnVisibility() {
    const isGuest = MP.isMultiplayer() && mpRole === 'guest';
    const restartBtn = document.getElementById('restartBtn');
    const restartResultBtn = document.getElementById('restartResultBtn');
    // 用 visibility 而非 display，保持 header 三栏布局不变（状态组居中）
    if (restartBtn) restartBtn.style.visibility = isGuest ? 'hidden' : '';
    if (restartResultBtn) restartResultBtn.style.display = isGuest ? 'none' : '';
}

function _buildBoard() {
    if (window._panReset) window._panReset();
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    const { width, height } = getBoardSize(sides);
    boardEl.style.width  = width  + 'px';
    boardEl.style.height = height + 'px';

    const allCells = getAllCells(sides);
    allCellsCache = allCells;
    neighborsCache = Object.create(null);
    for (const [r, c] of allCells) {
        neighborsCache[`${r},${c}`] = getNeighbors(sides, r, c);
    }

    const totalCells = allCells.length;
    totalCellsCount = totalCells;

    // 校正雷数上限
    const maxMinesAllowed = Math.floor(totalCells * 0.8);
    if (mineCount > maxMinesAllowed) {
        mineCount = maxMinesAllowed;
        totalMines = mineCount;
        document.getElementById('mines').value = mineCount;
        document.getElementById('mines-val').textContent = String(mineCount);
    }

    _updateGameStatus();

    // 初始化格子数据（全部为 0，雷在首次点击后放置）
    for (const [r, c] of allCells) {
        const key = `${r},${c}`;
        board[key] = 0; revealed[key] = false; flagged[key] = false;
    }

    createSVGBoard(boardEl, width, height, allCells);
    if (window._panCenter) window._panCenter();
}

function _updateGameStatus() {
    const flaggedCount = totalMines - mineCount;
    document.getElementById('flagProgress').textContent = flaggedCount;
    document.getElementById('totalMinesDisplay').textContent = totalMines;
}

// ─── 核心逻辑 ──────────────────────────────────────────────────

// 首次点击后放雷：排除首次点击格及其所有邻居
function _placeMines(safeRow, safeCol) {
    const allCells = allCellsCache;
    const safeKeys = new Set(
        [[ safeRow, safeCol ], ..._getNeighborsCached(safeRow, safeCol)]
            .map(([r, c]) => `${r},${c}`)
    );

    const candidates = allCells.filter(([r, c]) => !safeKeys.has(`${r},${c}`));

    // 如果候选格子不够放所有雷，尽量多放
    const actualMines = Math.min(mineCount, candidates.length);
    if (actualMines < mineCount) {
        mineCount = actualMines;
        totalMines = actualMines;
    }

    // 部分 Fisher-Yates 洗牌：只打乱前 actualMines 个位置，避免重复抽样
    for (let i = 0; i < actualMines; i++) {
        const j = i + Math.floor(Math.random() * (candidates.length - i));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        const [r, c] = candidates[i];
        const key = `${r},${c}`;
        board[key] = -1;
        mineLocations.push([r, c]);
    }

    // 重新计算所有格子周围雷数
    for (const [r, c] of allCells) {
        const key = `${r},${c}`;
        if (board[key] !== -1)
            board[key] = _countAdjacentMines(r, c);
    }
}

function _countAdjacentMines(row, col) {
    return _getNeighborsCached(row, col)
        .filter(([r, c]) => board[`${r},${c}`] === -1).length;
}

function startTimer() {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            timer++;
            document.getElementById('timer').textContent = timer;
        }, 1000);
    }
}

// 单击：标记 / 取消标记旗子（首次点击例外，直接打开格子；已揭示数字格触发快速开雷）
function handleClick(row, col, opts = {}) {
    if (_isPanning) return;
    const key = `${row},${col}`;
    if (gameOver) return;
    // 等待对方触发首次点击（board-init）时锁定交互
    if (mpWaitingBoardInit) return;

    // 首次点击：无论何种操作都直接打开格子，触发安全放雷
    if (firstClick) {
        _revealCell_firstClick(row, col);
        // 联机：board-init 已在 _revealCell_firstClick 里发送，同步首次翻格结果
        if (MP.isMultiplayer()) {
            const openedKeys = Object.keys(revealed).filter(k => revealed[k]);
            if (openedKeys.length > 0) MP.send({ type: 'chord', keys: openedKeys });
        }
        return;
    }

    // 已揭示的数字格：快速开雷
    if (revealed[key] && board[key] > 0) {
        const neighbors = _getNeighborsCached(row, col);
        const flaggedCount = neighbors.filter(([r, c]) => flagged[`${r},${c}`]).length;
        if (flaggedCount === board[key]) {
            startTimer();
            const chordRevealedKeys = [];
            for (const [r, c] of neighbors) {
                const nKey = `${r},${c}`;
                if (!revealed[nKey] && !flagged[nKey]) {
                    if (board[nKey] === -1) {
                        mineLocations.forEach(([mr, mc]) => {
                            if (!flagged[`${mr},${mc}`]) setCellState(mr, mc, 'mine');
                        });
                        gameOver = true;
                        clearInterval(timerInterval);
                        vibrate([100, 50, 100]);
                        if (MP.isMultiplayer() && !opts.fromRemote) {
                            MP.send({ type: 'reveal', key: nKey });
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
            if (MP.isMultiplayer() && !opts.fromRemote && chordRevealedKeys.length > 0) {
                MP.send({ type: 'chord', keys: chordRevealedKeys });
            }
            vibrate(30);
            checkWin();
        }
        return;
    }

    if (revealed[key]) return;

    startTimer();

    if (flagged[key]) {
        flagged[key] = false;
        setCellState(row, col, 'normal');
        mineCount++;
    } else {
        if (mineCount <= 0) return;
        flagged[key] = true;
        setCellState(row, col, 'flagged');
        mineCount--;
    }
    vibrate(15);
    if (MP.isMultiplayer() && !opts.fromRemote) MP.send({ type: 'flag', key });
    _updateGameStatus();
}

// 右键单击 / 长按：打开格子（reveal）
function handleRightClick(e, row, col, opts = {}) {
    e.preventDefault();
    if (_isPanning) return;
    const key = `${row},${col}`;
    if (gameOver) return;
    // 等待对方触发首次点击（board-init）时锁定交互
    if (mpWaitingBoardInit) return;

    // 首次点击：直接打开格子
    if (firstClick) {
        _revealCell_firstClick(row, col);
        // 联机：board-init 已在 _revealCell_firstClick 里发送，同步首次翻格结果
        if (MP.isMultiplayer()) {
            const openedKeys = Object.keys(revealed).filter(k => revealed[k]);
            if (openedKeys.length > 0) MP.send({ type: 'chord', keys: openedKeys });
        }
        return;
    }

    // 如果点击的是已揭示的数字格子，检查是否可以快速开雷
    if (revealed[key] && board[key] > 0) {
        const neighbors = _getNeighborsCached(row, col);
        const flaggedCount = neighbors.filter(([r, c]) => flagged[`${r},${c}`]).length;
        if (flaggedCount === board[key]) {
            startTimer();
            const chordRevealedKeys = [];
            for (const [r, c] of neighbors) {
                const nKey = `${r},${c}`;
                if (!revealed[nKey] && !flagged[nKey]) {
                    if (board[nKey] === -1) {
                        mineLocations.forEach(([mr, mc]) => {
                            if (!flagged[`${mr},${mc}`]) setCellState(mr, mc, 'mine');
                        });
                        gameOver = true;
                        clearInterval(timerInterval);
                        if (MP.isMultiplayer() && !opts.fromRemote) {
                            MP.send({ type: 'reveal', key: nKey });
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
            if (MP.isMultiplayer() && !opts.fromRemote && chordRevealedKeys.length > 0) {
                MP.send({ type: 'chord', keys: chordRevealedKeys });
            }
            vibrate(30);
            checkWin();
            return;
        }
        return;
    }

    if (revealed[key] || flagged[key]) return;
    startTimer();

    if (board[key] === -1) {
        mineLocations.forEach(([r, c]) => {
            if (!flagged[`${r},${c}`]) setCellState(r, c, 'mine');
        });
        gameOver = true;
        clearInterval(timerInterval);
        vibrate([100, 50, 100]);
        if (MP.isMultiplayer() && !opts.fromRemote) MP.send({ type: 'reveal', key });
        showGameResult(false);
        return;
    }

    vibrate(30);
    revealCell(row, col);
    if (MP.isMultiplayer() && !opts.fromRemote) MP.send({ type: 'reveal', key });
    checkWin();
}

// 首次点击专用：安全放雷后揭开格子
function _revealCell_firstClick(row, col) {
    firstClick = false;
    _setSettingsLocked(true);
    _placeMines(row, col);
    // 联机模式：本端触发首次点击，将雷位发送给对方
    if (MP.isMultiplayer()) {
        mpSentBoardInit = true;
        MP.send({
            type: 'board-init',
            mineLocations: mineLocations.map(([r, c]) => `${r},${c}`)
        });
    }
    startTimer();
    vibrate(30);
    revealCell(row, col);
    checkWin();
}

function handleTouchStart(e, row, col) {
    e.preventDefault();
    const key = `${row},${col}`;
    touchLongPressFired[key] = false;
    clearTimeout(touchHoldTimers[key]);
    // 长按：打开格子（reveal）
    touchHoldTimers[key] = setTimeout(() => {
        touchLongPressFired[key] = true;
        handleRightClick({ preventDefault() {} }, row, col);
    }, 450);
}

function handleTouchEnd(e, row, col) {
    e.preventDefault();
    const key = `${row},${col}`;
    clearTimeout(touchHoldTimers[key]);
    delete touchHoldTimers[key];
    if (touchLongPressFired[key]) {
        delete touchLongPressFired[key];
        return;
    }
    // 短按：标记旗子（或首次点击打开格子）
    handleClick(row, col);
}

function handleTouchCancel(row, col) {
    const key = `${row},${col}`;
    clearTimeout(touchHoldTimers[key]);
    delete touchHoldTimers[key];
    delete touchLongPressFired[key];
}

function revealCell(row, col, fromRemote = false) {
    const startKey = `${row},${col}`;
    if (!(startKey in board)) return; // 不是有效格子（sides===8 扩展网格中的空位）
    if (revealed[startKey] || flagged[startKey]) return;

    const queue = [[row, col]];
    const queued = Object.create(null);
    queued[startKey] = true;
    const updates = [];

    for (let head = 0; head < queue.length; head++) {
        const [cr, cc] = queue[head];
        const key = `${cr},${cc}`;
        if (!(key in board) || revealed[key] || flagged[key]) continue;

        revealed[key] = true;
        revealedCount++;
        const value = board[key];
        updates.push([cr, cc, value]);

        if (value !== 0) continue;

        for (const [nr, nc] of _getNeighborsCached(cr, cc)) {
            const nKey = `${nr},${nc}`;
            if (!revealed[nKey] && !flagged[nKey] && !queued[nKey]) {
                queued[nKey] = true;
                queue.push([nr, nc]);
            }
        }
    }

    for (const [ur, uc, value] of updates) {
        setCellState(ur, uc, 'revealed', value);
    }

    if (MP.isMultiplayer() && updates.length > 0) {
        if (fromRemote) { mpPartnerRevealCount += updates.length; }
        else            { mpMyRevealCount += updates.length; }
        _updateMpStats();
    }
}

function _getNeighborsCached(row, col) {
    return neighborsCache[`${row},${col}`] || [];
}

// 批量翻格（供远端 chord 消息使用）
function revealCells(keys, fromRemote) {
    for (const key of keys) {
        const [r, c] = key.split(',').map(Number);
        revealCell(r, c, fromRemote);
    }
}

// Guest 收到 board-init 后用房主的雷位初始化棋盘
function initBoardFromRemote(mineLocationKeys) {
    mineLocations = mineLocationKeys.map(k => k.split(',').map(Number));
    totalMines = mineLocations.length;
    mineCount = totalMines;
    for (const [r, c] of mineLocations) {
        board[`${r},${c}`] = -1;
    }
    for (const [r, c] of mineLocations) {
        for (const [nr, nc] of _getNeighborsCached(r, c)) {
            const nKey = `${nr},${nc}`;
            if (board[nKey] !== -1) board[nKey]++;
        }
    }
    firstClick = false;
    mpWaitingBoardInit = false;
    _setSettingsLocked(true);
    _updateGameStatus();
    startTimer();
    // 游戏正式开始，恢复状态栏显示
    const st = document.getElementById('mpStatus');
    if (st) st.textContent = '🟢 对方在线';
}

function _updateMpStats() {
    const myEl = document.getElementById('mpMyReveal');
    const partnerEl = document.getElementById('mpPartnerReveal');
    if (myEl) myEl.textContent = `你：已翻 ${mpMyRevealCount} 格`;
    if (partnerEl) partnerEl.textContent = `对方：已翻 ${mpPartnerRevealCount} 格`;
}
function checkWin() {
    if (revealedCount === totalCellsCount - totalMines) {
        gameOver = true;
        clearInterval(timerInterval);
        mineLocations.forEach(([r, c]) => {
            if (!flagged[`${r},${c}`]) setCellState(r, c, 'flagged');
        });
        showGameResult(true);
    }
}

function _setSettingsLocked(locked) {
    ['rows', 'cols', 'mines'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = locked;
    });
    // 仅锁定单人模式的形状按钮，排除联机大厅的 mp-side-btn
    document.querySelectorAll('.side-btn:not(.mp-side-btn)').forEach(btn => {
        btn.disabled = locked;
        btn.classList.toggle('disabled', locked);
    });
}

// ─── 棋盘平移与缩放 ──────────────────────────────────────────────────

// 拖动超过此阈值才进入平移模式，否则视为点击
let _isPanning = false;

(function initPan() {
    const DRAG_THRESHOLD = 6;

    let dragging = false;
    let startX = 0, startY = 0;
    let panX = 0, panY = 0;
    let lastPanX = 0, lastPanY = 0;
    let scale = 1; // 缩放比例
    let wheelDX = 0, wheelDY = 0;
    let wheelRAF = 0;
    let touchPanRAF = 0;
    let wheelPanCleanupTimer = 0;

    // 双指缩放相关
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let pinchStartCenter = { x: 0, y: 0 };
    let pinchStartPan = { x: 0, y: 0 };
    let isPinching = false;

    function getViewport() { return document.getElementById('boardViewport'); }
    function getBoard()    { return document.getElementById('board'); }

    function clampPan(vp, board, nx, ny) {
        const vpW = vp.clientWidth,  vpH = vp.clientHeight;
        // 缩放后的棋盘尺寸
        const bW  = board.offsetWidth * scale, bH = board.offsetHeight * scale;
        const minX = bW > vpW ? -(bW - vpW) / 2 : 0;
        const minY = bH > vpH ? -(bH - vpH) / 2 : 0;
        const maxX = bW > vpW ? (bW - vpW) / 2 : 0;
        const maxY = bH > vpH ? (bH - vpH) / 2 : 0;
        return [
            Math.min(maxX, Math.max(minX, nx)),
            Math.min(maxY, Math.max(minY, ny)),
        ];
    }

    function applyTransform() {
        const board = getBoard();
        if (board) {
            // CSS 设置了 left:50% top:50%，所以 transform 只需要额外的平移和缩放
            board.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${scale})`;
        }
    }

    function _scheduleWheelPanClassClear() {
        clearTimeout(wheelPanCleanupTimer);
        wheelPanCleanupTimer = setTimeout(() => {
            if (!dragging && !isPinching) getViewport()?.classList.remove('panning');
        }, 120);
    }

    function flushWheelPan() {
        wheelRAF = 0;
        const dx = wheelDX, dy = wheelDY;
        wheelDX = 0; wheelDY = 0;

        const vp = getViewport(), board = getBoard();
        if (!vp || !board) return;
        [panX, panY] = clampPan(vp, board, panX - dx, panY - dy);
        applyTransform();
        _scheduleWheelPanClassClear();
    }

    // 计算两点距离
    function getTouchDistance(t1, t2) {
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        return Math.hypot(dx, dy);
    }

    // 计算两点中点
    function getTouchCenter(t1, t2) {
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    }

    // 缩放到指定点（以视口坐标为中心）
    function zoomAtPoint(newScale, centerX, centerY) {
        const vp = getViewport(), board = getBoard();
        if (!vp || !board) return;

        const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        if (clampedScale === scale) return;

        // 视口中心相对于棋盘的位置
        const vpRect = vp.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();

        // 计算缩放中心相对于棋盘当前显示位置的比例
        const boardCenterX = boardRect.left + boardRect.width / 2;
        const boardCenterY = boardRect.top + boardRect.height / 2;

        // 缩放前后棋盘中心偏移
        const scaleRatio = clampedScale / scale;

        // 调整 pan 以保持缩放中心不变
        const dx = centerX - boardCenterX;
        const dy = centerY - boardCenterY;

        panX = panX + dx * (1 - scaleRatio);
        panY = panY + dy * (1 - scaleRatio);

        scale = clampedScale;

        // 重新约束平移范围
        [panX, panY] = clampPan(vp, board, panX, panY);
        applyTransform();
    }

    function onWheel(e) {
        const vp = getViewport(), board = getBoard();
        if (!vp || !board) return;

        // Ctrl+滚轮：缩放
        if (e.ctrlKey) {
            e.preventDefault();
            _isPanning = true;

            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = scale * delta;

            zoomAtPoint(newScale, e.clientX, e.clientY);

            vp.classList.add('panning');
            _scheduleWheelPanClassClear();
            setTimeout(() => { _isPanning = false; }, 30);
            return;
        }

        // 普通滚轮：平移
        const canPanX = board.offsetWidth * scale > vp.clientWidth;
        const canPanY = board.offsetHeight * scale > vp.clientHeight;
        if (!canPanX && !canPanY) return;

        const dx = canPanX ? e.deltaX : 0;
        const dy = canPanY ? e.deltaY : 0;
        if (dx === 0 && dy === 0) return;

        e.preventDefault();
        _isPanning = true;
        vp.classList.add('panning');
        clearTimeout(wheelPanCleanupTimer);
        wheelDX += dx;
        wheelDY += dy;
        if (!wheelRAF) wheelRAF = requestAnimationFrame(flushWheelPan);
        setTimeout(() => { _isPanning = false; }, 30);
    }

    // ── 鼠标（桌面端）──
    function onMouseDown(e) {
        if (e.button !== 0) return;
        dragging = true;
        _isPanning = false;
        startX = e.clientX; startY = e.clientY;
        lastPanX = panX; lastPanY = panY;
    }

    function onMouseMove(e) {
        if (!dragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!_isPanning && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        _isPanning = true;
        getViewport()?.classList.add('panning');
        const vp = getViewport(), board = getBoard();
        if (!vp || !board) return;
        [panX, panY] = clampPan(vp, board, lastPanX + dx, lastPanY + dy);
        applyTransform();
    }

    function onMouseUp() {
        if (!dragging) return;
        dragging = false;
        getViewport()?.classList.remove('panning');
        if (_isPanning) setTimeout(() => { _isPanning = false; }, 30);
        else _isPanning = false;
    }

    // ── 触摸（移动端）──
    function onTouchStart(e) {
        if (e.touches.length === 1) {
            // 单指：准备平移
            dragging = true;
            isPinching = false;
            _isPanning = false;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            lastPanX = panX;
            lastPanY = panY;
        } else if (e.touches.length === 2) {
            // 双指：准备缩放+平移
            isPinching = true;
            dragging = false;
            _isPanning = true;

            // 取消所有长按计时器
            Object.keys(touchHoldTimers).forEach(k => {
                clearTimeout(touchHoldTimers[k]);
                delete touchHoldTimers[k];
                delete touchLongPressFired[k];
            });

            pinchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
            pinchStartScale = scale;
            pinchStartCenter = getTouchCenter(e.touches[0], e.touches[1]);
            pinchStartPan = { x: panX, y: panY };

            // 记录初始触摸位置用于计算平移
            startX = pinchStartCenter.x;
            startY = pinchStartCenter.y;
            lastPanX = panX;
            lastPanY = panY;

            getViewport()?.classList.add('panning');
        }
    }

    function onTouchMove(e) {
        if (e.touches.length === 1 && dragging && !isPinching) {
            // 单指平移
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            if (!_isPanning && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

            if (!_isPanning) {
                // 刚越过阈值：取消所有长按计时器，防止误触发开格子
                Object.keys(touchHoldTimers).forEach(k => {
                    clearTimeout(touchHoldTimers[k]);
                    delete touchHoldTimers[k];
                    delete touchLongPressFired[k];
                });
            }
            _isPanning = true;
            e.preventDefault();
            getViewport()?.classList.add('panning');
            const vp = getViewport(), board = getBoard();
            if (!vp || !board) return;
            [panX, panY] = clampPan(vp, board, lastPanX + dx, lastPanY + dy);
            if (!touchPanRAF) {
                touchPanRAF = requestAnimationFrame(() => {
                    touchPanRAF = 0;
                    applyTransform();
                });
            }
        } else if (e.touches.length === 2 && isPinching) {
            // 双指缩放+平移
            e.preventDefault();

            const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
            const currentCenter = getTouchCenter(e.touches[0], e.touches[1]);

            // 计算新缩放比例
            const newScale = pinchStartScale * (currentDist / pinchStartDist);
            const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

            // 计算双指中点的平移偏移
            const dx = currentCenter.x - pinchStartCenter.x;
            const dy = currentCenter.y - pinchStartCenter.y;

            const vp = getViewport(), board = getBoard();
            if (vp && board) {
                // 以双指中心点为锚点进行缩放补偿：
                // 缩放前，双指中心点相对于棋盘 CSS 中心的屏幕距离 = pinchStartCenter - boardScreenCenter
                // boardScreenCenter = vpCenter + pinchStartPan（因为 board 用 left:50%+translate(-50%,-50%) 居中，再加 pan 偏移）
                const vpRect = vp.getBoundingClientRect();
                const vpCenterX = vpRect.left + vpRect.width / 2;
                const vpCenterY = vpRect.top + vpRect.height / 2;

                // 双指起始中心相对于棋盘变换原点（CSS 中心）的偏移
                const offsetX = pinchStartCenter.x - (vpCenterX + pinchStartPan.x);
                const offsetY = pinchStartCenter.y - (vpCenterY + pinchStartPan.y);

                // 缩放比例变化
                const scaleRatio = clampedScale / pinchStartScale;

                // 新的 pan = 起始 pan + 中点平移 + 缩放中心补偿
                const newPanX = pinchStartPan.x + dx + offsetX * (1 - scaleRatio);
                const newPanY = pinchStartPan.y + dy + offsetY * (1 - scaleRatio);

                scale = clampedScale;
                [panX, panY] = clampPan(vp, board, newPanX, newPanY);
            }

            if (!touchPanRAF) {
                touchPanRAF = requestAnimationFrame(() => {
                    touchPanRAF = 0;
                    applyTransform();
                });
            }
        }
    }

    function onTouchEnd(e) {
        if (e.touches.length === 0) {
            // 所有手指离开
            if (dragging || isPinching) {
                dragging = false;
                isPinching = false;
                // 确保最后一次 transform 被应用
                if (touchPanRAF) {
                    cancelAnimationFrame(touchPanRAF);
                    touchPanRAF = 0;
                    applyTransform();
                }
                getViewport()?.classList.remove('panning');
                if (_isPanning) setTimeout(() => { _isPanning = false; }, 30);
                else _isPanning = false;
            }
        } else if (e.touches.length === 1 && isPinching) {
            // 从双指变为单指：切换到单指平移模式
            isPinching = false;
            dragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            lastPanX = panX;
            lastPanY = panY;
        }
    }

    // 脚本在 body 末尾，DOM 已就绪
    const vp = getViewport();
    if (vp) {
        vp.addEventListener('mousedown',   onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);

        // passive:false 让 touchmove 能调用 preventDefault
        vp.addEventListener('touchstart', onTouchStart, { passive: true });
        vp.addEventListener('touchmove',  onTouchMove,  { passive: false });
        vp.addEventListener('touchend',   onTouchEnd,   { passive: true });
        vp.addEventListener('touchcancel',onTouchEnd,   { passive: true });
        vp.addEventListener('wheel',      onWheel,      { passive: false });
    }

    function centerPan() {
        const vp = getViewport(), board = getBoard();
        if (!vp || !board) return;
        // 棋盘居中
        panX = 0;
        panY = 0;
        scale = 1;
        applyTransform();
    }

    window._panReset = () => { panX = 0; panY = 0; scale = 1; applyTransform(); };
    window._panCenter = centerPan;
    window._getScale = () => scale;
})();

// ─── 入口 ─────────────────────────────────────────────────────

// 初始化震动模块
if (window.HapticsAdapter) {
    HapticsAdapter.init();
}

// 初始化时应用默认设置
selectSides(4);
selectDifficulty('medium');
_updatePreviewInfo();

// 初始显示模式选择屏
showScreen('modeScreen');
