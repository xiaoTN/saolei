// geometry.js
// 各多边形的顶点坐标、邻居、画布尺寸计算
// 依赖外部变量：cellSize, rows, cols（由 game.js 提供）

// ─── 行列映射系数 ───────────────────────────────────────────
// 不同多边形的实际行列数与用户设置的映射关系
// 三角形：实际列数 = 用户设置 × 2（使棋盘更宽）

function getActualRows(sides) {
    return rows;
}

function getActualCols(sides) {
    if (sides === 3) return cols * 2;
    return cols;
}

function _mixCenter(gr, gc) {
    const step = cellSize / 2;
    return [gc * step + step, gr * step + step];
}

// ─── 三角形（3边）────────────────────────────────────────────
// 平铺规律：(row+col)%2==0 → 尖朝上，==1 → 尖朝下
// 水平步进 cellSize/2，行高 cellSize*√3/2
// 每格 3 个邻居（经数学验证）

function triType(row, col) {
    return (row + col) % 2 === 0 ? 'up' : 'down';
}

function triVertices(row, col) {
    const h = cellSize * Math.sqrt(3) / 2;
    const s = cellSize;
    const x0 = col * s / 2, y0 = row * h;
    if (triType(row, col) === 'up') {
        return [[x0 + s/2, y0], [x0 + s, y0 + h], [x0, y0 + h]];
    } else {
        return [[x0, y0], [x0 + s, y0], [x0 + s/2, y0 + h]];
    }
}

function triNeighbors(row, col) {
    // 顶点邻居（共享至少一个顶点即计入，经数学验证）
    // up  偏移：[-1,-1],[-1,0],[-1,1],[0,-2],[0,-1],[0,1],[0,2],[1,-2],[1,-1],[1,0],[1,1],[1,2]
    // down偏移：[-1,-2],[-1,-1],[-1,0],[-1,1],[-1,2],[0,-2],[0,-1],[0,1],[0,2],[1,-1],[1,0],[1,1]
    const offsets = triType(row, col) === 'up'
        ? [[-1,-1],[-1,0],[-1,1],[0,-2],[0,-1],[0,1],[0,2],[1,-2],[1,-1],[1,0],[1,1],[1,2]]
        : [[-1,-2],[-1,-1],[-1,0],[-1,1],[-1,2],[0,-2],[0,-1],[0,1],[0,2],[1,-1],[1,0],[1,1]];
    const actualCols = getActualCols(3);
    return offsets
        .map(([dr, dc]) => [row + dr, col + dc])
        .filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < actualCols);
}

function triBoardSize() {
    const h = cellSize * Math.sqrt(3) / 2;
    const actualCols = getActualCols(3);
    return {
        width:  Math.ceil(actualCols * cellSize / 2 + cellSize / 2) + 4,
        height: Math.ceil(rows * h) + 4,
    };
}

// ─── 正方形（4边）────────────────────────────────────────────
// 标准8邻居（含对角）

function sqVertices(row, col) {
    const s = cellSize, x0 = col * s, y0 = row * s;
    return [[x0, y0], [x0+s, y0], [x0+s, y0+s], [x0, y0+s]];
}

function sqNeighbors(row, col) {
    const nb = [];
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) nb.push([nr, nc]);
        }
    return nb;
}

function sqBoardSize() {
    return { width: cols * cellSize + 2, height: rows * cellSize + 2 };
}

// ─── 六边形（6边）────────────────────────────────────────────
// pointy-top（尖顶朝上）蜂窝平铺
// 外接圆半径 R = cellSize/2
// 偶数行不偏移，奇数行水平右移 R*√3/2
// 每格 6 个邻居

function hexCenter(row, col) {
    const R = cellSize / 2;
    const sq3 = Math.sqrt(3);
    const cx = col * R * sq3 + (row % 2 === 1 ? R * sq3 / 2 : 0) + R;
    const cy = row * R * 1.5 + R;
    return [cx, cy];
}

