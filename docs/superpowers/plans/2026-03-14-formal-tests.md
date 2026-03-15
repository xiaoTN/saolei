# 正式测试体系 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 11 个临时测试文件，建立分层正式测试体系（node:test 单元测试 + Playwright E2E 测试）。

**Architecture:** 共享 Mock DOM 和脚本加载工具放在 `tests/helpers/`，单元测试覆盖 geometry / renderer / snub-square 几何逻辑，Playwright E2E 覆盖真实浏览器交互（形状切换、开格、标旗）。

**Tech Stack:** Node.js 23（内置 `node:test` + `assert`）、Playwright 1.58（已全局安装）、无额外 npm 依赖。

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 新建 | `tests/helpers/mock-dom.js` | 共享 Canvas Mock DOM + window/navigator/storage stub |
| 新建 | `tests/helpers/load-scripts.js` | vm 加载 geometry / renderer / game 的工具函数 |
| 新建 | `tests/unit/geometry.test.js` | getBoardSize、getCellVertices、getNeighbors 单元测试 |
| 新建 | `tests/unit/renderer.test.js` | createSVGBoard、getSVGCell、setCellState 集成测试 |
| 新建 | `tests/unit/snub-square.test.js` | Snub Square 几何验证（三角/正方形比、邻居数） |
| 新建 | `tests/e2e/game.test.js` | Playwright 端到端测试（7种形状、难度、交互） |
| 修改 | `package.json` | 添加 test/test:unit/test:e2e scripts、playwright devDependency |
| 删除 | `test-game.js` 等 11 个临时文件 | 清理临时文件 |

---

## Chunk 1: 基础设施（helpers + package.json）

### Task 1: 创建 tests/helpers/mock-dom.js

**Files:**
- Create: `tests/helpers/mock-dom.js`

- [ ] **Step 1: 创建 mock-dom.js**

```js
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
```

- [ ] **Step 2: 确认文件语法正确**

```bash
node --check tests/helpers/mock-dom.js
```
期望：无输出（无错误）

---

### Task 2: 创建 tests/helpers/load-scripts.js

**Files:**
- Create: `tests/helpers/load-scripts.js`

- [ ] **Step 1: 创建 load-scripts.js**

```js
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
```

- [ ] **Step 2: 确认文件语法正确**

```bash
node --check tests/helpers/load-scripts.js
```
期望：无输出

---

### Task 3: 更新 package.json，添加测试脚本和 Playwright 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 更新 package.json**

将 `package.json` 改为：

```json
{
  "name": "saolei-multiplayer",
  "version": "1.0.0",
  "description": "多边形扫雷联机服务器",
  "main": "server.js",
  "scripts": {
    "server": "node server.js",
    "test": "node --test tests/unit/*.test.js",
    "test:unit": "node --test tests/unit/*.test.js",
    "test:e2e": "npx playwright test tests/e2e/"
  },
  "dependencies": {
    "ws": "^8.19.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.0"
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add tests/helpers/mock-dom.js tests/helpers/load-scripts.js package.json
git commit -m "test: 添加测试基础设施（mock-dom、load-scripts、package.json 测试脚本）"
```

---

## Chunk 2: 单元测试

### Task 4: geometry 单元测试

**Files:**
- Create: `tests/unit/geometry.test.js`

**说明：** geometry.js 是纯计算模块，用 vm 加载后直接调用函数验证返回值。

- [ ] **Step 1: 创建 tests/unit/geometry.test.js**

