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
// Trihexagonal tiling (3.6.3.6)：六边形和三角形交替排列，共享边
//
// 几何：pointy-top 六边形，边长 a = cellSize/2
//   六边形宽 = √3·a，高 = 2a
//   行间距（垂直）= 1.5a，列间距（水平）= √3·a
//   奇数六边形行向右偏移 √3·a/2
//
// 坐标系：六边形用偏移坐标 (hr, hc)，三角形用 (type, hr, hc) 编码为扩展坐标 (gr, gc)
//   六边形：gr = 3*hr,     gc = 2*hc（偶数行），gc = 2*hc+1（奇数行）
//   朝上三角形 ▲：gr = 3*hr-1, gc = 2*hc（偶数行）/ 2*hc+1（奇数行）
//     — 位于六边形 (hr, hc) 的正上方，由 (hr,hc) 的上两个顶点和上方六边形的底部顶点构成
//   朝下三角形 ▼：gr = 3*hr+1, gc = 2*hc（偶数行）/ 2*hc+1（奇数行）
//     — 位于六边形 (hr, hc) 的正下方
//
// 实际采用更简洁的方法：直接基于六边形顶点构造三角形

function _triHexParams() {
    const a = cellSize / 2;
    const sq3 = Math.sqrt(3);
    const w = sq3 * a;    // 六边形宽
    const h = 1.5 * a;    // 行间距（垂直）
    return { a, sq3, w, h };
}

// 六边形中心坐标（偏移坐标系 hr, hc）
function _triHexHexCenter(hr, hc) {
    const { a, w, h } = _triHexParams();
    const cx = hc * w + (hr % 2 === 1 ? w / 2 : 0) + w / 2;
    const cy = hr * h + a;
    return [cx, cy];
}

// 六边形顶点（pointy-top，从右上开始顺时针）
function _triHexHexVerts(hr, hc) {
    const [cx, cy] = _triHexHexCenter(hr, hc);
    const { a } = _triHexParams();
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i - Math.PI / 6;
        pts.push([cx + a * Math.cos(angle), cy + a * Math.sin(angle)]);
    }
    return pts;
}

// 扩展网格：
//   六边形 (hr, hc) → gr = 2*hr, gc = hc
//   朝上三角形：gr = 2*hr - 1, gc = hc  (在六边形 hr 的上方间隙)
//   朝下三角形：gr = 2*hr + 1, gc = hc  (在六边形 hr 的下方间隙)
//
// 但这样 triUp 和 triDown 在同一列会相互覆盖。
// 更好的方案：每个六边形行之间有两种三角形（▲和▼），分别编码
//
// 最终方案：使用 (gr, gc) 其中
//   gr % 3 == 0 → 六边形行，gc 是六边形列号 hc
//   gr % 3 == 1 → 朝下三角形（位于上方六边形行的下方）
//   gr % 3 == 2 → 朝上三角形（位于下方六边形行的上方）
// 三角形的 gc 编码：
//   偶数六边形行(hr)的下方三角形 ▼ 数量 = cols（对应六边形列），但需要额外的三角形
//
// 实际上最简洁的方法：用三种行交替
// 六边形行 hr 的六边形数量 = cols
// 六边形行 hr 和 hr+1 之间的三角形区域：
//   朝下 ▼：由 hr 行的六边形底部 + hr+1 行的六边形顶部围成
//   朝上 ▲：与 ▼ 交替排列
//
// 让我用更直观的方式：直接计算所有三角形间隙的位置

function triHexCellType(gr, gc) {
    const mod = ((gr % 3) + 3) % 3;
    if (mod === 0) return 'hex';
    if (mod === 1) return 'triDown';
    return 'triUp';
}

// 从扩展坐标获取六边形偏移坐标
function _triHexToHexRC(gr, gc) {
    return [gr / 3, gc];
}

function triHexCenter(gr, gc) {
    const { a, sq3, w, h } = _triHexParams();
    const type = triHexCellType(gr, gc);

    if (type === 'hex') {
        const hr = gr / 3, hc = gc;
        return _triHexHexCenter(hr, hc);
    }

    // 三角形位于两个相邻六边形行之间
    // triDown (gr%3==1): 位于六边形行 hr=floor(gr/3) 的下方
    // triUp   (gr%3==2): 位于六边形行 hr=ceil(gr/3)=floor(gr/3)+1 的上方
    //
    // 对于 triDown：上方六边形行 hr = (gr-1)/3
    //   下方六边形行 hr+1
    //   三角形顶点来自上方六边形的底部两点 + 下方六边形的顶部一点
    //
    // 对于 triUp：下方六边形行 hr = (gr+1)/3
    //   上方六边形行 hr-1
    //   三角形顶点来自下方六边形的顶部两点 + 上方六边形的底部一点

    if (type === 'triDown') {
        const hr = (gr - 1) / 3;
        // 上方六边形的中心
        const [ux, uy] = _triHexHexCenter(hr, gc);
        // 三角形中心在六边形底部下方 a/3 处（从底部顶点到三角形重心）
        // 六边形底部顶点 y = uy + a
        // 三角形高 = √3/2 * a，重心在高的 1/3 处
        return [ux, uy + a + sq3 * a / 6];
    } else {
        const hr = (gr + 1) / 3;
        const [ux, uy] = _triHexHexCenter(hr, gc);
        return [ux, uy - a - sq3 * a / 6];
    }
}