function hexVertices(row, col) {
    const [cx, cy] = hexCenter(row, col);
    const R = cellSize / 2;
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30); // pointy-top：从右上角开始
        pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return pts;
}

function hexNeighbors(row, col) {
    const nb = [];
    if (row % 2 === 0) {
        if (row > 0)      { nb.push([row-1, col-1]); nb.push([row-1, col]); }
        if (col > 0)        nb.push([row, col-1]);
        if (col < cols-1)   nb.push([row, col+1]);
        if (row < rows-1) { nb.push([row+1, col-1]); nb.push([row+1, col]); }
    } else {
        if (row > 0)      { nb.push([row-1, col]);   nb.push([row-1, col+1]); }
        if (col > 0)        nb.push([row, col-1]);
        if (col < cols-1)   nb.push([row, col+1]);
        if (row < rows-1) { nb.push([row+1, col]);   nb.push([row+1, col+1]); }
    }
    return nb.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols);
}

function hexBoardSize() {
    const R = cellSize / 2, sq3 = Math.sqrt(3);
    return {
        width:  Math.ceil(cols * R * sq3 + R * sq3 / 2 + R * 2) + 4,
        height: Math.ceil(rows * R * 1.5 + R * 0.5 + R * 2) + 4,
    };
}

// ─── 八边形+正方形（8边）─────────────────────────────────────
// 使用扩展网格坐标 (gr, gc)，步进 = cellSize：
//   八边形：gr = 2*r,   gc = 2*c    (r∈[0,rows), c∈[0,cols))
//   小正方形：gr = 2*r+1, gc = 2*c+1 (r∈[0,rows-1), c∈[0,cols-1))
//
// 八边形边长 a = cellSize/(1+√2)，小正方形边长 = a（与八边形截角边等长）
// 八边形中心步进 = cellSize，小正方形中心在四个八边形中心的几何中心
//
// 扩展网格中心坐标：cx = gc*cellSize/2 + cellSize/2, cy = gr*cellSize/2 + cellSize/2
//
// 邻居关系（扩展网格坐标）：
//   八边形(gr,gc) → 4个正方形(gr±1, gc±1) + 4个八边形(gr, gc±2)和(gr±2, gc)
//   正方形(gr,gc) → 4个八边形(gr±1, gc±1)
//
// game.js 中 rows/cols 指八边形的行列数
// 所有格子通过 octSqAllCells() 枚举

function _octSqCenter(gr, gc) {
    return _mixCenter(gr, gc);
}

function _octVertices(cx, cy) {
    const a = cellSize / (1 + Math.SQRT2); // 八边形边长
    const s = a / 2;                        // 半边长
    const t = a * Math.SQRT2 / 2;          // 截角水平/垂直投影 = s+t = cellSize/2
    return [
        [cx - s, cy - s - t],
        [cx + s, cy - s - t],
        [cx + s + t, cy - s],
        [cx + s + t, cy + s],
        [cx + s, cy + s + t],
        [cx - s, cy + s + t],
        [cx - s - t, cy + s],
        [cx - s - t, cy - s],
    ];
}

function _sqSmallVertices(cx, cy) {
    // 小正方形实为旋转45°的菱形，顶点在上下左右
    // 半对角线 = t = a*√2/2，其中 a = cellSize/(1+√2)
    // 顶点恰好与四周八边形的截角端点重合（数学验证）
    const a = cellSize / (1 + Math.SQRT2);
    const t = a * Math.SQRT2 / 2;
    return [
        [cx,     cy - t], // 上
        [cx + t, cy    ], // 右
        [cx,     cy + t], // 下
        [cx - t, cy    ], // 左
    ];
}

// (gr, gc) 是扩展网格坐标
function octSqVertices(gr, gc) {
    const [cx, cy] = _octSqCenter(gr, gc);
    return gr % 2 === 0 ? _octVertices(cx, cy) : _sqSmallVertices(cx, cy);
}

