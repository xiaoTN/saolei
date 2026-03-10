// renderer.js
// Canvas 棋盘的创建与格子状态更新（替代 SVG，优化大棋盘性能）
// 依赖：geometry.js（getCellVertices）
//       game.js 中的全局变量：sides, rows, cols, revealed, flagged, gameOver, NUM_COLORS

let cellDomMap = Object.create(null);
let boardRenderToken = 0;

// Canvas 相关变量
let canvasEl = null;
let ctx = null;
let boardWidth = 0;
let boardHeight = 0;
let cellStates = Object.create(null); // key -> { state, value }
let hoveredCell = null; // 当前悬停的格子 key

// 渐变颜色（模拟 SVG 的 linearGradient）
const GRADIENT_COLORS = {
    start: '#3a3a5c',
    end: '#2a2a4c',
};

// 创建整个 Canvas 棋盘，挂载到 boardEl
function createSVGBoard(boardEl, width, height, allCells = null) {
    const renderToken = ++boardRenderToken;
    cellDomMap = Object.create(null);
    cellStates = Object.create(null);
    hoveredCell = null;

    boardWidth = width;
    boardHeight = height;

    // 创建 Canvas 元素
    canvasEl = document.createElement('canvas');
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.display = 'block';
    canvasEl.style.cursor = 'pointer';

    // 获取 2D 上下文
    ctx = canvasEl.getContext('2d');

    // 初始化所有格子的状态
    const cells = allCells || getAllCells(sides);
    for (const [row, col] of cells) {
        const key = `${row},${col}`;
        cellStates[key] = { state: 'normal', value: '' };

        // 扩展网格中的辅助连接格（8+4 的小正方形 / 36 的三角形）使用更小字号
        const isSmallCell = (sides === 8 && row % 2 === 1) || (sides === 36 && (row % 2 === 1 || col % 2 === 1));
        // Cairo 五边形使用稍小字体
        const fontSize = isSmallCell ? 9 : (sides === 3 ? 11 : sides === 5 ? 12 : 13);

        const cellMeta = { key, row, col, fontSize };
        cellDomMap[key] = cellMeta;
    }

    // 挂载 Canvas
    boardEl.appendChild(canvasEl);

    // 绑定事件
    _attachCanvasEvents(canvasEl);

    // 绘制初始状态
    _renderBoard();
}

// 绘制整个棋盘
function _renderBoard() {
    if (!ctx || !canvasEl) return;

    // 清空画布
    ctx.clearRect(0, 0, boardWidth, boardHeight);

    // 绘制所有格子
    for (const key in cellDomMap) {
        const { row, col } = cellDomMap[key];
        _drawCell(row, col);
    }
}

// 绘制单个格子
function _drawCell(row, col) {
    if (!ctx) return;

    const key = `${row},${col}`;
    const state = cellStates[key];
    if (!state) return;

    const { row: _, col: __, fontSize } = cellDomMap[key];
    const verts = getCellVertices(sides, row, col);
    const [cx, cy] = _getCenterFromVerts(verts);

    // 绘制多边形
    ctx.beginPath();
    ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i][0], verts[i][1]);
    }
    ctx.closePath();

    // 设置填充色
    let fillColor;
    switch (state.state) {
        case 'normal':
            // 使用渐变
            const isHovered = (hoveredCell === key && !gameOver && !revealed[key]);
            if (isHovered) {
                fillColor = flagged[key] ? '#3a1a4c' : '#4a4a7c';
            } else {
                fillColor = flagged[key] ? '#2a1a3c' : _createGradientFill(verts);
            }
            break;
        case 'revealed':
            fillColor = '#1a1a2e';
            break;
        case 'flagged':
            fillColor = '#2a1a3c';
            break;
        case 'mine':
            fillColor = '#ff4757';
            break;
        default:
            fillColor = _createGradientFill(verts);
    }

    ctx.fillStyle = fillColor;
    ctx.fill();

    // 绘制边框
    ctx.strokeStyle = '#0f0f23';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 绘制文字/符号
    if (state.state === 'revealed' && state.value > 0) {
        ctx.fillStyle = NUM_COLORS[state.value] || '#fff';
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(state.value, cx, cy);
    } else if (state.state === 'flagged') {
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', cx, cy);
    } else if (state.state === 'mine') {
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', cx, cy);
    }
}

