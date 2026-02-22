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

// 由 HTML 控件读取/设置
let rows     = 8;
let cols     = 8;
let sides    = 4;
let cellSize = 44;

// ─── 初始化 ────────────────────────────────────────────────────

function updateCellSize() {
    sides = parseInt(document.getElementById('sides').value);
    const sizeMap = { 3: 48, 4: 40, 6: 44, 8: 44 };
    cellSize = sizeMap[sides] || 44;
}

// 游戏未开始时，滑动条变化时预览画布大小
function previewBoardSize() {
    if (!firstClick) return; // 游戏已开始，不预览

    rows = parseInt(document.getElementById('rows').value);
    cols = parseInt(document.getElementById('cols').value);

    _buildBoard();
}

function initGame() {
    updateCellSize();
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
    if (mineCount < 1) { mineCount = 1; totalMines = 1; }

    board = {}; revealed = {}; flagged = {};
    mineLocations = []; gameOver = false; firstClick = true; timer = 0;

    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    document.getElementById('mineCount').textContent = mineCount;
    document.getElementById('timer').textContent = '0';
    document.getElementById('message').className = 'message';
    document.getElementById('message').textContent = '';

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

    // 更新雷密度
    const density = Math.round(totalMines / totalCells * 100);
    document.getElementById('mineDensity').textContent = density + '%';
    _updateFlagProgress();

    // 校正雷数上限
    const maxMinesAllowed = Math.floor(totalCells * 0.8);
    if (mineCount > maxMinesAllowed) {
        mineCount = maxMinesAllowed;
        totalMines = mineCount;
        document.getElementById('mineCount').textContent = mineCount;
    }

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
        document.getElementById('mineCount').textContent = mineCount;
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

function startTimer() {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            timer++;
            document.getElementById('timer').textContent = timer;
        }, 1000);
    }
}

function _updateFlagProgress() {
    const flaggedCount = totalMines - mineCount;
    document.getElementById('flagProgress').textContent = `${flaggedCount}/${totalMines}`;
}

function handleClick(row, col) {
    const key = `${row},${col}`;
    if (gameOver) return;

    // 首次点击：此时还没有地雷，先放雷再处理点击
    if (firstClick) {
        firstClick = false;
        _placeMines(row, col);
        startTimer();
        revealCell(row, col);
        checkWin();
        return;
    }

    // 如果点击的是已揭示的数字格子，检查是否可以快速开雷
    if (revealed[key] && board[key] > 0) {
        const neighbors = getNeighbors(sides, row, col);
        const flaggedCount = neighbors.filter(([r, c]) => flagged[`${r},${c}`]).length;
        // 周围已标记的雷数等于数字时，自动点开周围格子
        if (flaggedCount === board[key]) {
            startTimer();
            neighbors.forEach(([r, c]) => {
                const nKey = `${r},${c}`;
                if (!revealed[nKey] && !flagged[nKey]) {
                    if (board[nKey] === -1) {
                        mineLocations.forEach(([mr, mc]) => setCellState(mr, mc, 'mine'));
                        gameOver = true;
                        clearInterval(timerInterval);
                        _showMessage('💥 游戏结束！你踩到雷了', 'lose');
                    } else {
                        revealCell(r, c);
                    }
                }
            });
            checkWin();
            return;
        }
    }

    if (revealed[key] || flagged[key]) return;
    startTimer();

    if (board[key] === -1) {
        mineLocations.forEach(([r, c]) => setCellState(r, c, 'mine'));
        gameOver = true;
        clearInterval(timerInterval);
        _showMessage('💥 游戏结束！你踩到雷了', 'lose');
        return;
    }

    revealCell(row, col);
    checkWin();
}

function handleRightClick(e, row, col) {
    e.preventDefault();
    const key = `${row},${col}`;
    if (gameOver || revealed[key]) return;
    startTimer();

    if (flagged[key]) {
        flagged[key] = false;
        setCellState(row, col, 'normal');
        document.getElementById('mineCount').textContent = ++mineCount;
    } else {
        flagged[key] = true;
        setCellState(row, col, 'flagged');
        document.getElementById('mineCount').textContent = --mineCount;
    }
    _updateFlagProgress();
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

// ─── 入口 ─────────────────────────────────────────────────────

initGame();
