// renderer.js
// SVG 棋盘的创建与格子状态更新
// 依赖：geometry.js（getCellVertices）
//       game.js 中的全局变量：sides, rows, cols, revealed, flagged, gameOver, NUM_COLORS

const SVG_NS = 'http://www.w3.org/2000/svg';
let cellDomMap = Object.create(null);

// 创建整个 SVG 棋盘，挂载到 boardEl
function createSVGBoard(boardEl, width, height, allCells = null) {
    cellDomMap = Object.create(null);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.display = 'block';

    svg.appendChild(_buildDefs());
    _attachSVGDelegatedEvents(svg);

    const frag = document.createDocumentFragment();
    for (const [i, j] of (allCells || getAllCells(sides))) {
        frag.appendChild(_buildCell(i, j));
    }
    svg.appendChild(frag);

    boardEl.appendChild(svg);
}

// 构建 SVG <defs>（渐变）
function _buildDefs() {
    const defs = document.createElementNS(SVG_NS, 'defs');
    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', 'cell-grad');
    grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '100%');

    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#3a3a5c');

    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#2a2a4c');

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    return defs;
}

// 构建单个格子的 <g> 元素
function _buildCell(row, col) {
    const key = `${row},${col}`;
    const verts = getCellVertices(sides, row, col);
    const [cx, cy] = _getCenterFromVerts(verts);
    const pts = verts.map(v => `${v[0].toFixed(2)},${v[1].toFixed(2)}`).join(' ');

    // 扩展网格中的辅助连接格（8+4 的小正方形）使用更小字号
    const isSmallCell = (sides === 8 && row % 2 === 1);
    const fontSize = isSmallCell ? 8 : (sides === 3 ? 11 : 13);

    const g = document.createElementNS(SVG_NS, 'g');
    g.dataset.row = row;
    g.dataset.col = col;
    g.style.cursor = 'pointer';

    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'url(#cell-grad)');
    poly.setAttribute('stroke', '#0f0f23');
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-linejoin', 'round');
    g.appendChild(poly);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', cx.toFixed(2));
    text.setAttribute('y', (cy + fontSize * 0.4).toFixed(2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', fontSize);
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    text.setAttribute('pointer-events', 'none');
    text.setAttribute('fill', 'none');
    g.appendChild(text);

    const cellMeta = { key, row, col, g, poly, text };
    cellDomMap[key] = cellMeta;
    g._cellMeta = cellMeta;

    return g;
}

function _getCenterFromVerts(verts) {
    let x = 0, y = 0;
    for (const [vx, vy] of verts) {
        x += vx;
        y += vy;
    }
    return [x / verts.length, y / verts.length];
}

function _attachSVGDelegatedEvents(svg) {
    svg.addEventListener('mouseover', e => {
        const cell = _getCellFromEventTarget(e.target);
        if (!cell) return;
        if (e.relatedTarget && cell.g.contains(e.relatedTarget)) return;
        if (!revealed[cell.key] && !gameOver) {
            cell.poly.setAttribute('fill', flagged[cell.key] ? '#3a1a4c' : '#4a4a7c');
        }
    });

    svg.addEventListener('mouseout', e => {
        const cell = _getCellFromEventTarget(e.target);
        if (!cell) return;
        if (e.relatedTarget && cell.g.contains(e.relatedTarget)) return;
        if (!revealed[cell.key]) {
            cell.poly.setAttribute('fill', flagged[cell.key] ? '#2a1a3c' : 'url(#cell-grad)');
        }
    });

    svg.addEventListener('click', e => {
        const cell = _getCellFromEventTarget(e.target);
        if (!cell) return;
        handleClick(cell.row, cell.col);
    });

    svg.addEventListener('contextmenu', e => {
        const cell = _getCellFromEventTarget(e.target);
        if (!cell) return;
        handleRightClick(e, cell.row, cell.col);
    });

    svg.addEventListener('touchstart', e => {
        const cell = _getCellFromEventTarget(e.target);
        if (!cell) return;
        handleTouchStart(e, cell.row, cell.col);
    }, { passive: false });

    svg.addEventListener('touchend', e => {
        const cell = _getCellFromEventTarget(e.target);
        if (!cell) return;
        handleTouchEnd(e, cell.row, cell.col);
    }, { passive: false });

    svg.addEventListener('touchcancel', e => {
        const cell = _getCellFromEventTarget(e.target);
        if (!cell) return;
        handleTouchCancel(cell.row, cell.col);
    });
}

function _getCellFromEventTarget(target) {
    if (!(target instanceof Element)) return null;
    const g = target.closest('g[data-row][data-col]');
    if (!g) return null;
    return g._cellMeta || null;
}

// 查找格子的 SVG <g> 元素
function getSVGCell(row, col) {
    return cellDomMap[`${row},${col}`]?.g || null;
}

// 更新格子的视觉状态
// state: 'normal' | 'revealed' | 'flagged' | 'mine'
// value: 数字（仅 revealed 状态使用）
function setCellState(row, col, state, value = '') {
    const dom = cellDomMap[`${row},${col}`];
    if (!dom) return;
    const { poly, text } = dom;

    switch (state) {
        case 'normal':
            poly.setAttribute('fill', 'url(#cell-grad)');
            text.textContent = '';
            text.setAttribute('fill', 'none');
            break;
        case 'revealed':
            poly.setAttribute('fill', '#1a1a2e');
            if (value > 0) {
                text.textContent = value;
                text.setAttribute('fill', NUM_COLORS[value] || '#fff');
            } else {
                text.textContent = '';
                text.setAttribute('fill', 'none');
            }
            break;
        case 'flagged':
            poly.setAttribute('fill', '#2a1a3c');
            text.textContent = '🚩';
            text.setAttribute('fill', '#ff6b6b');
            break;
        case 'mine':
            poly.setAttribute('fill', '#ff4757');
            text.textContent = '💣';
            text.setAttribute('fill', '#fff');
            break;
    }
}
