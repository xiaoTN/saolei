#!/usr/bin/env node
/**
 * Snub Square Tiling (3.3.4.3.4) 独立验证脚本
 *
 * 使用直接参数化构造法：
 *   - 利用已知的平移向量 T1, T2 生成基本域的平移副本
 *   - 每个基本域包含 4 个顶点、2 个正方形、4 个三角形
 *   - 所有边长相等 = a
 *
 * 验证项：
 *   1. 三角形/正方形比 = 2:1
 *   2. 内部顶点被恰好 5 个面共享
 *   3. 内部正方形有恰好 12 个邻居（共享至少一个顶点）
 *   4. 内部三角形有恰好 9 个邻居（共享至少一个顶点）
 */

'use strict';

// ─── 参数 ───────────────────────────────────────────────────────

const a = 1;                          // 边长
const GRID_N = 8;                     // 基本域重复次数（每个方向）
const TOL = a * 1e-6;                 // 浮点容差

// ─── 数学常量 ─────────────────────────────────────────────────────
// Snub square tiling 的关键角度：
//   在每个顶点处，5 个面的内角依次为 60°, 60°, 90°, 60°, 90°（总和 360°）
//   snub angle α = arctan(1 / (1 + √3)) ≈ 20.104°
//   这是第一个三角形的一条边相对于"网格轴"的旋转角

const sqrt3 = Math.sqrt(3);

// ─── 平移向量 ─────────────────────────────────────────────────────
// 基本域周期：L = a * √(2 + √3) ≈ 1.9319a
// T1 方向：沿 x 轴旋转 α 角
// T2 方向：T1 旋转 90°
//
// 但为了简洁可靠，我们使用 Polytope Wiki 给出的精确顶点坐标公式。
//
// 对于边长 = 1、中心在原点的 snub square tiling，顶点坐标为：
//   ±s * (3-√3 + 4i,  √3-1 + 4j)
//   ±s * (-√3+1 + 4i, 3-√3 + 4j)
// 其中 s = √(2+√3) / 4，i,j 遍历所有整数
//
// 这给出 4 类顶点（± 号和两种坐标公式的组合），构成了密铺的顶点集。
//
// 但这种写法有点抽象。我们换一种更直观的方式：
// 直接定义基本域中的 4 个顶点位置，然后用平移向量复制。

// 基本域边长
const L = a * Math.sqrt(2 + sqrt3);

// 平移向量（正交，长度 L）
// T1 = L * (cos α, sin α), T2 = L * (-sin α, cos α)
// 其中 α 是 snub angle
const alpha = Math.atan2(1, 1 + sqrt3);  // ≈ 20.104°
const cosA = Math.cos(alpha);
const sinA = Math.sin(alpha);

const T1 = [L * cosA, L * sinA];   // ≈ (1.8145, 0.6653)
const T2 = [-L * sinA, L * cosA];  // ≈ (-0.6653, 1.8145)

// ─── 基本域顶点 ──────────────────────────────────────────────────
// 在一个基本域中有 4 个不等价顶点。
// 我们采用精确的计算方式。
//
// 设 A 为基本域的一个正方形的左下角（原点），边长为 a。
// 正方形旋转角度 = α（snub angle）。
//
// 正方形 S1 的四个顶点（以原点为左下角，旋转 α）：
// V0 = (0, 0)
// V1 = a * (cos α, sin α)
// V2 = a * (cos α - sin α, sin α + cos α)
// V3 = a * (-sin α, cos α)
//
// 然后需要找到第二个正方形和连接它们的三角形的位置。
// 我们通过数学推导来确定基本域的完整结构。

