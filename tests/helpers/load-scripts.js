// tests/helpers/load-scripts.js
// 用 vm.runInNewContext 加载源码脚本，返回导出的全局变量

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { setupMockDOM } = require('./mock-dom');

const ROOT = path.resolve(__dirname, '../..');

/**
 * 加载游戏脚本到一个隔离的 vm 上下文，返回该上下文。
 * @param {string[]} scripts - 相对于项目根目录的脚本路径列表
 * @param {object} extraGlobals - 额外注入的全局变量（如 sides, rows, cols）
 */
function loadScripts(scripts, extraGlobals = {}) {
  // 先设置 mock DOM 到 global（vm.createContext 会复制 global）
  setupMockDOM();

  const context = vm.createContext({
    ...global,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    require,
    ...extraGlobals,
  });

  for (const rel of scripts) {
    const fullPath = path.join(ROOT, rel);
    const code = fs.readFileSync(fullPath, 'utf-8');
    vm.runInContext(code, context, { filename: rel });
  }

  return context;
}

/**
 * 构造 geometry + renderer 所需的最小全局变量集合
 */
function makeGameGlobals(overrides = {}) {
  return {
    sides: 4,
    rows: 10,
    cols: 10,
    cellSize: 40,
    gameOver: false,
    firstClick: true,
    revealed: {},
    flagged: {},
    board: {},
    NUM_COLORS: {
      1: '#4a9eff', 2: '#2ed573', 3: '#ff4757',
      4: '#a55eea', 5: '#ffa502', 6: '#1dd1a1',
      7: '#ff6b81', 8: '#70a1ff',
    },
    handleClick: () => {},
    handleRightClick: () => {},
    handleTouchStart: () => {},
    handleTouchEnd: () => {},
    handleTouchCancel: () => {},
    ...overrides,
  };
}

module.exports = { loadScripts, makeGameGlobals };