```js
// tests/unit/geometry.test.js
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('../helpers/load-scripts');

// geometry.js 不依赖 renderer，加载时只需 sides/rows/cols/cellSize
function loadGeometry(overrides = {}) {
  return loadScripts(['geometry.js'], {
    sides: 4, rows: 10, cols: 10, cellSize: 40,
    ...overrides,
  });
}

describe('getBoardSize', () => {
  test('正方形(sides=4) 返回正确画布尺寸', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const { width, height } = ctx.getBoardSize(4);
    assert.ok(width > 0, 'width 应大于 0');
    assert.ok(height > 0, 'height 应大于 0');
    // 10 列 * cellSize = 400，加上 padding
    assert.ok(width >= 400, `width=${width} 应 >= 400`);
    assert.ok(height >= 400, `height=${height} 应 >= 400`);
  });

  const allSides = [3, 4, 5, 6, 8, 34, 36];
  for (const s of allSides) {
    test(`sides=${s} 返回正值尺寸`, () => {
      const ctx = loadGeometry({ sides: s, rows: 8, cols: 8, cellSize: 40 });
      const { width, height } = ctx.getBoardSize(s);
      assert.ok(width > 0, `sides=${s}: width 应大于 0`);
      assert.ok(height > 0, `sides=${s}: height 应大于 0`);
    });
  }
});

describe('getCellVertices', () => {
  test('正方形(sides=4) 返回 4 个顶点', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const verts = ctx.getCellVertices(0, 0);
    assert.equal(verts.length, 4, '正方形应有 4 个顶点');
  });

  test('三角形(sides=3) 返回 3 个顶点', () => {
    const ctx = loadGeometry({ sides: 3, rows: 10, cols: 10, cellSize: 40 });
    const verts = ctx.getCellVertices(0, 0);
    assert.equal(verts.length, 3, '三角形应有 3 个顶点');
  });

  test('六边形(sides=6) 返回 6 个顶点', () => {
    const ctx = loadGeometry({ sides: 6, rows: 10, cols: 10, cellSize: 40 });
    const verts = ctx.getCellVertices(0, 0);
    assert.equal(verts.length, 6, '六边形应有 6 个顶点');
  });

  test('顶点均为 [x, y] 数字对', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const verts = ctx.getCellVertices(2, 3);
    for (const [x, y] of verts) {
      assert.equal(typeof x, 'number', 'x 应为数字');
      assert.equal(typeof y, 'number', 'y 应为数字');
    }
  });
});

describe('getNeighbors', () => {
  test('正方形内部格有 8 个邻居', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(5, 5);
    assert.equal(neighbors.length, 8, '内部格应有 8 个邻居');
  });

  test('正方形角格邻居数 <= 3', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(0, 0);
    assert.ok(neighbors.length <= 3, `角格邻居数=${neighbors.length} 应 <= 3`);
  });

  test('六边形内部格有 6 个邻居', () => {
    const ctx = loadGeometry({ sides: 6, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(5, 5);
    assert.equal(neighbors.length, 6, '六边形内部格应有 6 个邻居');
  });

  test('返回值为 [row, col] 数字对数组', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(5, 5);
    for (const nb of neighbors) {
      assert.ok(Array.isArray(nb) || (typeof nb === 'object' && 'row' in nb),
        '邻居应为数组或含 row/col 的对象');
    }
  });
});

describe('getAllCells', () => {
  test('正方形 10x10 返回 100 个格子', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const cells = ctx.getAllCells();
    assert.equal(cells.length, 100);
  });

  test('三角形 10x10 返回 200 个格子', () => {
    // sides=3 内部 cols 已乘 2
    const ctx = loadGeometry({ sides: 3, rows: 10, cols: 10, cellSize: 40 });
    const cells = ctx.getAllCells();
    assert.equal(cells.length, 200);
  });
});
```

- [ ] **Step 2: 运行测试，确认通过**

```bash
node --test tests/unit/geometry.test.js
```
期望：所有 test 标记为 pass。若有 FAIL 说明函数名或返回值格式与预期不符，按实际调整断言。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/geometry.test.js
git commit -m "test: 添加 geometry.js 单元测试"
```

---

### Task 5: renderer 集成测试

**Files:**
- Create: `tests/unit/renderer.test.js`

**说明：** renderer.js 依赖 geometry.js，需同时加载两者并提供完整 mock 全局变量。

- [ ] **Step 1: 创建 tests/unit/renderer.test.js**

```js
// tests/unit/renderer.test.js
'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, makeGameGlobals } = require('../helpers/load-scripts');

function loadRenderer(overrides = {}) {
  return loadScripts(
    ['geometry.js', 'renderer.js'],
    makeGameGlobals(overrides)
  );
}