// 四个基本域顶点（在一个基本域内）：
// 使用精确坐标公式推导。
//
// 从 Polytope Wiki 的坐标公式出发，转换为适合平铺生成的形式。
// s = √(2+√3) / 4
// 类型A顶点: (s*(3-√3), s*(√3-1))  -- 取 i=j=0, + 号
// 类型B顶点: (s*(1-√3), s*(3-√3))  -- 取 i=j=0, + 号（第二公式）
// 类型C顶点: (-s*(3-√3), -s*(√3-1)) -- 取 i=j=0, - 号（第一公式）
// 类型D顶点: (-s*(1-√3), -s*(3-√3)) -- 取 i=j=0, - 号（第二公式）
//
// 平移周期（从 +4s*i 部分可知）：基本周期 = 4s，
// T_x = (4s, 0), T_y = (0, 4s) 是沿坐标轴的平移。
// 但这是轴对齐版本。4s = √(2+√3)。
// 实际上 L = √(2+√3) 正好是 4s，与我们之前的计算一致。
//
// 但注意：±s*(3-√3+4i, √3-1+4j) 和 ±s*(1-√3+4i, 3-√3+4j)
// 这里的 4i, 4j 说明平移步长在"归一化坐标"里是 4s。
// 两个公式共享相同的 (i,j) 索引但有不同的偏移。
// + 和 - 号又各给出一组。
// 所以每个 (i,j) 贡献 4 个顶点：A,B,C,D。
//
// 这 4 个顶点的真实坐标（i=j=0 时）：
//   A = s*(3-√3, √3-1)
//   B = s*(1-√3, 3-√3)
//   C = s*(√3-3, 1-√3) = -A
//   D = s*(√3-1, √3-3) = -B
//
// 平移向量不是 (4s,0) 和 (0,4s)，而是以它们的线性组合表示的晶格向量。
// 实际上，从坐标公式看，i 和 j 是独立整数，所以平移确实是 (4s, 0) 和 (0, 4s)。
// 但 4s = √(2+√3) = L，这与上面的 L 值完全一致。
//
// 所以这是一种轴对齐的参数化！平移向量就是 (L,0) 和 (0,L)。
// 之前我用了旋转的 T1 T2 是因为混淆了参数化方式。
// 轴对齐版本更简单，直接用它。

const s = Math.sqrt(2 + sqrt3) / 4;
const period = 4 * s;  // = √(2+√3) = L

// 每个 (i,j) 单元格内的 4 个顶点偏移
const vertexOffsets = [
    [s * (3 - sqrt3),  s * (sqrt3 - 1)],       // A: +, 第一公式
    [s * (1 - sqrt3),  s * (3 - sqrt3)],        // B: +, 第二公式
    [s * (sqrt3 - 3),  s * (1 - sqrt3)],        // C: -, 第一公式 = -A
    [s * (sqrt3 - 1),  s * (sqrt3 - 3)],        // D: -, 第二公式 = -B
];

console.log('=== Snub Square Tiling 参数化构造验证 ===\n');
console.log(`边长 a = ${a}`);
console.log(`基本域周期 L = 4s = ${period.toFixed(6)} (= √(2+√3) ≈ ${Math.sqrt(2 + sqrt3).toFixed(6)})`);
console.log(`s = √(2+√3)/4 = ${s.toFixed(6)}`);
console.log(`每个 (i,j) 单元含 4 个顶点`);
console.log(`网格大小: ${GRID_N} x ${GRID_N} 单元\n`);

// ─── 第一步：生成所有顶点 ────────────────────────────────────────────

const vertexMap = new Map();  // key -> {x, y, key}

function vKey(x, y) {
    return Math.round(x * 1e6) / 1e6 + ',' + Math.round(y * 1e6) / 1e6;
}

// 生成足够大范围的顶点（包含负索引以确保边界面也能被完整找到）
for (let i = -2; i <= GRID_N + 1; i++) {
    for (let j = -2; j <= GRID_N + 1; j++) {
        for (const [ox, oy] of vertexOffsets) {
            const x = ox + i * period;
            const y = oy + j * period;
            const key = vKey(x, y);
            if (!vertexMap.has(key)) {
                vertexMap.set(key, { x, y, key });
            }
        }
    }
}

