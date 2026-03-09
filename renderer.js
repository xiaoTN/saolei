// renderer.js
// Canvas 棋盘渲染器（优化大棋盘性能）
// 依赖：geometry.js（getCellVertices）
//       game.js 中的全局变量：sides, rows, cols, revealed, flagged, gameOver, NUM_COLORS

// ─── 渲染器状态 ─────────────────────────────────────────────────

// Canvas 元素
let mainCanvas = null;      // 主显示 Canvas（视口大小）
let mainCtx = null;
let offscreenCanvas = null; // 离屏 Canvas（完整棋盘大小）
let offscreenCtx = null;

// 格子元数据：key → { row, col, vertices, centerX, centerY, state, value }
let cellMetaMap = Object.create(null);

// 棋盘尺寸
let boardWidth = 0;
let boardHeight = 0;

// 渲染令牌（用于取消正在进行的分帧渲染）
let renderToken = 0;

// 悬停格子
let hoveredCell = null;

// ─── 常量 ─────────────────────────────────────────────────────

const NUM_COLORS = {
    1: '#4a9eff', 2: '#2ed573', 3: '#ff4757',
    4: '#a55eea', 5: '#ffa502', 6: '#1dd1a1',
    7: '#ff6b81', 8: '#70a1ff',
};

// ─── 创建棋盘 ──────────────────────────────────────────────────

function createSVGBoard(boardEl, width, height, allCells = null) {
    // 兼容旧 API 名称，实际使用 Canvas 渲染
    _createCanvasBoard(boardEl, width, height, allCells);
}

function _createCanvasBoard(boardEl, width, height, allCells = null) {
    const token = ++renderToken;
    
    // 清理旧状态
    cellMetaMap = Object.create(null);
    hoveredCell = null;
    boardWidth = width;
    boardHeight = height;
    
    // 获取视口尺寸
    const viewport = document.getElementById('boardViewport');
    const vpWidth = viewport ? viewport.clientWidth : width;
    const vpHeight = viewport ? viewport.clientHeight : height;
    
    // 创建主 Canvas（视口大小）
    mainCanvas = document.createElement('canvas');
    mainCanvas.width = vpWidth;
    mainCanvas.height = vpHeight;
    mainCanvas.style.display = 'block';
    mainCanvas.style.cursor = 'grab';
    mainCtx = mainCanvas.getContext('2d');
    
    // 创建离屏 Canvas（完整棋盘大小）
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    offscreenCtx = offscreenCanvas.getContext('2d');
    
    // 清空并挂载
    boardEl.innerHTML = '';
    boardEl.style.width = width + 'px';
    boardEl.style.height = height + 'px';
    boardEl.appendChild(mainCanvas);
    
    // 绑定事件
    _attachCanvasEvents(mainCanvas);
    
    // 构建格子元数据
    const cells = allCells || getAllCells(sides);
    
    // 大棋盘分帧渲染到离屏 Canvas
    const CHUNK_THRESHOLD = 3000;
    if (cells.length <= CHUNK_THRESHOLD) {
        // 小棋盘：直接渲染
        for (const [r, c] of cells) {
            if (token !== renderToken) return;
            _initCell(r, c);
            _drawCellToOffscreen(r, c, 'normal');
        }
        _buildSpatialIndex();
        _renderToMain();
    } else {
        // 大棋盘：分帧渲染
        let index = 0;
        const chunkSize = 400;
        
        function renderChunk() {
            if (token !== renderToken) return;
            const end = Math.min(index + chunkSize, cells.length);
            for (; index < end; index++) {
                const [r, c] = cells[index];
                _initCell(r, c);
                _drawCellToOffscreen(r, c, 'normal');
            }
            _renderToMain();
            
            if (index < cells.length) {
                requestAnimationFrame(renderChunk);
            } else {
                // 渲染完成后构建空间索引
                _buildSpatialIndex();
            }
        }
        
        requestAnimationFrame(renderChunk);
    }
}

// 初始化格子元数据
function _initCell(row, col) {
    const key = `${row},${col}`;
    const vertices = getCellVertices(sides, row, col);
    const [cx, cy] = _getCenterFromVerts(vertices);
    
    // 八边形扩展网格中的小格子使用更小字号
    const isSmallCell = (sides === 8 && row % 2 === 1);
    const fontSize = isSmallCell ? 8 : (sides === 3 ? 11 : 13);
    
    cellMetaMap[key] = {
        key,
        row,
        col,
        vertices,
        centerX: cx,
        centerY: cy,
        fontSize,
        state: 'normal',
        value: ''
    };
}

