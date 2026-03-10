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
// Trihexagonal tiling (3.6.3.6 / kagome)
//
// 关键性质：
//   - 六边形之间不直接共享边，相邻六边形之间总是隔着一个三角形
//   - 每个六边形有 6 个三角形邻居，每个三角形有 3 个六边形邻居
//   - 在每个顶点处：三角形-六边形-三角形-六边形（(3.6)^2）
//
// 几何（边长 a = cellSize/2，pointy-top 六边形）：
//   六边形中心间距（通过三角形相连）：
//     两六边形中心距 = √3·a + a·√3 = √3·a·... 通过轴坐标推导：
//     六边形轴坐标 (q, r)，中心：cx = q·√3a，cy = (2r + q)·a
//     六边形宽 = √3·a（水平，col 步进）
//     列步进 cx_step = √3·a，行步进 cy_step = 2a（不考虑斜向偏移）
//
//   六边形轴坐标 (r, q) 中心（加 padding 偏移）：
//     cx = q · √3·a + pad
//     cy = (2r + q) · a + pad
//
// 扩展坐标系：
//   六边形 (r, q) → (gr, gc) = (r, q)，坐标直接是轴坐标
//   三角形（尖朝右 ▶，位于六边形 (r,q) 右方）：
//     gr = r,  gc = cols + r · (cols+1) + q  （用不同范围避免与六边形冲突）
//
// 更简洁方案：使用 type + index 组合 key，在 game.js 中以 `${gr},${gc}` 存储，
// 六边形 (r,q) → gr = r, gc = q（负范围 q 不存在，q∈[0,cols)，r∈[0,rows)）
// 三角形用 gr = rows + ..., gc = ... 偏移到不重叠范围
//
// 最终选择的方案（参考 Cairo/octSq 的扩展网格思路）：
//   将六边形和三角形映射到二维网格，使用不同的 (gr, gc) 范围
//
// 六边形 (r, q)：r∈[0,rows), q∈[0,cols)
//   → gr = r, gc = q
// 三角形（6种方向，但由3个六边形共享，所以每个三角形只存一次）：
//   每个三角形由3个六边形的相邻关系唯一确定。
//   六边形(r,q)的6个三角形邻居方向（轴坐标中）：
//     方向0(右):  tri_A(r,q)   ← 由(r,q),(r,q+1),(r-1,q+1)围成
//     方向1(右下):tri_B(r,q)   ← 由(r,q),(r+1,q),(r,q+1)围成... 不对
//   在 3.6.3.6 中，六边形轴坐标下的三角形：
//     ▶型（尖朝右）：由(r,q),(r-1,q+1),(r,q+1) 三个六边形围成？不对，三角形只与3个六边形各共一条边
//
// ────────────────────────────────────────────────────────────────
// 采用最直接的实现：
// 六边形轴坐标 (r, q)，中心 cx = q·W + pad，cy = (2r+q)·a + pad（W=√3a, a=cellSize/2）
// 六边形有6个三角形邻居，用偏移 (dr,dq,type) 唯一标识每个三角形
//
// 三角形有两种：
//   ▲（尖朝上）：顶点分别是 3个六边形的顶点
//   ▼（尖朝下）：顶点分别是 3个六边形的顶点
//
// 在轴坐标中，每个三角形由一个"锚"六边形和方向标记：
//   类型A（▲）：右上方三角形，锚=(r,q)，连接(r,q)+(r-1,q)+(r-1,q+1)
//   类型B（▼）：右下方三角形，锚=(r,q)，连接(r,q)+(r,q+1)+(r-1,q+1)... 需验证
//
// ────────────────────────────────────────────────────────────────
// 实用方案：直接从具体坐标推导，用脚本验证顶点重合
//
// 设 a = cellSize/2（六边形外接圆半径 = 边长），pad = a
// pointy-top 六边形顶点（中心(cx,cy)，从正上顶点开始逆时针）：
//   i=0: (cx,       cy-a)      — 正上
//   i=1: (cx+W/2,   cy-a/2)    — 右上  (W = √3a)
//   i=2: (cx+W/2,   cy+a/2)    — 右下
//   i=3: (cx,       cy+a)      — 正下
//   i=4: (cx-W/2,   cy+a/2)    — 左下
//   i=5: (cx-W/2,   cy-a/2)    — 左上
//
// 六边形(0,0) 中心(pad, pad)=(a, a)，顶点：
//   0:(a, 0), 1:(a+W/2, a/2), 2:(a+W/2, 3a/2), 3:(a, 2a), 4:(a-W/2, 3a/2), 5:(a-W/2, a/2)
//
// 六边形(0,1) 中心: q=1时 cx=W+a, cy=(0+1)a+a=2a → (W+a, 2a)，顶点：
//   0:(W+a, a), 1:(W+a+W/2, 3a/2), 2:(W+a+W/2, 5a/2), 3:(W+a, 3a), 4:(W+a-W/2, 5a/2), 5:(W+a-W/2, 3a/2)
//   = (W+a, a), (3W/2+a, 3a/2), (3W/2+a, 5a/2), (W+a, 3a), (W/2+a, 5a/2), (W/2+a, 3a/2)
//
// 六边形(1,0) 中心: r=1, q=0 → cx=a, cy=(2+0)a+a=3a → (a, 3a)，顶点：
//   0:(a, 2a), 1:(W/2+a, 5a/2), 2:(W/2+a, 7a/2), 3:(a, 4a), 4:(a-W/2, 7a/2), 5:(a-W/2, 5a/2)
//
// 六边形(-1,1) 中心: r=-1, q=1 → cx=W+a, cy=(-2+1)a+a=0 → (W+a, 0)，顶点：
//   0:(W+a, -a)... 负坐标，在有效范围外
//
// 六边形(0,0) 的右上顶点1 = (a+W/2, a/2)
// 六边形(0,1) 的左上顶点5 = (W/2+a, 3a/2)... 不重合 (a+W/2, a/2) vs (W/2+a, 3a/2)
// 说明这两个六边形之间有三角形！
//
// 三角形顶点 = {(0,0)的顶点1, (0,1)的顶点5, 某个交汇点}
// 等等，(0,0)的顶点1 = (a+W/2, a/2) 和 (0,1)的顶点5 = (W/2+a, 3a/2) 是同一个 x 坐标，但 y 不同
// 这两个点之间的距离 = a（正好一条边的长度），这就是它们共享的三角形的一条边！
//
// 三角形的第三顶点：
//   边 (a+W/2, a/2)→(a+W/2, 3a/2) 是竖直的，长度 = a ✓（等边三角形边长）
//   等边三角形第三顶点在右侧（朝右）：
//   第三顶点 = ((a+W/2) + W/2, (a/2+3a/2)/2) = (a+W, a)
//
// 验证第三顶点 (a+W, a)：
//   到第一顶点距离 = √((W/2)²+(a/2)²) = √(3a²/4+a²/4) = a ✓
//   到第二顶点距离 = √((W/2)²+(a/2)²) = a ✓
//
// 第三顶点 (a+W, a) = (a+√3a, a)。这是哪个六边形的顶点？
// 六边形(0,1) 中心 (W+a, 2a)，顶点0 = (W+a, a) ✓！
//
// 所以三角形 T1（在 (0,0) 和 (0,1) 之间）的顶点是：
//   (0,0)的顶点1 = (a+W/2, a/2)
//   (0,1)的顶点5 = (a+W/2, 3a/2)
//   (0,1)的顶点0 = (a+W, a)
//
// 这个三角形由哪3个六边形共享？
//   边(a+W/2,a/2)→(a+W,a)：这是(0,1)的边5→0（左上边），由(0,1)贡献
//   边(a+W,a)→(a+W/2,3a/2)：这是(0,1)的边0→...不对，应该是另一个六边形
//   边(a+W/2,a/2)→(a+W/2,3a/2)：这是(0,0)的边1→2（右边），由(0,0)贡献
//
// 第三条边(a+W,a)→(a+W/2,3a/2) 属于谁？检查各六边形的顶点：
//   r=-1,q=1: 中心(W+a,-2a+a+a)=(W+a,0)... cy=(-2+1)a+a=0 → 中心(W+a, 0)
//   顶点1=(W+a+W/2, -a/2+0)=(3W/2+a, -a/2)，顶点2=(3W/2+a, a/2),...顶点0=(W+a,-a)
//   顶点5=(W/2+a, -a/2)，顶点4=(W/2+a, a/2) → (a+W/2, a/2)！= T1的第一顶点
//
//   r=-1,q=1 的顶点4 = (W/2+a, a/2) = (a+W/2, a/2) ✓（T1的第一顶点）
//   r=-1,q=1 的顶点3 = (W+a, a) ✓（T1的第三顶点）
//   r=-1,q=1 的边3→4(正下→左下): (W+a, a)→(W/2+a, a/2) → 这就是 T1 的第三条边！
//
// 结论：T1 的三个共享六边形是 (0,0)，(0,1)，(-1,1)
//   - (0,0) 贡献边1→2 = (a+W/2,a/2)→(a+W/2,3a/2)（右边）
//   - (0,1) 贡献边5→0 = (a+W/2,3a/2)→(a+W,a)（左上边）  ← 注意这里顺序
//   - (-1,1) 贡献边3→4 = (a+W,a)→(a+W/2,a/2)（正下→左下）
//
// 六边形轴坐标中，T1 位于 (r=0,q=0)、(r=0,q=1)、(r=-1,q=1) 之间
// 这种三角形（▶ 尖朝右）：由(r,q),(r,q+1),(r-1,q+1) 围成
//
// 对称地，另一种三角形（▶ 尖朝左）：由(r,q),(r+1,q),(r+1,q-1) 围成
// 但这等价于：由(r',q'),(r'-1,q'),(r',q'-1) 围成（令r'=r+1，q'=q）
//
// 每种三角形的锚点取最小的(r,q)：
//   类型A（▶）：锚=(r,q)，连接(r,q),(r,q+1),(r-1,q+1)
//               → 编码为 gr = rows + r, gc = q（偏移 rows 避免与六边形重叠）
//   类型B（◀）：锚=(r,q)，连接(r,q),(r+1,q),(r+1,q-1)
//               → 编码为 gr = 2*rows + r, gc = q（再偏移 rows）
//
// 扩展坐标：
//   gr∈[0, rows)       + gc∈[0, cols)  → 六边形 (r=gr, q=gc)
//   gr∈[rows, 2*rows)  + gc∈[0, cols)  → A型三角形 (r=gr-rows, q=gc)
//   gr∈[2*rows, 3*rows)+ gc∈[0, cols)  → B型三角形 (r=gr-2*rows, q=gc)

