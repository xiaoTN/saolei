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
    mineLocations = []; gameOver = false; timer = 0;

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

    // 初始化格子数据
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
            const key = `${i},${j}`;
            board[key] = 0; revealed[key] = false; flagged[key] = false;
        }

    // 随机放置地雷
    let placed = 0;
    while (placed < mineCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        const key = `${r},${c}`;
        if (board[key] !== -1) {
            board[key] = -1;
            mineLocations.push([r, c]);
            placed++;
        }
    }

    // 计算每格周围雷数
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
            const key = `${i},${j}`;
            if (board[key] !== -1)
                board[key] = _countAdjacentMines(i, j);
        }

    createSVGBoard(boardEl, width, height);
}

// ─── 核心逻辑 ──────────────────────────────────────────────────

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

function handleClick(row, col) {
    const key = `${row},${col}`;
    if (gameOver || revealed[key] || flagged[key]) return;
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
}

function revealCell(row, col) {
    const key = `${row},${col}`;
    if (revealed[key] || flagged[key]) return;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;

    revealed[key] = true;
    setCellState(row, col, 'revealed', board[key]);

    if (board[key] === 0) {
        getNeighbors(sides, row, col).forEach(([r, c]) => revealCell(r, c));
    }
}

function checkWin() {
    let revealedCount = 0;
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
            if (revealed[`${i},${j}`]) revealedCount++;

    if (revealedCount === rows * cols - totalMines) {
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