function _getCenterFromVerts(verts) {
    let x = 0, y = 0;
    for (const [vx, vy] of verts) {
        x += vx;
        y += vy;
    }
    return [x / verts.length, y / verts.length];
}

// ─── 绘制格子 ──────────────────────────────────────────────────

// 绘制单个格子到离屏 Canvas
function _drawCellToOffscreen(row, col, state, value = '') {
    const key = `${row},${col}`;
    const meta = cellMetaMap[key];
    if (!meta) return;
    
    meta.state = state;
    meta.value = value;
    
    _drawCell(offscreenCtx, meta);
}

// 通用绘制方法
function _drawCell(ctx, meta) {
    const { vertices, centerX, centerY, fontSize, state, value } = meta;
    
    // 绘制多边形
    ctx.beginPath();
    ctx.moveTo(vertices[0][0], vertices[0][1]);
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i][0], vertices[i][1]);
    }
    ctx.closePath();
    
    // 填充
    switch (state) {
        case 'normal':
            // 渐变填充
            const grad = ctx.createLinearGradient(
                vertices[0][0], vertices[0][1],
                vertices[vertices.length - 1][0], vertices[vertices.length - 1][1]
            );
            grad.addColorStop(0, '#3a3a5c');
            grad.addColorStop(1, '#2a2a4c');
            ctx.fillStyle = grad;
            break;
        case 'revealed':
            ctx.fillStyle = '#1a1a2e';
            break;
        case 'flagged':
            ctx.fillStyle = '#2a1a3c';
            break;
        case 'mine':
            ctx.fillStyle = '#ff4757';
            break;
        case 'hover':
            ctx.fillStyle = '#4a4a7c';
            break;
        case 'hover-flagged':
            ctx.fillStyle = '#3a1a4c';
            break;
    }
    ctx.fill();
    
    // 描边
    ctx.strokeStyle = '#0f0f23';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // 绘制文本/图标
    if (state === 'revealed' && value > 0) {
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = NUM_COLORS[value] || '#fff';
        ctx.fillText(String(value), centerX, centerY + fontSize * 0.1);
    } else if (state === 'flagged' || state === 'hover-flagged') {
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('🚩', centerX, centerY);
    } else if (state === 'mine') {
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText('💣', centerX, centerY);
    }
}

// ─── 渲染到主 Canvas ───────────────────────────────────────────

// 当前 pan 偏移（由 game.js 设置）
let currentPanX = 0;
let currentPanY = 0;

// 渲染节流
let renderPending = false;

// 设置 pan 偏移（由 game.js 调用）
function _setPanOffset(x, y) {
    currentPanX = x;
    currentPanY = y;
}

// 从离屏 Canvas 复制到主 Canvas（带 pan 偏移）
function _renderToMain() {
    if (!mainCtx || !offscreenCanvas) return;
    
    // 节流：多个调用合并到一帧
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
        renderPending = false;
        _doRender();
    });
}

// 实际渲染
function _doRender() {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    
    // 计算棋盘左上角在视口中的位置
    // CSS: left: 50%, top: 50%, transform: translate(-50%, -50%) translate(panX, panY)
    // 棋盘左上角 = (视口中心 - 棋盘半宽 + panX, 视口中心 - 棋盘半高 + panY)
    const vpW = mainCanvas.width;
    const vpH = mainCanvas.height;
    const bw = offscreenCanvas.width;
    const bh = offscreenCanvas.height;
    
    // 棋盘左上角在视口中的位置
    const boardLeft = (vpW / 2) - (bw / 2) + currentPanX;
    const boardTop = (vpH / 2) - (bh / 2) + currentPanY;
    
    // 计算源矩形（离屏 Canvas 坐标系）
    // 如果 boardLeft < 0，说明棋盘左边在视口外，需要从离屏 Canvas 的 -boardLeft 开始复制
    const srcX = Math.max(0, -boardLeft);
    const srcY = Math.max(0, -boardTop);
    const srcW = Math.min(bw - srcX, vpW);
    const srcH = Math.min(bh - srcY, vpH);
    
    // 计算目标位置（主 Canvas 坐标系）
    const dstX = Math.max(0, boardLeft);
    const dstY = Math.max(0, boardTop);
    
    if (srcW > 0 && srcH > 0) {
        mainCtx.drawImage(
            offscreenCanvas,
            srcX, srcY, srcW, srcH,
            dstX, dstY, srcW, srcH
        );
    }
}