// game.js 用 key=`${gr},${gc}` 索引，需要提供枚举所有有效格的方法
// 有效格：gr偶gc偶（八边形）或 gr奇gc奇（正方形）
function octSqAllCells() {
    const cells = [];
    const grMax = 2 * rows - 1;
    const gcMax = 2 * cols - 1;
    for (let gr = 0; gr < grMax; gr++)
        for (let gc = 0; gc < gcMax; gc++)
            if ((gr + gc) % 2 === 0) cells.push([gr, gc]);
    return cells;
}

function octSqNeighbors(gr, gc) {
    const nb = [];
    const grMax = 2 * rows - 1;
    const gcMax = 2 * cols - 1;
    if (gr % 2 === 0) {
        // 八边形 → 4个正方形(对角) + 4个八边形(上下左右各2步)
        const diag = [[-1,-1],[-1,1],[1,-1],[1,1]];
        const axial = [[-2,0],[2,0],[0,-2],[0,2]];
        for (const [dr, dc] of [...diag, ...axial]) {
            const nr = gr + dr, nc = gc + dc;
            if (nr >= 0 && nr < grMax && nc >= 0 && nc < gcMax && (nr + nc) % 2 === 0)
                nb.push([nr, nc]);
        }
    } else {
        // 正方形 → 4个八边形(对角)
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            const nr = gr + dr, nc = gc + dc;
            if (nr >= 0 && nr < grMax && nc >= 0 && nc < gcMax)
                nb.push([nr, nc]);
        }
    }
    return nb;
}

function octSqBoardSize() {
    const grMax = 2 * rows - 1;
    const gcMax = 2 * cols - 1;
    const step = cellSize / 2;
    return {
        width:  Math.ceil(gcMax * step + step) + 4,
        height: Math.ceil(grMax * step + step) + 4,
    };
}

// ─── 三六混合镶嵌（36边）────────────────────────────────────────
// 扩展网格坐标 (gr, gc)：
//   六边形：gr偶, gc偶
//   三角形（尖朝上）：gr偶, gc奇
//   三角形（尖朝下）：gr奇, gc偶
//   无效：gr奇, gc奇
// 有效格判断：gr%2===0 || gc%2===0

function triHexCellType(gr, gc) {
    if (gr % 2 === 0 && gc % 2 === 0) return 'hex';
    if (gr % 2 === 1) return 'triDown';
    return 'triUp'; // gc % 2 === 1
}

function triHexCenter(gr, gc) {
    const R = cellSize / 2;
    const sq3 = Math.sqrt(3);
    const stepX = R * sq3 / 2;
    const stepY = R * 1.5;
    return [gc * stepX + R, gr * stepY + R];
}

function triHexVertices(gr, gc) {
    const [cx, cy] = triHexCenter(gr, gc);
    const R = cellSize / 2;
    const type = triHexCellType(gr, gc);

    if (type === 'hex') {
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const a = Math.PI / 180 * (60 * i - 30);
            pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
        }
        return pts;
    }

    // 三角形
    const a = R; // 边长
    const h = a * Math.sqrt(3) / 2;
    if (type === 'triUp') {
        return [
            [cx, cy - h * 2/3],
            [cx + a/2, cy + h/3],
            [cx - a/2, cy + h/3]
        ];
    } else { // triDown
        return [
            [cx - a/2, cy - h/3],
            [cx + a/2, cy - h/3],
            [cx, cy + h * 2/3]
        ];
    }
}

function triHexAllCells() {
    const cells = [];
    const grMax = 2 * rows;
    const gcMax = 2 * cols;
    for (let gr = 0; gr < grMax; gr++) {
        for (let gc = 0; gc < gcMax; gc++) {
            if (gr % 2 === 0 || gc % 2 === 0) {
                cells.push([gr, gc]);
            }
        }
    }
    return cells;
}

