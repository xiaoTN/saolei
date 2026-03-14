// tests/helpers/mock-dom.js
// 共享 Mock DOM，供所有单元/集成测试使用

'use strict';

function makeMockCanvas() {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext(type) {
      if (type !== '2d') return null;
      return {
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        measureText: () => ({ width: 10 }),
        save: () => {},
        restore: () => {},
        setLineDash: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: '',
        textBaseline: '',
      };
    },
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
}

function makeMockElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    children: [],
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    dataset: {},
    clientWidth: 800,
    clientHeight: 600,
    offsetWidth: 400,
    offsetHeight: 400,
  };
}

function setupMockDOM() {
  global.document = {
    createElement(tag) {
      if (tag === 'canvas') return makeMockCanvas();
      return makeMockElement(tag);
    },
    getElementById(id) {
      const el = makeMockElement('div');
      if (id === 'boardViewport') { el.clientWidth = 800; el.clientHeight = 600; }
      if (id === 'board') { el.offsetWidth = 400; el.offsetHeight = 400; }
      return el;
    },
    querySelector: () => ({
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      dataset: { sides: 4, diff: 'medium' },
      disabled: false,
    }),
    querySelectorAll: () => [],
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {},
  };

  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 800,
    innerHeight: 600,
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
  };

  global.navigator = { vibrate: () => {} };

  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  global.HapticsAdapter = { tick: () => {}, light: () => {}, error: () => {} };
}

module.exports = { setupMockDOM };