// 强制立即渲染（用于状态变化后）
function _renderImmediate() {
    renderPending = false;
    _doRender();
}

// 全局函数：供 game.js 调用
window._renderCanvas = _renderToMain;
window._setPanOffset = _setPanOffset;

// ─── 事件处理 ──────────────────────────────────────────────────

function _attachCanvasEvents(canvas) {
    // 鼠标事件
    canvas.addEventListener('mousemove', _onMouseMove);
    canvas.addEventListener('mouseleave', _onMouseLeave);
    canvas.addEventListener('click', _onClick);
    canvas.addEventListener('contextmenu', _onContextMenu);
    
    // 触摸事件
    canvas.addEventListener('touchstart', _onTouchStart, { passive: false });
    canvas.addEventListener('touchend', _onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', _onTouchCancel);
}

function _getCanvasCoords(e) {
    const rect = mainCanvas.getBoundingClientRect();
    if (e.touches) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// 将视口坐标转换为棋盘坐标
function _viewportToBoard(vx, vy) {
    const vpW = mainCanvas.width;
    const vpH = mainCanvas.height;
    const bw = offscreenCanvas.width;
    const bh = offscreenCanvas.height;
    
    // 棋盘左上角在视口中的位置
    const boardLeft = (vpW / 2) - (bw / 2) + currentPanX;
    const boardTop = (vpH / 2) - (bh / 2) + currentPanY;
    
    // 视口坐标 → 棋盘坐标
    return {
        x: vx - boardLeft,
        y: vy - boardTop
    };
}

// 检测点是否在多边形内
function _pointInPolygon(px, py, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i][0], yi = vertices[i][1];
        const xj = vertices[j][0], yj = vertices[j][1];
        
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

// ─── 空间索引（加速点击检测）────────────────────────────────

// 网格索引：将棋盘划分为多个桶，每个桶存储包含在该区域的格子
let spatialIndex = null;
let spatialGridSize = 60; // 每个桶的大小（像素）

// 构建空间索引
function _buildSpatialIndex() {
    const cols = Math.ceil(boardWidth / spatialGridSize);
    const rows = Math.ceil(boardHeight / spatialGridSize);
    spatialIndex = [];
    
    for (let i = 0; i < rows * cols; i++) {
        spatialIndex.push([]);
    }
    
    // 将每个格子添加到其覆盖的所有桶
    for (const key in cellMetaMap) {
        const meta = cellMetaMap[key];
        const bounds = _getCellBounds(meta.vertices);
        
        const minCol = Math.floor(bounds.minX / spatialGridSize);
        const maxCol = Math.floor(bounds.maxX / spatialGridSize);
        const minRow = Math.floor(bounds.minY / spatialGridSize);
        const maxRow = Math.floor(bounds.maxY / spatialGridSize);
        
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const idx = r * cols + c;
                if (idx >= 0 && idx < spatialIndex.length) {
                    spatialIndex[idx].push(meta);
                }
            }
        }
    }
}

// 获取格子的边界框
function _getCellBounds(vertices) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of vertices) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY };
}

// 使用空间索引查找格子
function _findCellAtPoint(bx, by) {
    if (!spatialIndex) {
        // 回退到全遍历
        for (const key in cellMetaMap) {
            const meta = cellMetaMap[key];
            if (_pointInPolygon(bx, by, meta.vertices)) {
                return meta;
            }
        }
        return null;
    }
    
    const cols = Math.ceil(boardWidth / spatialGridSize);
    const col = Math.floor(bx / spatialGridSize);
    const row = Math.floor(by / spatialGridSize);
    const idx = row * cols + col;
    
    if (idx < 0 || idx >= spatialIndex.length) return null;
    
    // 只检查该桶中的格子
    for (const meta of spatialIndex[idx]) {
        if (_pointInPolygon(bx, by, meta.vertices)) {
            return meta;
        }
    }
    return null;
}

