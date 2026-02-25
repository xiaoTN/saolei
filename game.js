// game.js
// 游戏状态与核心逻辑
// 依赖：geometry.js（getNeighbors, getBoardSize, getCellVertices, getCellCenter）
//       renderer.js（createSVGBoard, setCellState）

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
let timer       = 0;
let timerInterval = null;
let touchHoldTimers = {};
let touchLongPressFired = {};

// 由 HTML 控件读取/设置
let rows     = 8;
let cols     = 8;
let sides    = 4;
let cellSize = 44;
const SUPPORTED_SIDES = new Set([3, 4, 6, 8]);

// ─── 初始化 ────────────────────────────────────────────────────

// 边数按钮选择
function selectSides(s) {
    sides = SUPPORTED_SIDES.has(s) ? s : 4;
    // 更新按钮选中状态
    document.querySelectorAll('.side-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.sides) === sides);
    });
    // 更新 cellSize
    const sizeMap = { 3: 48, 4: 40, 6: 44, 8: 44 };
    cellSize = sizeMap[sides] || 44;
    // 预览画布（游戏未开始时）
    if (firstClick) previewBoardSize();
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
    // 初始化 sides 和 cellSize
    const selectedBtn = document.querySelector('.side-btn.selected');
    sides = selectedBtn ? parseInt(selectedBtn.dataset.sides) : 4;
    if (!SUPPORTED_SIDES.has(sides)) sides = 4;
    const sizeMap = { 3: 48, 4: 40, 6: 44, 8: 44 };
    cellSize = sizeMap[sides] || 44;
    rows = parseInt(document.getElementById('rows').value);
    cols = parseInt(document.getElementById('cols').value);
    totalMines = parseInt(document.getElementById('mines').value);
    mineCount = totalMines;

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
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    const { width, height } = getBoardSize(sides);
    boardEl.style.width  = width  + 'px';
    boardEl.style.height = height + 'px';

    const allCells = getAllCells(sides);
    const totalCells = allCells.length;
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
    const allCells = getAllCells(sides);
    const safeKeys = new Set(
        [[ safeRow, safeCol ], ...getNeighbors(sides, safeRow, safeCol)]
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
    return getNeighbors(sides, row, col)
        .filter(([r, c]) => board[`${r},${c}`] === -1).length;
}

function _updateStatusBar() {
    const allCells = getAllCells(sides);
    const totalCells = allCells.length;
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

// 单击：标记 / 取消标记旗子（首次点击例外，直接打开格子）
function handleClick(row, col) {
    const key = `${row},${col}`;
    if (gameOver) return;

    // 首次点击：无论何种操作都直接打开格子，触发安全放雷
    if (firstClick) {
        _revealCell_firstClick(row, col);
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
    _updateStatusBar();
}

// 右键单击 / 长按：打开格子（reveal）
function handleRightClick(e, row, col) {
    e.preventDefault();
    const key = `${row},${col}`;
    if (gameOver) return;

    // 首次点击：直接打开格子
    if (firstClick) {
        _revealCell_firstClick(row, col);
        return;
    }

    // 如果点击的是已揭示的数字格子，检查是否可以快速开雷
    if (revealed[key] && board[key] > 0) {
        const neighbors = getNeighbors(sides, row, col);
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
    const key = `${row},${col}`;
    if (!(key in board)) return; // 不是有效格子（sides===8 扩展网格中的空位）
    if (revealed[key] || flagged[key]) return;

    revealed[key] = true;
    setCellState(row, col, 'revealed', board[key]);

    if (board[key] === 0) {
        getNeighbors(sides, row, col).forEach(([r, c]) => revealCell(r, c));
    }
}

function checkWin() {
    const allCells = getAllCells(sides);
    const totalCells = allCells.length;
    let revealedCount = 0;
    for (const [r, c] of allCells)
        if (revealed[`${r},${c}`]) revealedCount++;

    if (revealedCount === totalCells - totalMines) {
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

// ─── 入口 ─────────────────────────────────────────────────────

initGame();
