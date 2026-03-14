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
    // 理论比值为 2.0，有限网格存在边界效应，允许 0.4 的偏差
    assert.ok(
      Math.abs(ratio - 2.0) < 0.4,
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