let _triHexCache = null;

function _triHexCacheSignature() {
    return `${rows}|${cols}|${cellSize}`;
}

function _triHexPointKey(x, y) {
    return `${x.toFixed(6)},${y.toFixed(6)}`;
}

function _triHexMidpoint(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function _triHexCentroid(points) {
    const sx = points.reduce((sum, p) => sum + p[0], 0);
    const sy = points.reduce((sum, p) => sum + p[1], 0);
    return [sx / points.length, sy / points.length];
}

function _triHexSortPolygon(points) {
    const [cx, cy] = _triHexCentroid(points);
    return [...points].sort((a, b) => {
        const aa = Math.atan2(a[1] - cy, a[0] - cx);
        const bb = Math.atan2(b[1] - cy, b[0] - cx);
        return aa - bb;
    });
}

// 用标准 pointy-top offset 蜂窝作为“母网格”，再做 rectification。
function _triHexBaseCenter(row, col) {
    const s = cellSize;
    const w = Math.sqrt(3) * s;
    return [
        col * w + (row % 2 === 1 ? w / 2 : 0),
        row * s * 1.5,
    ];
}

function _triHexBaseVertices(row, col) {
    const [cx, cy] = _triHexBaseCenter(row, col);
    const s = cellSize;
    const w = Math.sqrt(3) * s / 2;
    return [
        [cx,     cy - s    ],
        [cx + w, cy - s / 2],
        [cx + w, cy + s / 2],
        [cx,     cy + s    ],
        [cx - w, cy + s / 2],
        [cx - w, cy - s / 2],
    ];
}

function _ensureTriHexCache() {
    const signature = _triHexCacheSignature();
    if (_triHexCache && _triHexCache.signature === signature) return _triHexCache;

    const rawCells = [];
    const originalVertexMap = new Map();
    let triangleIndex = 0;

    const addRawCell = (coord, type, vertices) => {
        rawCells.push({
            coord,
            key: `${coord[0]},${coord[1]}`,
            type,
            vertices: _triHexSortPolygon(vertices),
        });
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const baseVerts = _triHexBaseVertices(r, c);
            const mids = [];

            for (let i = 0; i < 6; i++) {
                mids.push(_triHexMidpoint(baseVerts[i], baseVerts[(i + 1) % 6]));
            }
            addRawCell([r, c], 'hex', mids);

            for (let i = 0; i < 6; i++) {
                const prev = (i + 5) % 6;
                const vertex = baseVerts[i];
                const vertexKey = _triHexPointKey(vertex[0], vertex[1]);
                if (!originalVertexMap.has(vertexKey)) {
                    originalVertexMap.set(vertexKey, { midpoints: new Map() });
                }
                const entry = originalVertexMap.get(vertexKey);
                const m1 = _triHexMidpoint(baseVerts[prev], vertex);
                const m2 = _triHexMidpoint(vertex, baseVerts[(i + 1) % 6]);
                entry.midpoints.set(_triHexPointKey(m1[0], m1[1]), m1);
                entry.midpoints.set(_triHexPointKey(m2[0], m2[1]), m2);
            }
        }
    }

    for (const entry of originalVertexMap.values()) {
        const vertices = Array.from(entry.midpoints.values());
        if (vertices.length !== 3) continue;
        addRawCell([rows + triangleIndex, 0], 'tri', vertices);
        triangleIndex++;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const cell of rawCells) {
        for (const [x, y] of cell.vertices) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }

    const pad = cellSize;
    const dx = pad - minX;
    const dy = pad - minY;

    const cells = [];
    const cellMap = new Map();
    const vertexOwners = new Map();

    for (const rawCell of rawCells) {
        const shiftedVerts = rawCell.vertices.map(([x, y]) => [x + dx, y + dy]);
        const cell = {
            key: rawCell.key,
            coord: rawCell.coord,
            type: rawCell.type,
            vertices: shiftedVerts,
            neighborKeys: new Set(),
        };
        cells.push(cell);
        cellMap.set(cell.key, cell);

        for (const [vx, vy] of shiftedVerts) {
            const vertexKey = _triHexPointKey(vx, vy);
            if (!vertexOwners.has(vertexKey)) vertexOwners.set(vertexKey, []);
            vertexOwners.get(vertexKey).push(cell.key);
        }
    }

    for (const owners of vertexOwners.values()) {
        const uniqueOwners = [...new Set(owners)];
        for (let i = 0; i < uniqueOwners.length; i++) {
            for (let j = 0; j < uniqueOwners.length; j++) {
                if (i === j) continue;
                cellMap.get(uniqueOwners[i]).neighborKeys.add(uniqueOwners[j]);
            }
        }
    }

    _triHexCache = {
        signature,
        allCells: cells.map(cell => cell.coord),
        cellMap,
        boardSize: {
            width: Math.ceil(maxX - minX + pad * 2) + 4,
            height: Math.ceil(maxY - minY + pad * 2) + 4,
        },
    };
    return _triHexCache;
}