describe('createSVGBoard', () => {
  test('正方形棋盘创建不抛出异常', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const boardEl = { appendChild: () => {} };
    const { width, height } = ctx.getBoardSize(4);
    assert.doesNotThrow(() => ctx.createSVGBoard(boardEl, width, height));
  });

  const allSides = [3, 4, 5, 6, 8, 34, 36];
  for (const s of allSides) {
    test(`sides=${s} 棋盘创建不抛出异常`, () => {
      const ctx = loadRenderer({ sides: s, rows: 8, cols: 8 });
      const boardEl = { appendChild: () => {} };
      const { width, height } = ctx.getBoardSize(s);
      assert.doesNotThrow(() => ctx.createSVGBoard(boardEl, width, height));
    });
  }
});

describe('getSVGCell', () => {
  test('createSVGBoard 后 getSVGCell(0,0) 返回非 null', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const boardEl = { appendChild: () => {} };
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(boardEl, width, height);
    const cell = ctx.getSVGCell(0, 0);
    assert.ok(cell !== null && cell !== undefined, 'getSVGCell(0,0) 应返回有效格子');
  });

  test('越界坐标 getSVGCell 返回 null/undefined', () => {
    const ctx = loadRenderer({ sides: 4, rows: 5, cols: 5 });
    const boardEl = { appendChild: () => {} };
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(boardEl, width, height);
    const cell = ctx.getSVGCell(999, 999);
    assert.ok(cell == null, '越界坐标应返回 null/undefined');
  });
});

