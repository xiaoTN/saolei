// unit-test.js
// 基础稳定功能的单元测试
// 用法: node unit-test.js

// ─── 测试框架 ──────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passCount++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failCount++;
        failures.push({ name, error: e.message });
        console.log(`  ❌ ${name}`);
        console.log(`     Error: ${e.message}`);
    }
}

function assertEqual(actual, expected, msg = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${msg}\n     Expected: ${JSON.stringify(expected)}\n     Actual:   ${JSON.stringify(actual)}`);
    }
}

function assertTrue(condition, msg = '') {
    if (!condition) {
        throw new Error(msg || 'Assertion failed');
    }
}

function assertInRange(value, min, max, msg = '') {
    if (value < min || value > max) {
        throw new Error(`${msg}\n     Expected: ${min} <= ${value} <= ${max}`);
    }
}

// ─── Mock 全局变量 ──────────────────────────────────────────────

// geometry.js 依赖这些全局变量
global.rows = 10;
global.cols = 10;
global.cellSize = 44;

// 加载 geometry.js
const fs = require('fs');
const geometryCode = fs.readFileSync(__dirname + '/geometry.js', 'utf-8');

// 在全局上下文中执行
eval(geometryCode);

// ─── 测试几何计算 ──────────────────────────────────────────────

console.log('\n📐 几何计算测试');
console.log('─'.repeat(50));

test('三角形顶点计算 - 尖朝上', () => {
    const verts = triVertices(0, 0);
    assertEqual(verts.length, 3, '三角形应该有3个顶点');
    // 尖朝上：顶点在上
    assertTrue(verts[0][1] < verts[1][1], '尖朝上的三角形');
});

test('三角形顶点计算 - 尖朝下', () => {
    const verts = triVertices(0, 1);
    assertEqual(verts.length, 3, '三角形应该有3个顶点');
    // 尖朝下：顶点在下
    assertTrue(verts[2][1] > verts[0][1], '尖朝下的三角形');
});

test('三角形邻居数量', () => {
    // 中间位置的三角形应该有12个邻居
    const nb = triNeighbors(5, 5);
    assertTrue(nb.length > 0, '应该有邻居');
    assertTrue(nb.length <= 12, '邻居数不超过12');
});

test('正方形顶点计算', () => {
    const verts = sqVertices(0, 0);
    assertEqual(verts.length, 4, '正方形应该有4个顶点');
    assertEqual(verts, [[0, 0], [44, 0], [44, 44], [0, 44]], '顶点坐标');
});

test('正方形邻居 - 角落', () => {
    const nb = sqNeighbors(0, 0);
    assertEqual(nb.length, 3, '角落格子应该有3个邻居');
});

test('正方形邻居 - 边缘', () => {
    const nb = sqNeighbors(0, 5);
    assertEqual(nb.length, 5, '边缘格子应该有5个邻居');
});

test('正方形邻居 - 中间', () => {
    const nb = sqNeighbors(5, 5);
    assertEqual(nb.length, 8, '中间格子应该有8个邻居');
});

test('六边形顶点计算', () => {
    const verts = hexVertices(0, 0);
    assertEqual(verts.length, 6, '六边形应该有6个顶点');
});

test('六边形邻居数量', () => {
    const nb = hexNeighbors(5, 5);
    assertEqual(nb.length, 6, '中间六边形应该有6个邻居');
});

test('八边形顶点计算', () => {
    const verts = octSqVertices(0, 0); // gr=0, gc=0 是八边形
    assertEqual(verts.length, 8, '八边形应该有8个顶点');
});

test('小正方形顶点计算', () => {
    const verts = octSqVertices(1, 1); // gr=1, gc=1 是小正方形
    assertEqual(verts.length, 4, '小正方形应该有4个顶点');
});

test('八边形邻居', () => {
    const nb = octSqNeighbors(2, 2); // 八边形
    assertEqual(nb.length, 8, '八边形应该有8个邻居');
});

test('小正方形邻居', () => {
    const nb = octSqNeighbors(1, 1); // 小正方形
    assertEqual(nb.length, 4, '小正方形应该有4个邻居');
});

// ─── 测试统一接口 ──────────────────────────────────────────────

console.log('\n🔌 统一接口测试');
console.log('─'.repeat(50));

test('getCellVertices - 所有边数', () => {
    for (const sides of [3, 4, 6, 8]) {
        const verts = getCellVertices(sides, 0, 0);
        assertTrue(verts.length >= 3, `${sides}边形顶点数 >= 3`);
    }
});

test('getCellCenter - 返回中心点', () => {
    const center = getCellCenter(4, 0, 0);
    assertEqual(center.length, 2, '中心点应该是[x, y]');
    assertEqual(center, [22, 22], '正方形中心点');
});

test('getNeighbors - 边界检查', () => {
    // 测试边界外的坐标不会返回负数
    for (const sides of [3, 4, 6, 8]) {
        const nb = getNeighbors(sides, 0, 0);
        for (const [r, c] of nb) {
            assertTrue(r >= 0 && c >= 0, `${sides}边形邻居坐标非负`);
        }
    }
});

test('getBoardSize - 返回尺寸', () => {
    for (const sides of [3, 4, 6, 8]) {
        const size = getBoardSize(sides);
        assertTrue(size.width > 0 && size.height > 0, `${sides}边形棋盘尺寸有效`);
    }
});

test('getAllCells - 返回所有格子', () => {
    global.rows = 5;
    global.cols = 5;
    
    for (const sides of [3, 4, 6, 8]) {
        const cells = getAllCells(sides);
        assertTrue(cells.length > 0, `${sides}边形有格子`);
        
        // 验证每个格子坐标有效
        for (const [r, c] of cells) {
            assertTrue(r >= 0 && c >= 0, `${sides}边形格子坐标非负`);
        }
    }
    
    global.rows = 10;
    global.cols = 10;
});

// ─── 测试数学一致性 ──────────────────────────────────────────────

console.log('\n🔢 数学一致性测试');
console.log('─'.repeat(50));

test('三角形类型交替', () => {
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const type = triType(r, c);
            const expected = (r + c) % 2 === 0 ? 'up' : 'down';
            assertEqual(type, expected, `triType(${r}, ${c})`);
        }
    }
});

test('六边形邻居互为邻居', () => {
    // 如果 A 是 B 的邻居，那么 B 也应该是 A 的邻居
    const nb1 = hexNeighbors(5, 5);
    for (const [r, c] of nb1) {
        const nb2 = hexNeighbors(r, c);
        const found = nb2.some(([nr, nc]) => nr === 5 && nc === 5);
        assertTrue(found, `(${r},${c}) 的邻居包含 (5,5)`);
    }
});

test('正方形邻居互为邻居', () => {
    const nb1 = sqNeighbors(5, 5);
    for (const [r, c] of nb1) {
        const nb2 = sqNeighbors(r, c);
        const found = nb2.some(([nr, nc]) => nr === 5 && nc === 5);
        assertTrue(found, `(${r},${c}) 的邻居包含 (5,5)`);
    }
});

test('八边形-正方形邻居互为邻居', () => {
    // 八边形 (2,2) 的邻居
    const octNb = octSqNeighbors(2, 2);
    // 检查小正方形 (1,1)
    const sqNb = octSqNeighbors(1, 1);
    
    // 八边形的邻居应该包含小正方形
    const foundInOct = octNb.some(([r, c]) => r === 1 && c === 1);
    assertTrue(foundInOct, '八边形邻居包含小正方形');
    
    // 小正方形的邻居应该包含八边形
    const foundInSq = sqNb.some(([r, c]) => r === 2 && c === 2);
    assertTrue(foundInSq, '小正方形邻居包含八边形');
});

// ─── 测试边界条件 ────────────────────────────────────────────────

console.log('\n🚧 边界条件测试');
console.log('─'.repeat(50));

test('棋盘角落邻居数', () => {
    // 正方形四个角落
    assertEqual(sqNeighbors(0, 0).length, 3, '左上角');
    assertEqual(sqNeighbors(0, 9).length, 3, '右上角');
    assertEqual(sqNeighbors(9, 0).length, 3, '左下角');
    assertEqual(sqNeighbors(9, 9).length, 3, '右下角');
});

test('棋盘边缘邻居数', () => {
    assertEqual(sqNeighbors(0, 5).length, 5, '上边缘');
    assertEqual(sqNeighbors(9, 5).length, 5, '下边缘');
    assertEqual(sqNeighbors(5, 0).length, 5, '左边缘');
    assertEqual(sqNeighbors(5, 9).length, 5, '右边缘');
});

test('无效坐标处理', () => {
    // 超出边界的坐标应该返回空数组或过滤掉
    global.rows = 3;
    global.cols = 3;
    
    const nb = sqNeighbors(5, 5);
    assertEqual(nb.length, 0, '超出边界的坐标没有邻居');
    
    global.rows = 10;
    global.cols = 10;
});

// ─── 输出测试报告 ────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log('📊 测试报告');
console.log('='.repeat(50));
console.log(`✅ 通过: ${passCount}`);
console.log(`❌ 失败: ${failCount}`);
console.log(`📋 总计: ${passCount + failCount}`);

if (failures.length > 0) {
    console.log('\n❌ 失败详情:');
    failures.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.name}`);
        console.log(`     ${f.error}`);
    });
    process.exit(1);
} else {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
}