function triHexCellType(gr, gc) {
    const cell = _ensureTriHexCache().cellMap.get(`${gr},${gc}`);
    return cell ? cell.type : null;
}

function triHexVertices(gr, gc) {
    const cell = _ensureTriHexCache().cellMap.get(`${gr},${gc}`);
    return cell ? cell.vertices : [];
}

function triHexAllCells() {
    return _ensureTriHexCache().allCells;
}

function triHexNeighbors(gr, gc) {
    const cell = _ensureTriHexCache().cellMap.get(`${gr},${gc}`);
    if (!cell) return [];
    return [...cell.neighborKeys].map(key => key.split(',').map(Number));
}

function triHexBoardSize() {
    return _ensureTriHexCache().boardSize;
}

// ─── Cairo 五边形镶嵌（5边）────────────────────────────────────
// 等边 Cairo pentagonal tiling（Equilateral Cairo tiling）
// 参考：https://en.wikipedia.org/wiki/Cairo_pentagonal_tiling
//       https://en.wikipedia.org/wiki/File:Equilateral_Cairo_tiling.svg
//
// 几何结构：
// - 5条等长边，角度序列：131.4°, 90°, 114.3°, 114.3°, 90°
// - 4个五边形共享一个"度数4顶点"（4个90°汇合处），构成一组
// - 相邻组之间通过剩余3条边连接
//
// 坐标系：每4个五边形为一"组"，由 (R, C) 索引（行列）
// 每组内4种类型：t=0,1,2,3（依次旋转90°）
// 游戏用扩展坐标 gr = 2*R + (t>=2?1:0), gc = 2*C + (t==1||t==2?1:0)
//
// 精确数学：
//   γ = π/4 + arcsin(1/(2√2)) ≈ 65.705°
//   φ = 约 69.565°（全局旋转，使格点网格接近轴对齐）
//   Tx = (2.5779, 0.0121) * a   （列步进向量）
//   Ty = (-0.0121, 2.5779) * a  （行步进向量）
//
// 顶点公式（以V1=度数4顶点为原点，phi=V1→V2方向角）：
//   V0 = V1 + a*(-sin φ,  cos φ)
//   V2 = V1 + a*( cos φ,  sin φ)
//   V3 = V2 + a*( cos(φ+γ), sin(φ+γ))
//   V4 = V3 + a*( cos(φ+2γ), sin(φ+2γ))
//
// 5条边的邻居（共享边）：
//   t=0: (R,C,1) [V1-V2], (R,C,3) [V0-V1], (R+1,C,2) [V2-V3], (R+1,C,3) [V3-V4], (R,C-1,1) [V4-V0]
//   t=1: (R,C,0) [V0-V1], (R,C,2) [V1-V2], (R,C+1,0) [V3-V4], (R,C+1,3) [V2-V3], (R+1,C,2) [V4-V0]
//   t=2: (R,C,1) [V0-V1], (R,C,3) [V1-V2], (R-1,C,0) [V2-V3], (R-1,C,1) [V3-V4], (R,C+1,3) [V4-V0]
//   t=3: (R,C,0) [V1-V2], (R,C,2) [V0-V1], (R-1,C,0) [V4-V0], (R,C-1,1) [V2-V3], (R,C-1,2) [V3-V4]

