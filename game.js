// game.js
// 游戏状态与核心逻辑
// 依赖：geometry.js（getNeighbors, getBoardSize, getCellVertices, getCellCenter）
//       renderer.js（createSVGBoard, setCellState）

// ─── 工具函数 ──────────────────────────────────────────────────

function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
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

// 由 HTML 控件读取/设置
let rows     = 10;
let cols     = 10;
let sides    = 4;
let cellSize = 44;
const SUPPORTED_SIDES = new Set([3, 4, 6, 8]);

let currentDifficulty = 'medium';

// 各难度在不同边数下的预设 [rows, cols, mines]
// 难度预设 [rows, cols, mines]
// 参考 Windows 经典扫雷标准（初级9x9/10雷12%，中级16x16/40雷16%，专家16x30/99雷21%）
// 各棋盘类型按邻居数调整体感难度：邻居越多信息越丰富，可适当提高密度
const DIFFICULTY_PRESETS = {
    3: {
        // 三角形实际可用信息量接近正方形，密度对齐经典标准
        easy:   [9,  16,  18],   // 144格，密度 12.5%
        medium: [12, 20,  40],   // 240格，密度 16.7%
        hard:   [16, 28, 100],   // 448格，密度 22.3%
    },
    4: {
        // 对齐 Windows 经典标准
        easy:   [9,  9,  10],    // 81格，密度 12.3%
        medium: [16, 16, 40],    // 256格，密度 15.6%
        hard:   [16, 30, 99],    // 480格，密度 20.6%
    },
    6: {
        // 六边形6邻居，信息量略少于正方形8邻居，密度略低
        easy:   [8,  8,  10],    // 64格，密度 15.6%
        medium: [11, 13, 30],    // 143格，密度 21.0%  ← 体感≈正方形中等
        hard:   [14, 18, 60],    // 252格，密度 23.8%
    },
    8: {
        // 八边形+菱形混合，总格数 = rows*cols + (rows-1)*(cols-1)
        easy:   [5,  6,  10],    // 30+20=50格，密度 20.0%
        medium: [7,  8,  28],    // 56+42=98格，密度 28.6%
        hard:   [9, 10,  55],    // 90+72=162格，密度 34.0%
    },
};

// ─── 初始化 ────────────────────────────────────────────────────

// 边数按钮选择
function selectSides(s) {
    sides = SUPPORTED_SIDES.has(s) ? s : 4;
    document.querySelectorAll('.side-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.sides) === sides);
    });
    const sizeMap = { 3: 48, 4: 40, 6: 44, 8: 44 };
    cellSize = sizeMap[sides] || 44;
    if (firstClick) {
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
        if (firstClick) previewBoardSize();
    } else {
        customEl.style.display = 'none';
        if (firstClick) _applyDifficultyPreset(diff);
    }
}

// 将难度预设同步到滑动条并更新画布预览
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

    _buildBoard();
}

// 游戏未开始时，雷数滑动条变化时立即更新状态栏
function previewMineCount() {
    if (!firstClick) return;
    totalMines = parseInt(document.getElementById('mines').value);
    mineCount = totalMines;
    _updateStatusBar();
}

// 游戏未开始时，边数/行列滑动条变化时立即预览画布
function previewBoardSize() {
    if (!firstClick) return; // 游戏进行中，不预览

    rows = parseInt(document.getElementById('rows').value);
    cols = parseInt(document.getElementById('cols').value);

    _buildBoard();
}