// 创建渐变填充
function _createGradientFill(verts) {
    // 计算边界框
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of verts) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    // 创建线性渐变
    const gradient = ctx.createLinearGradient(minX, minY, maxX, maxY);
    gradient.addColorStop(0, GRADIENT_COLORS.start);
    gradient.addColorStop(1, GRADIENT_COLORS.end);

    return gradient;
}

// 计算多边形中心
function _getCenterFromVerts(verts) {
    let x = 0, y = 0;
    for (const [vx, vy] of verts) {
        x += vx;
        y += vy;
    }
    return [x / verts.length, y / verts.length];
}

// 绑定 Canvas 事件
function _attachCanvasEvents(canvas) {
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cell = _getCellFromPoint(x, y);
        if (!cell) {
            if (hoveredCell) {
                const oldKey = hoveredCell;
                hoveredCell = null;
                const old = cellDomMap[oldKey];
                if (old) _drawCell(old.row, old.col);
            }
            return;
        }

        if (hoveredCell !== cell.key) {
            const oldKey = hoveredCell;
            hoveredCell = cell.key;
            if (oldKey) {
                const old = cellDomMap[oldKey];
                if (old) _drawCell(old.row, old.col);
            }
            _drawCell(cell.row, cell.col);
        }
    });

    canvas.addEventListener('mouseleave', e => {
        if (hoveredCell) {
            const old = cellDomMap[hoveredCell];
            hoveredCell = null;
            if (old) _drawCell(old.row, old.col);
        }
    });

    canvas.addEventListener('click', e => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cell = _getCellFromPoint(x, y);
        if (!cell) return;
        handleClick(cell.row, cell.col);
    });

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cell = _getCellFromPoint(x, y);
        if (!cell) return;
        handleRightClick(e, cell.row, cell.col);
    });

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const cell = _getCellFromPoint(x, y);
        if (!cell) return;
        handleTouchStart(e, cell.row, cell.col);
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const cell = _getCellFromPoint(x, y);
        if (!cell) return;
        handleTouchEnd(e, cell.row, cell.col);
    }, { passive: false });

    canvas.addEventListener('touchcancel', e => {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const cell = _getCellFromPoint(x, y);
        if (!cell) return;
        handleTouchCancel(cell.row, cell.col);
    });
}

// 根据坐标获取格子（点检测）
function _getCellFromPoint(x, y) {
    // 对于正方形格子，直接计算行列（快速路径）
    if (sides === 4) {
        const col = Math.floor(x / cellSize);
        const row = Math.floor(y / cellSize);
        const key = `${row},${col}`;
        return cellDomMap[key] || null;
    }

    // 其他形状：使用边界框快速排除 + 精确多边形检测
    for (const key in cellDomMap) {
        const { row, col } = cellDomMap[key];
        const verts = getCellVertices(sides, row, col);

        // 快速边界框检测
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [vx, vy] of verts) {
            minX = Math.min(minX, vx);
            minY = Math.min(minY, vy);
            maxX = Math.max(maxX, vx);
            maxY = Math.max(maxY, vy);
        }
        if (x < minX || x > maxX || y < minY || y > maxY) continue;

        // 精确多边形检测
        if (_pointInPolygon(x, y, verts)) {
            return cellDomMap[key];
        }
    }
    return null;
}

// 点是否在多边形内（射线法）
function _pointInPolygon(x, y, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i][0], yi = verts[i][1];
        const xj = verts[j][0], yj = verts[j][1];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// 查找格子的元数据（兼容旧 API）
function getSVGCell(row, col) {
    return cellDomMap[`${row},${col}`] || null;
}

// 更新格子的视觉状态
// state: 'normal' | 'revealed' | 'flagged' | 'mine'
// value: 数字（仅 revealed 状态使用）
function setCellState(row, col, state, value = '') {
    const key = `${row},${col}`;
    if (!cellStates[key]) return;

    cellStates[key] = { state, value };
    _drawCell(row, col);
}
