// tests/unit/renderer.test.js
// renderer.js 集成测试
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, makeGameGlobals } = require('../helpers/load-scripts');

function loadRenderer(overrides = {}) {
  return loadScripts(
    ['geometry.js', 'renderer.js'],
    makeGameGlobals(overrides)
  );
}

function makeBoardEl() {
  return { appendChild: () => {} };
}

// ─────────────────────────────────────────────
// createSVGBoard
// ─────────────────────────────────────────────
describe('createSVGBoard', () => {
  test('正方形棋盘（sides=4）创建不抛出异常', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const { width, height } = ctx.getBoardSize(4);
    assert.doesNotThrow(() => ctx.createSVGBoard(makeBoardEl(), width, height));
  });

  const allSides = [3, 4, 5, 6, 8, 34, 36];
  for (const s of allSides) {
    test(`sides=${s} 棋盘创建不抛出异常`, () => {
      const ctx = loadRenderer({ sides: s, rows: 8, cols: 8 });
      const { width, height } = ctx.getBoardSize(s);
      assert.doesNotThrow(() => ctx.createSVGBoard(makeBoardEl(), width, height));
    });
  }

  test('多次调用 createSVGBoard 不抛出异常（状态重置）', () => {
    const ctx = loadRenderer({ sides: 4, rows: 5, cols: 5 });
    const { width, height } = ctx.getBoardSize(4);
    assert.doesNotThrow(() => {
      ctx.createSVGBoard(makeBoardEl(), width, height);
      ctx.createSVGBoard(makeBoardEl(), width, height);
      ctx.createSVGBoard(makeBoardEl(), width, height);
    });
  });
});

// ─────────────────────────────────────────────
// getSVGCell
// ─────────────────────────────────────────────
describe('getSVGCell', () => {
  test('createSVGBoard 后 getSVGCell(0,0) 返回非 null', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    const cell = ctx.getSVGCell(0, 0);
    assert.ok(cell !== null && cell !== undefined, 'getSVGCell(0,0) 应返回有效格子');
  });

  test('返回的格子对象包含 row、col、key 字段', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    const cell = ctx.getSVGCell(2, 3);
    assert.ok(cell !== null && cell !== undefined, '格子应存在');
    assert.strictEqual(cell.row, 2, 'row 字段应为 2');
    assert.strictEqual(cell.col, 3, 'col 字段应为 3');
    assert.strictEqual(cell.key, '2,3', 'key 字段应为 "2,3"');
  });

  test('越界坐标 getSVGCell 返回 null', () => {
    const ctx = loadRenderer({ sides: 4, rows: 5, cols: 5 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    const cell = ctx.getSVGCell(999, 999);
    assert.ok(cell == null, '越界坐标应返回 null/undefined');
  });

  test('未调用 createSVGBoard 时 getSVGCell 返回 null', () => {
    const ctx = loadRenderer({ sides: 4, rows: 5, cols: 5 });
    const cell = ctx.getSVGCell(0, 0);
    assert.ok(cell == null, '未初始化时应返回 null');
  });

  test('负坐标 getSVGCell 返回 null', () => {
    const ctx = loadRenderer({ sides: 4, rows: 5, cols: 5 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    assert.ok(ctx.getSVGCell(-1, 0) == null, '负行坐标应返回 null');
    assert.ok(ctx.getSVGCell(0, -1) == null, '负列坐标应返回 null');
  });
});

// ─────────────────────────────────────────────
// setCellState
// ─────────────────────────────────────────────
describe('setCellState', () => {
  test('setCellState 四种状态均不抛出异常', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);

    const cases = [
      [0, 0, 'revealed', 3],
      [1, 1, 'flagged'],
      [2, 2, 'mine'],
      [3, 3, 'normal'],
    ];
    for (const args of cases) {
      assert.doesNotThrow(
        () => ctx.setCellState(...args),
        `setCellState(${args.join(',')}) 不应抛出异常`
      );
    }
  });

  test('setCellState revealed 状态 value=0 不抛出异常', () => {
    const ctx = loadRenderer({ sides: 4, rows: 10, cols: 10 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    assert.doesNotThrow(() => ctx.setCellState(0, 0, 'revealed', 0));
  });

  test('setCellState 越界坐标静默忽略（不抛出）', () => {
    const ctx = loadRenderer({ sides: 4, rows: 5, cols: 5 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    assert.doesNotThrow(() => ctx.setCellState(999, 999, 'revealed', 1));
  });

  test('大量更新（1000次）不抛出异常', () => {
    const ctx = loadRenderer({ sides: 4, rows: 20, cols: 20 });
    const { width, height } = ctx.getBoardSize(4);
    ctx.createSVGBoard(makeBoardEl(), width, height);

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

  test('sides=6（六边形）setCellState 不抛出异常', () => {
    const ctx = loadRenderer({ sides: 6, rows: 8, cols: 8 });
    const { width, height } = ctx.getBoardSize(6);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    assert.doesNotThrow(() => ctx.setCellState(0, 0, 'revealed', 2));
    assert.doesNotThrow(() => ctx.setCellState(0, 0, 'flagged'));
    assert.doesNotThrow(() => ctx.setCellState(0, 0, 'mine'));
    assert.doesNotThrow(() => ctx.setCellState(0, 0, 'normal'));
  });

  test('sides=3（三角形）setCellState 不抛出异常', () => {
    const ctx = loadRenderer({ sides: 3, rows: 8, cols: 8 });
    const { width, height } = ctx.getBoardSize(3);
    ctx.createSVGBoard(makeBoardEl(), width, height);
    assert.doesNotThrow(() => ctx.setCellState(0, 0, 'mine'));
    assert.doesNotThrow(() => ctx.setCellState(0, 0, 'normal'));
  });
});
