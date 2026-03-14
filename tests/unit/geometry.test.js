// tests/unit/geometry.test.js
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('../helpers/load-scripts');

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
    const verts = ctx.getCellVertices(4, 0, 0);
    assert.equal(verts.length, 4, '正方形应有 4 个顶点');
  });

  test('三角形(sides=3) 返回 3 个顶点', () => {
    const ctx = loadGeometry({ sides: 3, rows: 10, cols: 10, cellSize: 40 });
    const verts = ctx.getCellVertices(3, 0, 0);
    assert.equal(verts.length, 3, '三角形应有 3 个顶点');
  });

  test('六边形(sides=6) 返回 6 个顶点', () => {
    const ctx = loadGeometry({ sides: 6, rows: 10, cols: 10, cellSize: 40 });
    const verts = ctx.getCellVertices(6, 0, 0);
    assert.equal(verts.length, 6, '六边形应有 6 个顶点');
  });

  test('顶点均为 [x, y] 数字对', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const verts = ctx.getCellVertices(4, 2, 3);
    for (const [x, y] of verts) {
      assert.equal(typeof x, 'number', 'x 应为数字');
      assert.equal(typeof y, 'number', 'y 应为数字');
    }
  });
});

describe('getNeighbors', () => {
  test('正方形内部格有 8 个邻居', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(4, 5, 5);
    assert.equal(neighbors.length, 8, '内部格应有 8 个邻居');
  });

  test('正方形角格邻居数 <= 3', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(4, 0, 0);
    assert.ok(neighbors.length <= 3, `角格邻居数=${neighbors.length} 应 <= 3`);
  });

  test('六边形内部格有 6 个邻居', () => {
    const ctx = loadGeometry({ sides: 6, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(6, 5, 5);
    assert.equal(neighbors.length, 6, '六边形内部格应有 6 个邻居');
  });

  test('返回值为数组', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const neighbors = ctx.getNeighbors(4, 5, 5);
    assert.ok(Array.isArray(neighbors), '邻居应为数组');
  });
});

describe('getAllCells', () => {
  test('正方形 10x10 返回 100 个格子', () => {
    const ctx = loadGeometry({ sides: 4, rows: 10, cols: 10, cellSize: 40 });
    const cells = ctx.getAllCells(4);
    assert.equal(cells.length, 100);
  });

  test('三角形 10x10 返回 200 个格子', () => {
    const ctx = loadGeometry({ sides: 3, rows: 10, cols: 10, cellSize: 40 });
    const cells = ctx.getAllCells(3);
    assert.equal(cells.length, 200);
  });
});