// 角度常数（精确值经数学推导，与维基百科 SVG 实测吻合）
// γ = π/4 + arcsin(1/(2√2)) ≈ 65.705°（相邻边的旋转角）
const _CAIRO_GAM = Math.PI / 4 + Math.asin(0.5 / Math.SQRT2);
// φ0 ≈ 69.565°：全局旋转角，使格点网格接近轴对齐（来自 SVG 实测）
const _CAIRO_PHI0_RAD = 69.565 * Math.PI / 180;

// 4种类型的 phi 值：
const _CAIRO_PHIS = [
    _CAIRO_PHI0_RAD,                    // t=0
    _CAIRO_PHI0_RAD - Math.PI / 2,      // t=1
    _CAIRO_PHI0_RAD - Math.PI,          // t=2
    _CAIRO_PHI0_RAD + Math.PI / 2,      // t=3
];

// 格点步进向量（normalized, a=1）：
// Tx = C2.V4 - C3.V4, Ty = C0.V4 - C3.V4
// 其中 Vk.V4 是类型k五边形（V1在原点时）的V4坐标
// 从精确公式推导（与SVG实测吻合）：
// V4(phi) = (cos(phi)+cos(phi+γ)+cos(phi+2γ), sin(phi)+sin(phi+γ)+sin(phi+2γ))
function _cairoV4dir(phi) {
    const g = _CAIRO_GAM;
    return [
        Math.cos(phi) + Math.cos(phi + g) + Math.cos(phi + 2 * g),
        Math.sin(phi) + Math.sin(phi + g) + Math.sin(phi + 2 * g),
    ];
}
const _v4_0 = _cairoV4dir(_CAIRO_PHIS[0]);
const _v4_1 = _cairoV4dir(_CAIRO_PHIS[1]);
const _v4_2 = _cairoV4dir(_CAIRO_PHIS[2]);
const _v4_3 = _cairoV4dir(_CAIRO_PHIS[3]);
// Tx = V4_2 - V4_3 (col step: go right)
const _CAIRO_TX = [_v4_2[0] - _v4_3[0], _v4_2[1] - _v4_3[1]]; // ≈ (2.578, 0.012)
// Ty = V4_0 - V4_3 (row step: go down)
const _CAIRO_TY = [_v4_0[0] - _v4_3[0], _v4_0[1] - _v4_3[1]]; // ≈ (-0.012, 2.578)