function _onMouseMove(e) {
    if (gameOver) return;
    
    const coords = _getCanvasCoords(e);
    const boardCoords = _viewportToBoard(coords.x, coords.y);
    const cell = _findCellAtPoint(boardCoords.x, boardCoords.y);
    
    if (cell !== hoveredCell) {
        // 恢复旧悬停格子
        if (hoveredCell && !revealed[hoveredCell.key]) {
            _drawCellToOffscreen(hoveredCell.row, hoveredCell.col, 
                flagged[hoveredCell.key] ? 'flagged' : 'normal');
        }
        
        // 设置新悬停格子
        hoveredCell = cell;
        if (cell && !revealed[cell.key]) {
            _drawCellToOffscreen(cell.row, cell.col, 
                flagged[cell.key] ? 'hover-flagged' : 'hover');
        }
        
        _renderToMain();
    }
}

function _onMouseLeave() {
    if (hoveredCell && !revealed[hoveredCell.key]) {
        _drawCellToOffscreen(hoveredCell.row, hoveredCell.col, 
            flagged[hoveredCell.key] ? 'flagged' : 'normal');
        hoveredCell = null;
        _renderToMain();
    }
    hoveredCell = null;
}

function _onClick(e) {
    if (typeof _isPanning !== 'undefined' && _isPanning) return;
    
    const coords = _getCanvasCoords(e);
    const boardCoords = _viewportToBoard(coords.x, coords.y);
    const cell = _findCellAtPoint(boardCoords.x, boardCoords.y);
    
    if (cell) {
        handleClick(cell.row, cell.col);
    }
}

function _onContextMenu(e) {
    e.preventDefault();
    if (typeof _isPanning !== 'undefined' && _isPanning) return;
    
    const coords = _getCanvasCoords(e);
    const boardCoords = _viewportToBoard(coords.x, coords.y);
    const cell = _findCellAtPoint(boardCoords.x, boardCoords.y);
    
    if (cell) {
        handleRightClick(e, cell.row, cell.col);
    }
}

function _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length !== 1) return;
    
    const coords = _getCanvasCoords(e);
    const boardCoords = _viewportToBoard(coords.x, coords.y);
    const cell = _findCellAtPoint(boardCoords.x, boardCoords.y);
    
    if (cell) {
        handleTouchStart(e, cell.row, cell.col);
    }
}

function _onTouchEnd(e) {
    e.preventDefault();
    if (e.touches.length > 0) return;
    
    const coords = _getCanvasCoords(e.changedTouches ? { touches: e.changedTouches } : e);
    const boardCoords = _viewportToBoard(coords.x, coords.y);
    const cell = _findCellAtPoint(boardCoords.x, boardCoords.y);
    
    if (cell) {
        handleTouchEnd(e, cell.row, cell.col);
    }
}

function _onTouchCancel(e) {
    // 触摸取消时，清理所有计时器
    for (const key in cellMetaMap) {
        handleTouchCancel(cellMetaMap[key].row, cellMetaMap[key].col);
    }
}

// ─── 状态更新 API ──────────────────────────────────────────────

// 查找格子的 DOM 元素（兼容旧 API，返回 null）
function getSVGCell(row, col) {
    return null; // Canvas 渲染没有 DOM 元素
}

// 更新格子的视觉状态
function setCellState(row, col, state, value = '') {
    _drawCellToOffscreen(row, col, state, value);
    _renderImmediate(); // 状态变化需要立即渲染
}

// ─── 视口调整 ──────────────────────────────────────────────────

// 响应窗口大小变化
function resizeCanvas() {
    if (!mainCanvas) return;
    
    const viewport = document.getElementById('boardViewport');
    if (!viewport) return;
    
    mainCanvas.width = viewport.clientWidth;
    mainCanvas.height = viewport.clientHeight;
    _renderToMain();
}

// 监听窗口大小变化
window.addEventListener('resize', () => {
    // 延迟处理，等待 CSS 布局完成
    setTimeout(resizeCanvas, 100);
});

// ─── 调试工具 ──────────────────────────────────────────────────

// 导出调试接口
window._rendererDebug = {
    getCellCount: () => Object.keys(cellMetaMap).length,
    getMainCanvas: () => mainCanvas,
    getOffscreenCanvas: () => offscreenCanvas,
};