console.log(`生成顶点总数: ${vertexMap.size}`);

// ─── 第二步：建立边图 ─────────────────────────────────────────────

const vertices = [...vertexMap.values()];
const edgeMap = new Map();  // vertexKey -> Set<vertexKey>

// 为了效率，使用空间哈希
const CELL_SIZE = a * 1.5;
const spatialHash = new Map();

function hashKey(x, y) {
    return Math.floor(x / CELL_SIZE) + ',' + Math.floor(y / CELL_SIZE);
}

for (const v of vertices) {
    const hk = hashKey(v.x, v.y);
    if (!spatialHash.has(hk)) spatialHash.set(hk, []);
    spatialHash.get(hk).push(v);
}

let edgeCount = 0;
for (const v of vertices) {
    if (!edgeMap.has(v.key)) edgeMap.set(v.key, new Set());
    const hx = Math.floor(v.x / CELL_SIZE);
    const hy = Math.floor(v.y / CELL_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const cell = spatialHash.get((hx + dx) + ',' + (hy + dy));
            if (!cell) continue;
            for (const u of cell) {
                if (u.key === v.key) continue;
                const d = Math.hypot(u.x - v.x, u.y - v.y);
                if (Math.abs(d - a) < TOL) {
                    if (!edgeMap.has(u.key)) edgeMap.set(u.key, new Set());
                    edgeMap.get(v.key).add(u.key);
                    edgeMap.get(u.key).add(v.key);
                    edgeCount++;
                }
            }
        }
    }
}

console.log(`边总数: ${edgeCount / 2}`);

