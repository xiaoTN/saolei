// 测试主游戏是否能正常加载所有脚本
// 模拟浏览器环境，检查是否有错误

// Mock DOM
global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                width: 0,
                height: 0,
                style: {},
                getContext: () => ({
                    clearRect: () => {},
                    beginPath: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    closePath: () => {},
                    fill: () => {},
                    stroke: () => {},
                    fillText: () => {},
                    createLinearGradient: () => ({ addColorStop: () => {} })
                }),
                addEventListener: () => {},
                getBoundingClientRect: () => ({ left: 0, top: 0 })
            };
        }
        if (tag === 'div' || tag === 'span' || tag === 'button') {
            return {
                classList: { add: () => {}, remove: () => {}, toggle: () => {} },
                appendChild: () => {},
                addEventListener: () => {},
                style: {},
                textContent: '',
                innerHTML: ''
            };
        }
        return { appendChild: () => {}, addEventListener: () => {}, style: {} };
    },
    getElementById: (id) => {
        const element = {
            appendChild: () => {},
            innerHTML: '',
            style: {},
            classList: { add: () => {}, remove: () => {} },
            textContent: '',
            value: 10,
            disabled: false,
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => []
        };

        // 为 boardViewport 添加 clientWidth 和 clientHeight
        if (id === 'boardViewport') {
            element.clientWidth = 800;
            element.clientHeight = 600;
        }

        // 为 board 添加 offsetWidth 和 offsetHeight
        if (id === 'board') {
            element.offsetWidth = 400;
            element.offsetHeight = 400;
        }

        return element;
    },
    querySelector: () => ({
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        dataset: { sides: 4, diff: 'medium' },
        disabled: false
    }),
    querySelectorAll: () => [],
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {}
};

global.window = {
    addEventListener: () => {},
    innerWidth: 800,
    innerHeight: 600
};

global.navigator = {
    vibrate: () => {}
};

global.localStorage = {
    getItem: () => null,
    setItem: () => {}
};

global.sessionStorage = {
    getItem: () => null,
    setItem: () => {}
};

global.HapticsAdapter = {
    tick: () => {},
    light: () => {},
    error: () => {}
};

const fs = require('fs');
const vm = require('vm');

console.log('测试主游戏脚本加载...\n');

const scripts = [
    'shared/platform.js',
    'shared/storage.js',
    'shared/haptics.js',
    'geometry.js',
    'renderer.js',
    'game.js'
];

const context = vm.createContext(global);

for (const script of scripts) {
    try {
        const code = fs.readFileSync(script, 'utf-8');
        vm.runInContext(code, context, { filename: script });
        console.log(`✅ ${script}`);
    } catch (error) {
        console.log(`❌ ${script}: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

console.log('\n✅ 所有脚本加载成功！');
console.log('\nCanvas 渲染器已成功集成到主游戏中。');