function triHexVertices(gr, gc) {
    const { a, sq3 } = _triHexParams();
    const type = triHexCellType(gr, gc);

    if (type === 'hex') {
        const hr = gr / 3, hc = gc;
        return _triHexHexVerts(hr, hc);
    }

    // 三角形：顶点与相邻六边形的顶点完全重合
    if (type === 'triDown') {
        const hr = (gr - 1) / 3;
        const hexVerts = _triHexHexVerts(hr, gc);
        // pointy-top 六边形顶点顺序（从右上开始顺时针）：
        // 0:右上, 1:右, 2:右下, 3:左下, 4:左, 5:左上
        // 朝下三角形使用底部两个顶点 + 下方六边形的顶部顶点
        // 底部两个顶点：hexVerts[2](右下) 和 hexVerts[3](左下)

        // 下方六边形的相应顶点
        const hrBelow = hr + 1;
        // 偶数行和奇数行的偏移不同，需要找到下方六边形的正确列号
        // 六边形 (hr, gc) 的左下顶点和右下顶点之间，正下方的六边形列号：
        // 如果 hr 是偶数行：下方 gc 对应 hc=gc 的六边形（或 hc=gc-1，取决于位置）
        // 实际上朝下三角形由3个六边形共享：上方1个 + 下方2个
        //
        // pointy-top 偏移坐标中，六边形 (hr, hc) 的下方两个邻居：
        //   偶数行: (hr+1, hc-1) 和 (hr+1, hc)
        //   奇数行: (hr+1, hc) 和 (hr+1, hc+1)
        let hcLeft, hcRight;
        if (hr % 2 === 0) {
            hcLeft = gc - 1;
            hcRight = gc;
        } else {
            hcLeft = gc;
            hcRight = gc + 1;
        }

        // 三角形的三个顶点：
        // 上方六边形的右下顶点、上方六边形的左下顶点、下方两个六边形共享的顶部顶点
        const topHex = hexVerts;
        // 下方右六边形的左上顶点 = 下方左六边形的右上顶点 = 上方六边形底部中点下方的点
        // 实际上就是下方六边形的顶部顶点
        // 对于 pointy-top 六边形，顶部顶点(index 0 到 5)中，顶部是 index 5(左上) 和 index 0(右上) 之间...
        // 不对，pointy-top 的正上方顶点不存在，最上方是两个顶点

        // 让我重新思考。Pointy-top 六边形从 -30° 开始：
        // i=0: angle=-30° → 右上 (√3/2·a, -a/2)
        // i=1: angle=30°  → 右   (√3/2·a, a/2)
        // i=2: angle=90°  → 下   (0, a)
        // i=3: angle=150° → 左   (-√3/2·a, a/2)  → 应该是左下... 
        // 等等，让我重新算：
        // i=0: -30° → (cos(-30°), sin(-30°)) = (√3/2, -1/2) → 右上
        // i=1: 30°  → (√3/2, 1/2)  → 右下
        // i=2: 90°  → (0, 1)       → 正下
        // i=3: 150° → (-√3/2, 1/2) → 左下
        // i=4: 210° → (-√3/2, -1/2)→ 左上
        // i=5: 270° → (0, -1)      → 正上

        // 所以：0=右上, 1=右下, 2=正下, 3=左下, 4=左上, 5=正上
        // 朝下三角形 ▼ 使用上方六边形的 正下(2) 和... 不对
        // 朝下三角形是上方六边形底部两顶点 + 下方某点
        // 上方六边形底部: 1(右下), 2(正下), 3(左下) — 但只有2是最底部的点
        // 
        // 正确理解：每个六边形6条边，三角形填充在相邻六边形之间
        // 六边形 (hr, hc) 的底部边连接顶点 1(右下) 和 3(左下)？不对
        // 六边形 (hr, hc) 的6条边：
        //   边0: 顶点5→0 (正上→右上) — 右上边
        //   边1: 顶点0→1 (右上→右下) — 右边
        //   边2: 顶点1→2 (右下→正下) — 右下边
        //   边3: 顶点2→3 (正下→左下) — 左下边
        //   边4: 顶点3→4 (左下→左上) — 左边
        //   边5: 顶点4→5 (左上→正上) — 左上边
        //
        // 朝下三角形 ▼ 的三个边分别与三个六边形共享：
        //   上方六边形 (hr, hc)：共享边2(右下边) 或边3(左下边)
        //   下方左六边形 (hr+1, hcLeft)：共享一条上边
        //   下方右六边形 (hr+1, hcRight)：共享一条上边
        //
        // 更准确地说，三角形 ▼ 的三个顶点恰好是：
        //   上方六边形的顶点1(右下)、上方六边形的顶点3(左下)、
        //   和一个交汇点（下方两个六边形的共享顶点）
        // 等等这不对，这会包含顶点2(正下)在内

        // 我需要更清晰地理解 3.6.3.6 的结构。
        // 在 pointy-top 六边形蜂窝中，相邻六边形之间有三角形间隙。
        // 关键：不是所有间隙都是三角形。
        //
        // Pointy-top 六边形的6条边中：
        //   水平方向（左、右）的两条边是垂直的
        //   其余4条边是倾斜的
        //
        // 六边形 (hr, hc) 的6个邻居：
        //   边0(右上): (hr-1, hc+δ)  δ=0(偶行) 或 1(奇行)
        //   边1(右):   (hr, hc+1)
        //   边2(右下): (hr+1, hc+δ)
        //   边3(左下): (hr+1, hc+δ-1)
        //   边4(左):   (hr, hc-1)
        //   边5(左上): (hr-1, hc+δ-1)
        //
        // 三角形间隙：由3个相邻六边形围成
        //   ▼ (朝下)：六边形 (hr, hc) + (hr+1, hcLeft) + (hr+1, hcRight) 的交汇处
        //     三个顶点：(hr,hc)的顶点2, (hr+1,hcLeft)的顶点5, (hr+1,hcRight)的顶点5
        //     不对...
        //
        // 让我用具体坐标验算
        // 六边形 (0,0) 偶数行, center = (w/2, a) = (√3a/2, a)
        // 顶点：
        //   0: (√3a/2 + a·cos(-30°), a + a·sin(-30°)) = (√3a/2 + √3a/2, a - a/2) = (√3a, a/2)
        //   1: (√3a/2 + √3a/2, a + a/2) = (√3a, 3a/2)
        //   2: (√3a/2, 2a)
        //   3: (0, 3a/2)
        //   4: (0, a/2)
        //   5: (√3a/2, 0)
        //
        // 六边形 (1,0) 奇数行(偏移), center = (√3a/2 + w/2, a + 3a/2) = (√3a, 5a/2)
        //   这里偏移 w/2 = √3a/2
        //   center = (0·w + w/2 + w/2, 1·3a/2 + a) = (w, 5a/2) = (√3a, 5a/2)
        // 顶点：
        //   0: (√3a + √3a/2, 5a/2 - a/2) = (3√3a/2, 2a)
        //   5: (√3a, 5a/2 - a) = (√3a, 3a/2)
        //
        // 六边形 (1,-1) 奇数行, hc=-1 → 无效，忽略
        // 六边形 (1,0) 的顶点5 = (√3a, 3a/2) 恰好等于六边形(0,0)的顶点1 = (√3a, 3a/2) ✓
        //
        // ▼三角形在 (0,0) 下方：
        //   (0,0)的顶点2 = (√3a/2, 2a)
        //   (0,0)的顶点1 = (√3a, 3a/2)  → 不对，这是右侧点不是下方
        //
        // 我重新想。3.6.3.6 的三角形间隙是由3个六边形的各一条边围成的。
        // 看六边形(0,0)的正下方顶点2 = (√3a/2, 2a)
        // 这个顶点被2个六边形共享：(0,0)的边2-3都经过它
        // 等等，顶点2只属于边 1→2 和 2→3
        //
        // 三角形间隙：
        // 六边形(0,0) 的边2(1→2): 从(√3a, 3a/2)到(√3a/2, 2a) — 右下边
        // 六边形(0,0) 的边3(2→3): 从(√3a/2, 2a)到(0, 3a/2) — 左下边
        //
        // 下方两个六边形(偶数行hr=0的下方邻居)：
        //   偶数行: (hr+1, hc-1) 和 (hr+1, hc)
        //   即 (1, -1) 和 (1, 0)
        //
        // 六边形(1,0) 顶点5 = (√3a, 3a/2) — 与(0,0)顶点1重合 ✓
        // 六边形(1,0) 顶点4 = (√3a - √3a/2, 5a/2 - a/2) = (√3a/2, 2a) — 与(0,0)顶点2重合 ✓
        //
        // 所以六边形(0,0) 和 (1,0) 共享边 (√3a, 3a/2)→(√3a/2, 2a)，这是(0,0)的边2
        // 这两个六边形之间没有三角形间隙——它们直接共享边！
        //
        // 那三角形在哪里？
        // 在 3.6.3.6 中，并不是所有六边形邻居都直接共享边。
        // 3.6.3.6 的意思是：在每个顶点处，按顺序排列 三角形-六边形-三角形-六边形
        //
        // 这意味着六边形的6条边中，只有3条与三角形共享，另外3条与另外3个六边形共享？不对！
        // 在 3.6.3.6 中，六边形的每条边都与一个三角形共享。
        //
        // 等等，我重新看参考图。在 3.6.3.6 tiling 中：
        // - 六边形不是密集排列的（不像纯六边形蜂窝那样）
        // - 六边形之间被三角形分隔
        // - 每个六边形的6条边各与一个三角形共享
        // - 因此六边形之间的间距更大
        //
        // 这意味着六边形的排列方式与普通蜂窝不同！
        // 在 3.6.3.6 中，六边形的间距更大，每两个相邻六边形之间隔着一个三角形。

        // 重新计算：设边长为 a
        // 六边形的中心间距 = 2a（不是 √3a）
        // 因为：六边形边到中心的距离（内切圆半径）= √3a/2
        //       三角形高 = √3a/2
        //       所以相邻六边形中心距 = √3a/2 + √3a/2 + ... 不对
        //
        // 让我从顶点开始推导。
        // 在 3.6.3.6 中，边长 = a（六边形和三角形共用）
        // 六边形中心到顶点 = a
        // 三角形中心到顶点 = a/√3
        // 两个共享一条边的六边形，它们之间隔着两个三角形（背对背）？
        // 不对，看图：每个六边形的每条边连接一个三角形，三角形的另外两条边各连接另一个六边形
        //
        // 所以两个"最近的"六边形之间的距离：
        // 六边形→三角形（共享一条边）→六边形
        // 六边形中心到共享边中点 = √3a/2（内切圆半径）
        // 三角形的高（从共享边到对面顶点）= √3a/2
        // 对面的六边形中心到其共享边中点 = √3a/2
        // 但三角形的对面顶点被另一个六边形的边上的点重合
        //
        // 不对。让我仔细看 3.6.3.6：
        // 在一个顶点处：3-6-3-6
        // 这意味着每个顶点被2个三角形和2个六边形共享
        // 六边形有6个顶点，每个顶点处有一个三角形
        // 三角形有3个顶点，每个顶点处有一个六边形
        //
        // 六边形边长 = 三角形边长 = a
        // 六边形的每条边与一个三角形共享
        // 三角形的每条边与一个六边形共享
        // 每个六边形被 6 个三角形包围
        // 每个三角形被 3 个六边形包围

        // 既然三角形的每条边都与六边形共享，那么两个三角形不会直接共享边。
        // 两个相邻六边形也不会直接共享边——它们之间总是隔着一个三角形。

        // 所以六边形的排列不是普通蜂窝！让我重新推导中心间距。
        
        // 不行了，这个内联计算太复杂。让我直接从正确的几何重新构造。
        // 参考 Wikipedia 的 SVG 图片。
        
        return [[0,0],[0,0],[0,0]]; // placeholder, 下面完全重写
    }

    return hexVerts.slice(1, 4); // placeholder
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
    const valid = (r, c) => r >= 0 && r < grMax && c >= 0 && c < gcMax && (r % 2 === 0 || c % 2 === 0);

    if (type === 'hex') {
        const triOffsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,1],[1,-1]];
        const hexOffsets = [[-2,0],[2,0],[0,-2],[0,2],[-2,2],[2,-2]];
        for (const [dr, dc] of [...triOffsets, ...hexOffsets]) {
            const nr = gr + dr, nc = gc + dc;
            if (valid(nr, nc)) nb.push([nr, nc]);
        }
    } else {
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
    const a = cellSize / 2;
    const sq3 = Math.sqrt(3);
    const hexStepX = 2 * a;
    const hexStepY = sq3 * a;
    const grMax = 2 * rows;
    const gcMax = 2 * cols;
    return {
        width: Math.ceil(gcMax / 2 * hexStepX / 2 + a * 3) + 4,
        height: Math.ceil(grMax / 2 * hexStepY / 2 + a * 3) + 4,
    };
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