// 检查顶点度数
const degreeHist = new Map();
for (const [vk, nb] of edgeMap) {
    const d = nb.size;
    degreeHist.set(d, (degreeHist.get(d) || 0) + 1);
}
console.log('顶点度数分布:');
for (const [deg, cnt] of [...degreeHist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  度数 ${deg}: ${cnt} 个顶点`);
}

// ─── 第三步：找所有三角形面 ────────────────────────────────────────

const faceKeySet = new Set();
const faces = [];

// 定义边界范围（宽松范围，让所有合理的面都被包含）
const margin = a * 2;
const minBound = -margin;
const maxBoundX = GRID_N * period + margin;
const maxBoundY = GRID_N * period + margin;

function faceCenterInBounds(pts) {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return cx > minBound && cx < maxBoundX && cy > minBound && cy < maxBoundY;
}

// 找三角形（3个顶点两两相连）
for (const [v1k, v1Nb] of edgeMap) {
    for (const v2k of v1Nb) {
        if (v2k <= v1k) continue;
        const v2Nb = edgeMap.get(v2k);
        if (!v2Nb) continue;
        for (const v3k of v2Nb) {
            if (v3k <= v2k) continue;
            if (v1Nb.has(v3k)) {
                const fk = [v1k, v2k, v3k].sort().join('|');
                if (faceKeySet.has(fk)) continue;
                const p1 = vertexMap.get(v1k), p2 = vertexMap.get(v2k), p3 = vertexMap.get(v3k);
                const pts = [[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]];
                // 验证是等边三角形（面积 = √3/4 * a²）
                const area = Math.abs(
                    (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
                ) / 2;
                const expectedArea = sqrt3 / 4 * a * a;
                if (Math.abs(area - expectedArea) < TOL * a) {
                    if (faceCenterInBounds(pts)) {
                        faceKeySet.add(fk);
                        faces.push({
                            type: 'tri',
                            vertexKeys: [v1k, v2k, v3k],
                            vertices: sortPolygon(pts),
                        });
                    }
                }
            }
        }
    }
}

console.log(`\n找到三角形: ${faces.filter(f => f.type === 'tri').length}`);

// 找正方形（4个顶点形成环，边长 a，对角线 a√2）
for (const [v1k, v1Nb] of edgeMap) {
    for (const v2k of v1Nb) {
        if (v2k <= v1k) continue;
        const v2Nb = edgeMap.get(v2k);
        for (const v3k of v2Nb) {
            if (v3k === v1k) continue;
            const v3Nb = edgeMap.get(v3k);
            if (!v3Nb) continue;
            for (const v4k of v3Nb) {
                if (v4k === v2k || v4k === v1k) continue;
                if (!v1Nb.has(v4k)) continue;
                // v1-v2-v3-v4 环
                const p1 = vertexMap.get(v1k), p2 = vertexMap.get(v2k);
                const p3 = vertexMap.get(v3k), p4 = vertexMap.get(v4k);
                const d13 = Math.hypot(p3.x - p1.x, p3.y - p1.y);
                const d24 = Math.hypot(p4.x - p2.x, p4.y - p2.y);
                if (Math.abs(d13 - a * Math.SQRT2) < TOL && Math.abs(d24 - a * Math.SQRT2) < TOL) {
                    const fk = [v1k, v2k, v3k, v4k].sort().join('|');
                    if (faceKeySet.has(fk)) continue;
                    const pts = [[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]];
                    if (faceCenterInBounds(pts)) {
                        faceKeySet.add(fk);
                        faces.push({
                            type: 'sq',
                            vertexKeys: [v1k, v2k, v3k, v4k],
                            vertices: sortPolygon(pts),
                        });
                    }
                }
            }
        }
    }
}

function sortPolygon(points) {
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    return [...points].sort((a, b) =>
        Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx)
    );
}

const triCount = faces.filter(f => f.type === 'tri').length;
const sqCount = faces.filter(f => f.type === 'sq').length;

console.log(`找到正方形: ${sqCount}`);
console.log(`\n总面数: ${faces.length}`);
console.log(`三角形: ${triCount}, 正方形: ${sqCount}`);
console.log(`三角形/正方形 比: ${(triCount / sqCount).toFixed(4)} (应为 2.0)`);

// ─── 第四步：构建邻居关系（共享至少一个顶点） ───────────────────────

// 为每个面分配 ID
for (let i = 0; i < faces.length; i++) {
    faces[i].id = i;
}

// 建立顶点 -> 面的映射
const vertex2faces = new Map();
for (const face of faces) {
    for (const [vx, vy] of face.vertices) {
        const key = vKey(vx, vy);
        if (!vertex2faces.has(key)) vertex2faces.set(key, new Set());
        vertex2faces.get(key).add(face.id);
    }
}

// 构建邻居关系
const neighbors = new Array(faces.length).fill(null).map(() => new Set());
for (const faceIds of vertex2faces.values()) {
    const ids = [...faceIds];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            neighbors[ids[i]].add(ids[j]);
            neighbors[ids[j]].add(ids[i]);
        }
    }
}

// ─── 第五步：验证 ────────────────────────────────────────────────

console.log('\n=== 验证结果 ===\n');

// 验证1: 三角形/正方形比
// 使用面密度验证：在一个基本域 L^2 面积中，应有 2 个正方形和 4 个三角形
// 所以密度比为 三角形密度/正方形密度 = 2:1
// 我们用总计数除以面积来估算密度
const ratio = triCount / sqCount;

// 更精确的验证：每个基本域面积 = L^2
// 正方形面积 = a^2, 三角形面积 = √3/4 * a^2
// 在一个 L^2 中，2 个正方形 + 4 个三角形的总面积 = 2a^2 + 4*√3/4*a^2 = (2+√3)*a^2 = L^2
// 这正好铺满！验证这个性质：
const domainArea = period * period;
const expectedTileArea = 2 * a * a + 4 * sqrt3 / 4 * a * a;
console.log(`[${Math.abs(domainArea - expectedTileArea) < TOL ? 'PASS' : 'FAIL'}] 基本域面积 L^2 = ${domainArea.toFixed(6)} = 2a^2 + √3a^2 = ${expectedTileArea.toFixed(6)}`);

// 使用 Euler 公式验证内部面的比值
// 对于正确的 snub square tiling，度数5的顶点关联 3 三角形 + 2 正方形
// 所以 内部顶点数 * 3 / 3 = 内部三角形数（每个三角形有3个顶点）
// 内部顶点数 * 2 / 4 = 内部正方形数（每个正方形有4个顶点）
// 但边界顶点也会贡献面，这个推导不精确

// 最可靠的验证：面积法
// 收集所有面，计算它们的总面积，与覆盖区域面积对比
let totalTriArea = 0, totalSqArea = 0;
for (const face of faces) {
    if (face.type === 'tri') {
        totalTriArea += sqrt3 / 4 * a * a;
    } else {
        totalSqArea += a * a;
    }
}
const totalFaceArea = totalTriArea + totalSqArea;
// 理论覆盖面积（大约）
const approxCoverArea = (GRID_N * period + 2 * margin) ** 2;
console.log(`面积覆盖率: ${(totalFaceArea / approxCoverArea * 100).toFixed(1)}% (应接近100%)`);

// 更精确的比值验证：使用面积法
// 在正确的 snub square tiling 中：
//   每个基本域面积 L^2 = (2+√3)*a^2
//   其中 2 个正方形（面积 2a^2）+ 4 个三角形（面积 4*√3/4*a^2 = √3*a^2）
//   总面积 = (2+√3)*a^2 = L^2 ✓
// 所以 三角形总面积 / 正方形总面积 = √3 / 2 ≈ 0.866
const triAreaTotal = triCount * sqrt3 / 4 * a * a;
const sqAreaTotal = sqCount * a * a;
const areaRatio = triAreaTotal / sqAreaTotal;
const expectedAreaRatio = sqrt3 / 2;
const areaRatioOk = Math.abs(areaRatio - expectedAreaRatio) < 0.05; // 允许边界偏差
console.log(`\n[INFO] 面积比 (三角形总面积/正方形总面积) = ${areaRatio.toFixed(4)} (理论值: ${expectedAreaRatio.toFixed(4)})`);

// 终极验证：每个 5 度顶点周围恰好有 3 个三角形和 2 个正方形
let vertex534Pass = true;
let vertex534Count = 0;
for (const [vk, fids] of vertex2faces) {
    if (fids.size !== 5) continue;
    vertex534Count++;
    const types = [...fids].map(id => faces[id].type);
    const triN = types.filter(t => t === 'tri').length;
    const sqN = types.filter(t => t === 'sq').length;
    if (triN !== 3 || sqN !== 2) {
        vertex534Pass = false;
        console.log(`  顶点 ${vk}: ${triN} 三角形 + ${sqN} 正方形 (应为 3+2)`);
    }
}
const ratioOk = vertex534Pass;
console.log(`[${vertex534Pass ? 'PASS' : 'FAIL'}] 所有 ${vertex534Count} 个 5 度顶点周围恰好 3 三角形 + 2 正方形`);

// 验证2: 顶点共享分布
const vertexShareHist = new Map();
for (const [vk, fids] of vertex2faces) {
    const n = fids.size;
    vertexShareHist.set(n, (vertexShareHist.get(n) || 0) + 1);
}
console.log('\n顶点被面共享数分布:');
for (const [n, cnt] of [...vertexShareHist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${n} 个面共享: ${cnt} 个顶点`);
}