// 扩展坐标 (gr, gc) → 组坐标 (R, C) 和类型 t
// gr=2R+(t>=2?1:0), gc=2C+(t==1||t==2?1:0)
// 反过来：
function _cairoGrGc2RCt(gr, gc) {
    const R = Math.floor(gr / 2);
    const C = Math.floor(gc / 2);
    const tr = gr % 2; // 0=上半, 1=下半
    const tc = gc % 2; // 0=左半, 1=右半
    // t: 0=上左, 1=上右, 2=下右, 3=下左
    let t;
    if (tr === 0 && tc === 0) t = 0;
    else if (tr === 0 && tc === 1) t = 1;
    else if (tr === 1 && tc === 1) t = 2;
    else t = 3; // tr===1 && tc===0
    return [R, C, t];
}

// degree-4 顶点的屏幕坐标（组(R,C)的V1位置）
// 原点在 (padding, padding)
function _cairoDeg4Pos(R, C, a, ox, oy) {
    return [
        ox + C * _CAIRO_TX[0] * a + R * _CAIRO_TY[0] * a,
        oy + C * _CAIRO_TX[1] * a + R * _CAIRO_TY[1] * a,
    ];
}

// 五边形顶点：V1 在 (cx, cy)，方向角 phi，边长 a
function _cairoPentagonVerts(phi, cx, cy, a) {
    const g = _CAIRO_GAM;
    const V0x = cx - a * Math.sin(phi);
    const V0y = cy + a * Math.cos(phi);
    const V2x = cx + a * Math.cos(phi);
    const V2y = cy + a * Math.sin(phi);
    const V3x = V2x + a * Math.cos(phi + g);
    const V3y = V2y + a * Math.sin(phi + g);
    const V4x = V3x + a * Math.cos(phi + 2 * g);
    const V4y = V3y + a * Math.sin(phi + 2 * g);
    return [[V0x, V0y], [cx, cy], [V2x, V2y], [V3x, V3y], [V4x, V4y]];
}