function triHexNeighbors(gr, gc) {
    const nb = [];
    const grMax = 2 * rows;
    const gcMax = 2 * cols;
    const type = triHexCellType(gr, gc);

    // 边界内判断
    const valid = (r, c) => r >= 0 && r < grMax && c >= 0 && c < gcMax && (r % 2 === 0 || c % 2 === 0);

    if (type === 'hex') {
        // 六边形：6个三角形（共享边）+ 6个六边形（共享顶点）
        const triOffsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,1],[1,-1]];
        const hexOffsets = [[-2,0],[2,0],[0,-2],[0,2],[-2,2],[2,-2]];
        for (const [dr, dc] of [...triOffsets, ...hexOffsets]) {
            const nr = gr + dr, nc = gc + dc;
            if (valid(nr, nc)) nb.push([nr, nc]);
        }
    } else {
        // 三角形：3个六边形（共享边）+ 6个三角形（共享顶点）
        // 偏移表根据三角形朝向不同
        const offsets = type === 'triUp'
            ? [[-1,0],[0,-1],[0,1],[-1,-1],[-1,1],[0,-2],[0,2],[1,0],[1,-1],[1,1]]
            : [[1,0],[0,-1],[0,1],[1,-1],[1,1],[0,-2],[0,2],[-1,0],[-1,-1],[-1,1]];
        for (const [dr, dc] of offsets) {
            const nr = gr + dr, nc = gc + dc;
            if (valid(nr, nc)) nb.push([nr, nc]);
        }
    }
    return nb;
}

function triHexBoardSize() {
    const R = cellSize / 2;
    const sq3 = Math.sqrt(3);
    const stepX = R * sq3 / 2;
    const stepY = R * 1.5;
    const grMax = 2 * rows;
    const gcMax = 2 * cols;
    return {
        width: Math.ceil(gcMax * stepX + R * 2) + 4,
        height: Math.ceil(grMax * stepY + R * 2) + 4,
    };
}

// ─── 统一接口 ─────────────────────────────────────────────────

function getCellVertices(sides, row, col) {
    if (sides === 3) return triVertices(row, col);
    if (sides === 4) return sqVertices(row, col);
    if (sides === 6) return hexVertices(row, col);
    if (sides === 8) return octSqVertices(row, col); // row,col 是扩展网格坐标 gr,gc
    if (sides === 36) return triHexVertices(row, col);
}

function getCellCenter(sides, row, col) {
    const verts = getCellVertices(sides, row, col);
    const x = verts.reduce((s, v) => s + v[0], 0) / verts.length;
    const y = verts.reduce((s, v) => s + v[1], 0) / verts.length;
    return [x, y];
}

// 返回所有有效格子坐标列表（sides===8/36 时用扩展网格）
function getAllCells(sides) {
    if (sides === 8) return octSqAllCells();
    if (sides === 36) return triHexAllCells();
    const cells = [];
    const actualRows = getActualRows(sides);
    const actualCols = getActualCols(sides);
    for (let r = 0; r < actualRows; r++)
        for (let c = 0; c < actualCols; c++)
            cells.push([r, c]);
    return cells;
}

function getNeighbors(sides, row, col) {
    let nb;
    if (sides === 3) nb = triNeighbors(row, col);
    else if (sides === 4) nb = sqNeighbors(row, col);
    else if (sides === 6) nb = hexNeighbors(row, col);
    else if (sides === 8) nb = octSqNeighbors(row, col);
    else if (sides === 36) nb = triHexNeighbors(row, col);
    else nb = [];
    // sides===8/36 的边界检查已在各自函数内完成
    if (sides !== 8 && sides !== 36) {
        const actualCols = getActualCols(sides);
        nb = nb.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < actualCols);
    }
    return nb;
}

function getBoardSize(sides) {
    if (sides === 3) return triBoardSize();
    if (sides === 4) return sqBoardSize();
    if (sides === 6) return hexBoardSize();
    if (sides === 8) return octSqBoardSize();
    if (sides === 36) return triHexBoardSize();
    return { width: 400, height: 400 };
}
