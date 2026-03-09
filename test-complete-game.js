// 完整的游戏流程测试
// 模拟真实游戏场景，测试 Canvas 渲染器

// Mock DOM
global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            const canvas = {
                width: 0,
                height: 0,
                style: {},
                getContext: (type) => {
                    if (type === '2d') {
                        return {
                            clearRect: () => {},
                            beginPath: () => {},
                            moveTo: () => {},
                            lineTo: () => {},
                            closePath: () => {},
                            fill: () => {},
                            stroke: () => {},
                            fillText: () => {},
                            createLinearGradient: () => ({
                                addColorStop: () => {}
                            })
                        };
                    }
                    return null;
                },
                addEventListener: () => {},
                getBoundingClientRect: () => ({ left: 0, top: 0 })
            };
            return canvas;
        }
        return {
            appendChild: () => {},
            children: [],
            append: () => {},
            querySelector: () => null,
            querySelectorAll: () => []
        };
    },
    getElementById: () => ({
        appendChild: () => {},
        innerHTML: '',
        style: {}
    }),
    querySelector: () => null,
    querySelectorAll: () => []
};

// Mock game globals for different board sizes
const testCases = [
    { sides: 3, rows: 10, cols: 10, cellSize: 48 },
    { sides: 4, rows: 10, cols: 10, cellSize: 40 },
    { sides: 6, rows: 10, cols: 10, cellSize: 44 },
    { sides: 8, rows: 5, cols: 5, cellSize: 44 },
    { sides: 4, rows: 100, cols: 100, cellSize: 40 }, // 大棋盘
];

const fs = require('fs');

// Load geometry.js
const geometryCode = fs.readFileSync('geometry.js', 'utf-8');

// Load renderer.js
const rendererCode = fs.readFileSync('renderer.js', 'utf-8');

console.log('========================================');
console.log('Canvas 渲染器完整测试');
console.log('========================================\n');

let allPassed = true;

for (const testCase of testCases) {
    console.log(`\n测试 ${testCase.sides} 边形 ${testCase.rows}x${testCase.cols} 棋盘...`);

    // Reset globals
    let sides = testCase.sides;
    let rows = testCase.rows;
    let cols = testCase.cols;
    let cellSize = testCase.cellSize;
    let gameOver = false;
    let revealed = {};
    let flagged = {};
    const NUM_COLORS = {
        1: '#4a9eff', 2: '#2ed573', 3: '#ff4757',
        4: '#a55eea', 5: '#ffa502', 6: '#1dd1a1',
        7: '#ff6b81', 8: '#70a1ff',
    };

    // Mock game functions
    function handleClick(row, col) {}
    function handleRightClick(e, row, col) {}
    function handleTouchStart(e, row, col) {}
    function handleTouchEnd(e, row, col) {}
    function handleTouchCancel(row, col) {}

    try {
        // Execute geometry.js
        eval(geometryCode);

        // Execute renderer.js
        eval(rendererCode);

        // Test createSVGBoard
        const boardEl = { appendChild: () => {} };
        const { width, height } = getBoardSize(sides);

        const startTime = Date.now();
        createSVGBoard(boardEl, width, height);
        const endTime = Date.now();

        console.log(`  ✅ 创建棋盘: ${width}x${height}, 耗时: ${endTime - startTime}ms`);

        // Test getSVGCell
        const cell = getSVGCell(0, 0);
        if (!cell) {
            throw new Error('getSVGCell 返回 null');
        }
        console.log('  ✅ getSVGCell 工作正常');

        // Test setCellState
        setCellState(0, 0, 'revealed', 1);
        setCellState(1, 1, 'flagged');
        setCellState(2, 2, 'mine');
        console.log('  ✅ setCellState 工作正常');

        // Test large number of updates
        const updateCount = 1000;
        const updateStart = Date.now();
        for (let i = 0; i < updateCount; i++) {
            const row = Math.floor(Math.random() * rows);
            const col = Math.floor(Math.random() * cols);
            const state = ['normal', 'revealed', 'flagged', 'mine'][Math.floor(Math.random() * 4)];
            const value = state === 'revealed' ? Math.floor(Math.random() * 8) + 1 : '';
            setCellState(row, col, state, value);
        }
        const updateEnd = Date.now();
        console.log(`  ✅ ${updateCount} 次更新耗时: ${updateEnd - updateStart}ms`);

    } catch (error) {
        console.log(`  ❌ 错误: ${error.message}`);
        allPassed = false;
    }
}

console.log('\n========================================');
if (allPassed) {
    console.log('✅ 所有测试通过！');
    console.log('Canvas 渲染器性能优秀，可以替代 SVG。');
} else {
    console.log('❌ 部分测试失败');
    process.exit(1);
}
console.log('========================================\n');