function cairoVertices(gr, gc) {
    const [R, C, t] = _cairoGrGc2RCt(gr, gc);
    const a = cellSize;
    // 原点偏移：让左上角留出 padding
    const pad = a * 1.5;
    const [cx, cy] = _cairoDeg4Pos(R, C, a, pad, pad);
    return _cairoPentagonVerts(_CAIRO_PHIS[t], cx, cy, a);
}

function cairoAllCells() {
    const cells = [];
    // 用扩展坐标 (gr, gc)：gr∈[0,2*rows), gc∈[0,2*cols)
    const grMax = 2 * rows;
    const gcMax = 2 * cols;
    for (let gr = 0; gr < grMax; gr++) {
        for (let gc = 0; gc < gcMax; gc++) {
            cells.push([gr, gc]);
        }
    }
    return cells;
}

function cairoNeighbors(gr, gc) {
    const [R, C, t] = _cairoGrGc2RCt(gr, gc);
    const grMax = 2 * rows;
    const gcMax = 2 * cols;

    // 各类型的7个邻居 (dR, dC, t2)：5个共边邻居 + 2个共顶点（不共边）邻居，经数学验证
    const NEIGHBORS = [
        // t=0: 5共边 + 同组对角(0,0,2) + 跨组对角(1,-1,2)
        [[0,0,1],[0,0,3],[1,0,2],[1,0,3],[0,-1,1],[0,0,2],[1,-1,2]],
        // t=1: 5共边 + 同组对角(0,0,3) + 跨组对角(1,1,3)
        [[0,0,0],[0,0,2],[0,1,0],[0,1,3],[1,0,2],[0,0,3],[1,1,3]],
        // t=2: 5共边 + 同组对角(0,0,0) + 跨组对角(-1,1,0)
        [[0,0,1],[0,0,3],[-1,0,0],[-1,0,1],[0,1,3],[0,0,0],[-1,1,0]],
        // t=3: 5共边 + 同组对角(0,0,1) + 跨组对角(-1,-1,1)
        [[0,0,0],[0,0,2],[-1,0,0],[0,-1,1],[0,-1,2],[0,0,1],[-1,-1,1]],
    ];

    const nb = [];
    for (const [dR, dC, t2] of NEIGHBORS[t]) {
        const R2 = R + dR, C2 = C + dC;
        // 扩展坐标
        const gr2 = 2 * R2 + (t2 >= 2 ? 1 : 0);
        const gc2 = 2 * C2 + (t2 === 1 || t2 === 2 ? 1 : 0);
        if (gr2 >= 0 && gr2 < grMax && gc2 >= 0 && gc2 < gcMax) {
            nb.push([gr2, gc2]);
        }
    }
    return nb;
}