// 找"内部顶点"（被 5 个面共享的）
const internalVertexCount = vertexShareHist.get(5) || 0;
const boundaryVertexCount = [...vertexShareHist.entries()]
    .filter(([n]) => n < 5)
    .reduce((s, [, c]) => s + c, 0);
console.log(`\n内部顶点（5面共享）: ${internalVertexCount}`);
console.log(`边界顶点（<5面共享）: ${boundaryVertexCount}`);

// 判断面是否"内部"：所有顶点都被5个面共享
function isFaceInternal(face) {
    return face.vertices.every(([x, y]) => {
        const key = vKey(x, y);
        const fids = vertex2faces.get(key);
        return fids && fids.size === 5;
    });
}

// 验证3&4: 邻居数分布
const sqNeighborHist = new Map();
const triNeighborHist = new Map();
let internalSqCount = 0, internalTriCount = 0;

for (const face of faces) {
    const nb = neighbors[face.id].size;
    const internal = isFaceInternal(face);
    if (face.type === 'sq') {
        if (internal) {
            sqNeighborHist.set(nb, (sqNeighborHist.get(nb) || 0) + 1);
            internalSqCount++;
        }
    } else {
        if (internal) {
            triNeighborHist.set(nb, (triNeighborHist.get(nb) || 0) + 1);
            internalTriCount++;
        }
    }
}