describe('setCellState', () => {
  test('setCellState revealed/flagged/mine/normal 均不抛出异常', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const boardEl = { appendChild: () => {} };
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(boardEl, width, height);

    const states = [
      [0, 0, 'revealed', 3],
      [1, 1, 'flagged'],
      [2, 2, 'mine'],
      [3, 3, 'normal'],
    ];
    for (const args of states) {
      assert.doesNotThrow(
        () => ctx.setCellState(...args),
        `setCellState(${args.join(',')}) 不应抛出异常`
      );
    }
  });

  test('大量更新（1000次）不抛出异常', () => {
    const ctx = loadRenderer({ sides: 4, rows: 20, cols: 20 });
    const boardEl = { appendChild: () => {} };
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(boardEl, width, height);

    assert.doesNotThrow(() => {
      for (let i = 0; i < 1000; i++) {
        const row = Math.floor(Math.random() * 20);
        const col = Math.floor(Math.random() * 20);
        const state = ['normal', 'revealed', 'flagged', 'mine'][i % 4];
        const val = state === 'revealed' ? (i % 8) + 1 : undefined;
        ctx.setCellState(row, col, state, val);
      }
    });
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
node --test tests/unit/renderer.test.js
```
期望：所有 test pass。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/renderer.test.js
git commit -m "test: 添加 renderer.js 集成测试"
```

---

### Task 6: Snub Square 几何验证测试

**Files:**
- Create: `tests/unit/snub-square.test.js`

**说明：** 将 `test_snub_square.js` 的验证逻辑重构为结构化断言，验证 Snub Square 平铺几何正确性。使用较小的 GRID_N=4 保证速度。

- [ ] **Step 1: 创建 tests/unit/snub-square.test.js**

```js
// tests/unit/snub-square.test.js
// 验证 Snub Square Tiling (3.3.4.3.4) 几何正确性
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── 参数 ──────────────────────────────────────────────────────────
const a = 1;
const GRID_N = 4;
const TOL = a * 1e-6;
const sqrt3 = Math.sqrt(3);

// ── 顶点生成 ──────────────────────────────────────────────────────
const s = Math.sqrt(2 + sqrt3) / 4;
const period = 4 * s;

const vertexOffsets = [
  [s * (3 - sqrt3), s * (sqrt3 - 1)],
  [s * (1 - sqrt3), s * (3 - sqrt3)],
  [s * (sqrt3 - 3), s * (1 - sqrt3)],
  [s * (sqrt3 - 1), s * (sqrt3 - 3)],
];

function vKey(x, y) {
  return Math.round(x * 1e6) / 1e6 + ',' + Math.round(y * 1e6) / 1e6;
}

function buildTiling() {
  const vertexMap = new Map();
  for (let i = -2; i <= GRID_N + 1; i++) {
    for (let j = -2; j <= GRID_N + 1; j++) {
      for (const [ox, oy] of vertexOffsets) {
        const x = ox + i * period;
        const y = oy + j * period;
        const key = vKey(x, y);
        if (!vertexMap.has(key)) vertexMap.set(key, { x, y, key });
      }
    }
  }

  // 建边图（空间哈希）
  const CELL_SIZE = a * 1.5;
  const spatialHash = new Map();
  for (const v of vertexMap.values()) {
    const hk = Math.floor(v.x / CELL_SIZE) + ',' + Math.floor(v.y / CELL_SIZE);
    if (!spatialHash.has(hk)) spatialHash.set(hk, []);
    spatialHash.get(hk).push(v);
  }

  const edgeMap = new Map();
  for (const v of vertexMap.values()) {
    if (!edgeMap.has(v.key)) edgeMap.set(v.key, new Set());
    const hx = Math.floor(v.x / CELL_SIZE);
    const hy = Math.floor(v.y / CELL_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = spatialHash.get((hx + dx) + ',' + (hy + dy));
        if (!cell) continue;
        for (const u of cell) {
          if (u.key === v.key) continue;
          if (Math.abs(Math.hypot(u.x - v.x, u.y - v.y) - a) < TOL) {
            if (!edgeMap.has(u.key)) edgeMap.set(u.key, new Set());
            edgeMap.get(v.key).add(u.key);
            edgeMap.get(u.key).add(v.key);
          }
        }
      }
    }
  }

  // 找面
  const margin = a * 2;
  const minB = -margin, maxB = GRID_N * period + margin;
  function inBounds(pts) {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return cx > minB && cx < maxB && cy > minB && cy < maxB;
  }

  function sortPolygon(pts) {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  }

  const faceKeySet = new Set();
  const faces = [];

  // 三角形
  for (const [v1k, v1Nb] of edgeMap) {
    for (const v2k of v1Nb) {
      if (v2k <= v1k) continue;
      const v2Nb = edgeMap.get(v2k);
      for (const v3k of v2Nb) {
        if (v3k <= v2k || !v1Nb.has(v3k)) continue;
        const fk = [v1k, v2k, v3k].sort().join('|');
        if (faceKeySet.has(fk)) continue;
        const p1 = vertexMap.get(v1k), p2 = vertexMap.get(v2k), p3 = vertexMap.get(v3k);
        const area = Math.abs((p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)) / 2;
        if (Math.abs(area - sqrt3 / 4 * a * a) < TOL * a) {
          const pts = [[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]];
          if (inBounds(pts)) { faceKeySet.add(fk); faces.push({ type: 'tri', vertexKeys: [v1k, v2k, v3k], vertices: sortPolygon(pts) }); }
        }
      }
    }
  }

  // 正方形
  for (const [v1k, v1Nb] of edgeMap) {
    for (const v2k of v1Nb) {
      if (v2k <= v1k) continue;
      for (const v3k of edgeMap.get(v2k)) {
        if (v3k === v1k) continue;
        for (const v4k of edgeMap.get(v3k)) {
          if (v4k === v2k || v4k === v1k || !v1Nb.has(v4k)) continue;
          const p1 = vertexMap.get(v1k), p2 = vertexMap.get(v2k);
          const p3 = vertexMap.get(v3k), p4 = vertexMap.get(v4k);
          const d13 = Math.hypot(p3.x - p1.x, p3.y - p1.y);
          const d24 = Math.hypot(p4.x - p2.x, p4.y - p2.y);
          if (Math.abs(d13 - a * Math.SQRT2) < TOL && Math.abs(d24 - a * Math.SQRT2) < TOL) {
            const fk = [v1k, v2k, v3k, v4k].sort().join('|');
            if (faceKeySet.has(fk)) continue;
            const pts = [[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]];
            if (inBounds(pts)) { faceKeySet.add(fk); faces.push({ type: 'sq', vertexKeys: [v1k, v2k, v3k, v4k], vertices: sortPolygon(pts) }); }
          }
        }
      }
    }
  }

  // 建邻居
  for (let i = 0; i < faces.length; i++) faces[i].id = i;
  const vertex2faces = new Map();
  for (const face of faces) {
    for (const [vx, vy] of face.vertices) {
      const key = vKey(vx, vy);
      if (!vertex2faces.has(key)) vertex2faces.set(key, new Set());
      vertex2faces.get(key).add(face.id);
    }
  }
  const neighbors = new Array(faces.length).fill(null).map(() => new Set());
  for (const fids of vertex2faces.values()) {
    const ids = [...fids];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        neighbors[ids[i]].add(ids[j]);
        neighbors[ids[j]].add(ids[i]);
      }
  }

  return { faces, vertex2faces, neighbors };
}

// 构建一次，供所有测试复用
const { faces, vertex2faces, neighbors } = buildTiling();
const triCount = faces.filter(f => f.type === 'tri').length;
const sqCount = faces.filter(f => f.type === 'sq').length;

function isFaceInternal(face) {
  return face.vertices.every(([x, y]) => {
    const fids = vertex2faces.get(vKey(x, y));
    return fids && fids.size === 5;
  });
}

describe('Snub Square Tiling 几何验证', () => {
  test('三角形/正方形数量比应为 2:1', () => {
    const ratio = triCount / sqCount;
    assert.ok(
      Math.abs(ratio - 2.0) < 0.1,
      `三角形/正方形比 = ${ratio.toFixed(4)}，期望 ≈ 2.0`
    );
  });

  test('所有 5 度顶点周围恰好 3 三角形 + 2 正方形', () => {
    for (const [, fids] of vertex2faces) {
      if (fids.size !== 5) continue;
      const types = [...fids].map(id => faces[id].type);
      const triN = types.filter(t => t === 'tri').length;
      const sqN = types.filter(t => t === 'sq').length;
      assert.equal(triN, 3, `5度顶点应有 3 个三角形，实际 ${triN}`);
      assert.equal(sqN, 2, `5度顶点应有 2 个正方形，实际 ${sqN}`);
    }
  });

  test('内部正方形邻居数 = 12', () => {
    const internalSqs = faces.filter(f => f.type === 'sq' && isFaceInternal(f));
    assert.ok(internalSqs.length > 0, '应有内部正方形');
    for (const face of internalSqs) {
      const nb = neighbors[face.id].size;
      assert.equal(nb, 12, `内部正方形邻居数 = ${nb}，期望 12`);
    }
  });

  test('内部三角形邻居数 = 9', () => {
    const internalTris = faces.filter(f => f.type === 'tri' && isFaceInternal(f));
    assert.ok(internalTris.length > 0, '应有内部三角形');
    for (const face of internalTris) {
      const nb = neighbors[face.id].size;
      assert.equal(nb, 9, `内部三角形邻居数 = ${nb}，期望 9`);
    }
  });

  test('所有面的边长误差 < 0.01%', () => {
    for (const face of faces) {
      const n = face.vertices.length;
      for (let i = 0; i < n; i++) {
        const [x1, y1] = face.vertices[i];
        const [x2, y2] = face.vertices[(i + 1) % n];
        const d = Math.hypot(x2 - x1, y2 - y1);
        assert.ok(
          Math.abs(d - a) < TOL * 100,
          `边长 ${d.toFixed(8)} 应 ≈ ${a}`
        );
      }
    }
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
node --test tests/unit/snub-square.test.js
```
期望：5 个 test 全部 pass。

- [ ] **Step 3: 提交**

```bash
git add tests/unit/snub-square.test.js
git commit -m "test: 添加 Snub Square 几何验证单元测试"
```

---

## Chunk 3: E2E 测试 + Playwright 配置

### Task 7: 创建 Playwright 配置文件

**Files:**
- Create: `playwright.config.js`

- [ ] **Step 1: 创建 playwright.config.js**

```js
// playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:8000',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 8000',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
  timeout: 30000,
});
```

---

### Task 8: 创建 E2E 测试

**Files:**
- Create: `tests/e2e/game.test.js`

- [ ] **Step 1: 创建 tests/e2e/game.test.js**

```js
// tests/e2e/game.test.js
const { test, expect } = require('@playwright/test');

test.describe('页面基础', () => {
  test('标题含"多边形扫雷"', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/多边形扫雷/);
  });

  test('canvas 棋盘元素存在', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test('无 JS 控制台错误', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});

test.describe('形状切换', () => {
  const shapes = [
    { sides: 3, label: '三角形' },
    { sides: 4, label: '正方形' },
    { sides: 5, label: 'Cairo五边形' },
    { sides: 6, label: '六边形' },
    { sides: 8, label: '八边形+正方形' },
    { sides: 34, label: 'Snub Square' },
    { sides: 36, label: 'Kagome' },
  ];

  for (const { sides, label } of shapes) {
    test(`切换到 ${label}(sides=${sides}) 无报错`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('/');
      const btn = page.locator(`[data-sides="${sides}"]`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(300);
      }
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe('难度切换', () => {
  const difficulties = ['easy', 'medium', 'hard', 'hell'];

  for (const diff of difficulties) {
    test(`切换难度 ${diff} 按钮高亮`, async ({ page }) => {
      await page.goto('/');
      const btn = page.locator(`[data-diff="${diff}"]`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(200);
        // 按钮应有 selected 或 active 类
        const cls = await btn.getAttribute('class');
        expect(cls).toMatch(/selected|active/);
      }
    });
  }
});

test.describe('游戏交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 选正方形 + easy 难度
    const squareBtn = page.locator('[data-sides="4"]');
    if (await squareBtn.count() > 0) await squareBtn.click();
    const easyBtn = page.locator('[data-diff="easy"]');
    if (await easyBtn.count() > 0) await easyBtn.click();
    // 点击"开始"按钮（如存在）
    const startBtn = page.locator('button').filter({ hasText: /开始/ });
    if (await startBtn.count() > 0) await startBtn.click();
    await page.waitForTimeout(500);
  });

  test('canvas 存在且可见', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('右键点击 canvas 触发开格（无 JS 错误）', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const canvas = page.locator('canvas').first();
    await canvas.click({ button: 'right', position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
  });

  test('左键点击 canvas 触发标旗（无 JS 错误）', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const canvas = page.locator('canvas').first();
    // 首次右键开格，再左键标旗
    await canvas.click({ button: 'right', position: { x: 50, y: 50 } });
    await page.waitForTimeout(200);
    await canvas.click({ button: 'left', position: { x: 100, y: 100 } });
    await page.waitForTimeout(200);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 安装 Playwright 浏览器（若未安装）**

```bash
npx playwright install chromium
```

- [ ] **Step 3: 运行 E2E 测试**

```bash
npm run test:e2e
```
期望：所有测试通过（需要 python3 -m http.server 8000 可用）。

- [ ] **Step 4: 提交**

```bash
git add playwright.config.js tests/e2e/game.test.js
git commit -m "test: 添加 Playwright E2E 测试（形状切换、难度、交互）"
```

---

## Chunk 4: 清理临时文件

### Task 9: 删除 11 个临时文件

**Files:**
- Delete: 以下 11 个文件

- [ ] **Step 1: 删除所有临时测试文件**

```bash
git rm test-game.js test-complete-game.js test-full-load.js \
       test-game-simulation.js test-renderer.js test_snub_square.js \
       test-api.html test-browser.html test-canvas.html \
       test-main-game.html test-renderer.html
```

- [ ] **Step 2: 提交删除**

```bash
git commit -m "chore: 删除临时测试文件，以正式测试替代"
```

---

## 运行方式汇总

```bash
# 单元测试
npm test
# 或
npm run test:unit

# E2E 测试（playwright 会自动启动 http.server）
npm run test:e2e

# 语法检查
node --check tests/helpers/mock-dom.js tests/helpers/load-scripts.js
```