function initGame() {
    const selectedBtn = document.querySelector('.side-btn.selected');
    sides = selectedBtn ? parseInt(selectedBtn.dataset.sides) : 4;
    if (!SUPPORTED_SIDES.has(sides)) sides = 4;
    const sizeMap = { 3: 48, 4: 40, 6: 44, 8: 44 };
    cellSize = sizeMap[sides] || 44;

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

    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    document.getElementById('timer').textContent = '0';
    document.getElementById('message').className = 'message';
    document.getElementById('message').textContent = '';
    _setSettingsLocked(false);

    _buildBoard();
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
    document.getElementById('cellCount').textContent = totalCells;

    // 校正雷数上限
    const maxMinesAllowed = Math.floor(totalCells * 0.8);
    if (mineCount > maxMinesAllowed) {
        mineCount = maxMinesAllowed;
        totalMines = mineCount;
        document.getElementById('mines').value = mineCount;
        document.getElementById('mines-val').textContent = String(mineCount);
    }

    _updateStatusBar();

    // 初始化格子数据（全部为 0，雷在首次点击后放置）
    for (const [r, c] of allCells) {
        const key = `${r},${c}`;
        board[key] = 0; revealed[key] = false; flagged[key] = false;
    }

    createSVGBoard(boardEl, width, height);
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

    let placed = 0;
    // 如果候选格子不够放所有雷，尽量多放
    const actualMines = Math.min(mineCount, candidates.length);
    if (actualMines < mineCount) {
        mineCount = actualMines;
        totalMines = actualMines;
    }

    while (placed < actualMines) {
        const idx = Math.floor(Math.random() * candidates.length);
        const [r, c] = candidates[idx];
        const key = `${r},${c}`;
        if (board[key] !== -1) {
            board[key] = -1;
            mineLocations.push([r, c]);
            placed++;
        }
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

function _updateStatusBar() {
    const totalCells = totalCellsCount;
    const ratioNum = totalCells > 0 ? totalMines / totalCells * 100 : 0;
    const flaggedCount = totalMines - mineCount;

    const ratioEl = document.getElementById('mineRatio');
    ratioEl.textContent = ratioNum.toFixed(1) + '%';
    ratioEl.className = ratioNum < 15 ? 'easy' : ratioNum < 25 ? 'medium' : 'hard';

    document.getElementById('flagProgress').textContent = flaggedCount;
    document.getElementById('totalMinesDisplay').textContent = totalMines;
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
function handleClick(row, col) {
    if (_isPanning) return;
    const key = `${row},${col}`;
    if (gameOver) return;

    // 首次点击：无论何种操作都直接打开格子，触发安全放雷
    if (firstClick) {
        _revealCell_firstClick(row, col);
        return;
    }

    // 已揭示的数字格：快速开雷
    if (revealed[key] && board[key] > 0) {
        const neighbors = _getNeighborsCached(row, col);
        const flaggedCount = neighbors.filter(([r, c]) => flagged[`${r},${c}`]).length;
        if (flaggedCount === board[key]) {
            startTimer();
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
                        _showMessage('💥 游戏结束！你踩到雷了', 'lose');
                        return;
                    } else {
                        revealCell(r, c);
                    }
                }
            }
            if (gameOver) return;
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
    _updateStatusBar();
}

// 右键单击 / 长按：打开格子（reveal）
function handleRightClick(e, row, col) {
    e.preventDefault();
    if (_isPanning) return;
    const key = `${row},${col}`;
    if (gameOver) return;

    // 首次点击：直接打开格子
    if (firstClick) {
        _revealCell_firstClick(row, col);
        return;
    }

    // 如果点击的是已揭示的数字格子，检查是否可以快速开雷
    if (revealed[key] && board[key] > 0) {
        const neighbors = _getNeighborsCached(row, col);
        const flaggedCount = neighbors.filter(([r, c]) => flagged[`${r},${c}`]).length;
        if (flaggedCount === board[key]) {
            startTimer();
            for (const [r, c] of neighbors) {
                const nKey = `${r},${c}`;
                if (!revealed[nKey] && !flagged[nKey]) {
                    if (board[nKey] === -1) {
                        mineLocations.forEach(([mr, mc]) => {
                            if (!flagged[`${mr},${mc}`]) setCellState(mr, mc, 'mine');
                        });
                        gameOver = true;
                        clearInterval(timerInterval);
                        _showMessage('💥 游戏结束！你踩到雷了', 'lose');
                        return;
                    } else {
                        revealCell(r, c);
                    }
                }
            }
            if (gameOver) return;
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
        _showMessage('💥 游戏结束！你踩到雷了', 'lose');
        return;
    }

    revealCell(row, col);
    checkWin();
}

// 首次点击专用：安全放雷后揭开格子
function _revealCell_firstClick(row, col) {
    firstClick = false;
    _setSettingsLocked(true);
    _placeMines(row, col);
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

function revealCell(row, col) {
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
}

function _getNeighborsCached(row, col) {
    return neighborsCache[`${row},${col}`] || [];
}

function checkWin() {
    if (revealedCount === totalCellsCount - totalMines) {
        gameOver = true;
        clearInterval(timerInterval);
        mineLocations.forEach(([r, c]) => {
            if (!flagged[`${r},${c}`]) setCellState(r, c, 'flagged');
        });
        _showMessage(`🎉 恭喜！你赢了！用时 ${timer} 秒`, 'win');
    }
}

function _showMessage(text, type) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.className = `message ${type}`;
}

function _setSettingsLocked(locked) {
    ['rows', 'cols', 'mines'].forEach(id => {
        document.getElementById(id).disabled = locked;
    });
    document.querySelectorAll('.side-btn').forEach(btn => {
        btn.disabled = locked;
        btn.classList.toggle('disabled', locked);
    });
}

// ─── 棋盘平移 ──────────────────────────────────────────────────

// 拖动超过此阈值才进入平移模式，否则视为点击
let _isPanning = false;

(function initPan() {
    const DRAG_THRESHOLD = 6;

    let dragging = false;
    let startX = 0, startY = 0;
    let panX = 0, panY = 0;
    let lastPanX = 0, lastPanY = 0;

    function getViewport() { return document.getElementById('boardViewport'); }
    function getBoard()    { return document.getElementById('board'); }

    function clampPan(vp, board, nx, ny) {
        const vpW = vp.clientWidth,  vpH = vp.clientHeight;
        const bW  = board.offsetWidth, bH = board.offsetHeight;
        const minX = bW > vpW ? -(bW - vpW) : 0;
        const minY = bH > vpH ? -(bH - vpH) : 0;
        const maxX = bW > vpW ? 0 : vpW - bW;
        const maxY = bH > vpH ? 0 : vpH - bH;
        return [
            Math.min(maxX, Math.max(minX, nx)),
            Math.min(maxY, Math.max(minY, ny)),
        ];
    }

    function applyTransform() {
        const board = getBoard();
        if (board) board.style.transform = `translate(${panX}px, ${panY}px)`;
    }

    // ── 鼠标（桌面端）──
    // mousedown 在视口捕获起点，move/up 挂在 document 确保拖出边界也能跟踪
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
    // 触摸事件与格子上的 touchstart/touchend 游戏逻辑共存：
    // 视口上的 touchstart 仅记录起点，不阻止冒泡；
    // touchmove 超过阈值后才进入平移模式并 preventDefault 阻止页面滚动；
    // 平移状态下 touchend 会被格子的 handleTouchEnd 检测到 _isPanning 而忽略。
    function onTouchStart(e) {
        if (e.touches.length !== 1) return;
        dragging = true;
        _isPanning = false;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        lastPanX = panX; lastPanY = panY;
    }

    function onTouchMove(e) {
        if (!dragging || e.touches.length !== 1) return;
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
        e.preventDefault(); // 阻止页面滚动
        getViewport()?.classList.add('panning');
        const vp = getViewport(), board = getBoard();
        if (!vp || !board) return;
        [panX, panY] = clampPan(vp, board, lastPanX + dx, lastPanY + dy);
        applyTransform();
    }

    function onTouchEnd() {
        if (!dragging) return;
        dragging = false;
        getViewport()?.classList.remove('panning');
        if (_isPanning) setTimeout(() => { _isPanning = false; }, 30);
        else _isPanning = false;
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
    }

    window._panReset = () => { panX = 0; panY = 0; applyTransform(); };
})();

// ─── 入口 ─────────────────────────────────────────────────────

// 初始化时应用默认难度（触发预设同步和画布预览）
selectDifficulty('medium');
initGame();
