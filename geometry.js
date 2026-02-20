// geometry.js
// 各多边形的顶点坐标、邻居、画布尺寸计算
// 依赖外部变量：cellSize, rows, cols（由 game.js 提供）

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
    const nb = [];
    if (col > 0) nb.push([row, col - 1]);
    if (col < cols - 1) nb.push([row, col + 1]);
    if (triType(row, col) === 'up') {
        if (row < rows - 1) nb.push([row + 1, col]);
    } else {
        if (row > 0) nb.push([row - 1, col]);
    }
    return nb;
}

function triBoardSize() {
    const h = cellSize * Math.sqrt(3) / 2;
    return {
        width:  Math.ceil(cols * cellSize / 2 + cellSize / 2) + 4,
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
// (row+col)%2==0 → 八边形，==1 → 填隙小正方形
// 边长 a = cellSize / (1+√2)，中心步进 cellSize/2
// 八边形有 8 个邻居（4个正方形 + 4个八边形）
// 小正方形有 4 个邻居（均为八边形）

function octSqCenter(row, col) {
    const d = cellSize;
    return [col * d / 2 + d / 2, row * d / 2 + d / 2];
}

function octVertices(cx, cy) {
    const a = cellSize / (1 + Math.SQRT2);
    const t = a * Math.SQRT2 / 2;
    const s = a / 2;
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

function sqSmallVertices(cx, cy) {
    const a = cellSize / (1 + Math.SQRT2);
    const t = a * Math.SQRT2 / 2;
    return [
        [cx - t, cy - t],
        [cx + t, cy - t],
        [cx + t, cy + t],
        [cx - t, cy + t],
    ];
}

function octSqVertices(row, col) {
    const [cx, cy] = octSqCenter(row, col);
    return (row + col) % 2 === 0 ? octVertices(cx, cy) : sqSmallVertices(cx, cy);
}

function octSqNeighbors(row, col) {
    const nb = [];
    const dirs = (row + col) % 2 === 0
        ? [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]  // 八边形：8邻
        : [[-1,0],[1,0],[0,-1],[0,1]];                               // 正方形：4邻
    for (const [dr, dc] of dirs) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) nb.push([nr, nc]);
    }
    return nb;
}

function octSqBoardSize() {
    const d = cellSize;
    return {
        width:  Math.ceil(cols * d / 2 + d / 2) + 4,
        height: Math.ceil(rows * d / 2 + d / 2) + 4,
    };
}

// ─── 统一接口 ─────────────────────────────────────────────────

function getCellVertices(sides, row, col) {
    if (sides === 3) return triVertices(row, col);
    if (sides === 4) return sqVertices(row, col);
    if (sides === 6) return hexVertices(row, col);
    if (sides === 8) return octSqVertices(row, col);
}

function getCellCenter(sides, row, col) {
    const verts = getCellVertices(sides, row, col);
    const x = verts.reduce((s, v) => s + v[0], 0) / verts.length;
    const y = verts.reduce((s, v) => s + v[1], 0) / verts.length;
    return [x, y];
}

function getNeighbors(sides, row, col) {
    let nb;
    if (sides === 3) nb = triNeighbors(row, col);
    else if (sides === 4) nb = sqNeighbors(row, col);
    else if (sides === 6) nb = hexNeighbors(row, col);
    else if (sides === 8) nb = octSqNeighbors(row, col);
    else nb = [];
    return nb.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols);
}

function getBoardSize(sides) {
    if (sides === 3) return triBoardSize();
    if (sides === 4) return sqBoardSize();
    if (sides === 6) return hexBoardSize();
    if (sides === 8) return octSqBoardSize();
    return { width: 400, height: 400 };
}