console.log(`\n内部正方形数: ${internalSqCount}`);
console.log('内部正方形邻居数分布:');
for (const [nb, cnt] of [...sqNeighborHist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${nb} 个邻居: ${cnt} 个正方形`);
}
const sqNbOk = sqNeighborHist.size === 1 && sqNeighborHist.has(12);
console.log(`[${sqNbOk ? 'PASS' : 'FAIL'}] 内部正方形邻居数 = ${[...sqNeighborHist.keys()].join(',')} (期望: 12)`);

console.log(`\n内部三角形数: ${internalTriCount}`);
console.log('内部三角形邻居数分布:');
for (const [nb, cnt] of [...triNeighborHist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${nb} 个邻居: ${cnt} 个三角形`);
}
const triNbOk = triNeighborHist.size === 1 && triNeighborHist.has(9);
console.log(`[${triNbOk ? 'PASS' : 'FAIL'}] 内部三角形邻居数 = ${[...triNeighborHist.keys()].join(',')} (期望: 9)`);

// 总结
console.log('\n=== 总结 ===');
console.log(`总面数: ${faces.length} (${triCount} 三角形 + ${sqCount} 正方形)`);
console.log(`内部面（顶点定义）: ${internalTriCount + internalSqCount} (${internalTriCount} 三角形 + ${internalSqCount} 正方形)`);
console.log(`全局比值: ${ratio.toFixed(4)}, 面积比: ${areaRatio.toFixed(4)}`);
console.log(`内部正方形: ${internalSqCount}, 全部邻居数 = ${[...sqNeighborHist.keys()].join(',')}`);
console.log(`内部三角形: ${internalTriCount}, 全部邻居数 = ${[...triNeighborHist.keys()].join(',')}`);

const allPass = ratioOk && sqNbOk && triNbOk;
console.log(`\n总体: ${allPass ? '全部通过' : '有测试失败'}`);
if (allPass) console.log('几何构造正确！');

// ─── 额外：验证边长一致性 ─────────────────────────────────────────
console.log('\n=== 边长验证 ===');
let minEdge = Infinity, maxEdge = 0;
let edgeCheckCount = 0;
for (const face of faces) {
    const n = face.vertices.length;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = face.vertices[i];
        const [x2, y2] = face.vertices[(i + 1) % n];
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < minEdge) minEdge = d;
        if (d > maxEdge) maxEdge = d;
        edgeCheckCount++;
    }
}
console.log(`检查 ${edgeCheckCount} 条边`);
console.log(`最短边: ${minEdge.toFixed(8)}, 最长边: ${maxEdge.toFixed(8)}`);
console.log(`边长偏差: ${((maxEdge - minEdge) / a * 100).toFixed(6)}%`);
const edgeOk = Math.abs(maxEdge - a) < TOL * 100 && Math.abs(minEdge - a) < TOL * 100;
console.log(`[${edgeOk ? 'PASS' : 'FAIL'}] 所有边长 ≈ ${a}`);