function cairoBoardSize() {
    const a = cellSize;
    const pad = a * 1.5;
    // 最右下角的组 (rows-1, cols-1)，找所有顶点的极值
    let maxX = 0, maxY = 0;
    for (let gr = 0; gr < 2 * rows; gr++) {
        for (let gc = 0; gc < 2 * cols; gc++) {
            const verts = cairoVertices(gr, gc);
            for (const [vx, vy] of verts) {
                if (vx > maxX) maxX = vx;
                if (vy > maxY) maxY = vy;
            }
        }
    }
    return {
        width: Math.ceil(maxX + pad) + 4,
        height: Math.ceil(maxY + pad) + 4,
    };
}

// ─── 统一接口 ─────────────────────────────────────────────────

function getCellVertices(sides, row, col) {
    if (sides === 3) return triVertices(row, col);
    if (sides === 4) return sqVertices(row, col);
    if (sides === 5) return cairoVertices(row, col);   // row,col 是扩展网格坐标 gr,gc
    if (sides === 6) return hexVertices(row, col);
    if (sides === 8) return octSqVertices(row, col);   // row,col 是扩展网格坐标 gr,gc
    if (sides === 36) return triHexVertices(row, col); // row,col 是扩展网格坐标 gr,gc
}

function getCellCenter(sides, row, col) {
    const verts = getCellVertices(sides, row, col);
    const x = verts.reduce((s, v) => s + v[0], 0) / verts.length;
    const y = verts.reduce((s, v) => s + v[1], 0) / verts.length;
    return [x, y];
}

// 返回所有有效格子坐标列表（sides===5/8/36 时用扩展网格）
function getAllCells(sides) {
    if (sides === 5) return cairoAllCells();
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
    else if (sides === 5) nb = cairoNeighbors(row, col);   // 边界检查在内部
    else if (sides === 6) nb = hexNeighbors(row, col);
    else if (sides === 8) nb = octSqNeighbors(row, col);   // 边界检查在内部
    else if (sides === 36) nb = triHexNeighbors(row, col); // 边界检查在内部
    else nb = [];
    // sides===5/8/36 的边界检查已在各自函数内完成
    if (sides !== 5 && sides !== 8 && sides !== 36) {
        const actualCols = getActualCols(sides);
        nb = nb.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < actualCols);
    }
    return nb;
}

function getBoardSize(sides) {
    if (sides === 3) return triBoardSize();
    if (sides === 4) return sqBoardSize();
    if (sides === 5) return cairoBoardSize();
    if (sides === 6) return hexBoardSize();
    if (sides === 8) return octSqBoardSize();
    if (sides === 36) return triHexBoardSize();
    return { width: 400, height: 400 };
}
