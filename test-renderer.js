// Simple test for renderer.js
// This simulates a browser environment to test the Canvas renderer

// Mock DOM
global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
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
                addEventListener: () => {}
            };
        }
        return {
            appendChild: () => {}
        };
    }
};

// Mock globals
let sides = 4;
let rows = 100;
let cols = 100;
let cellSize = 40;
let gameOver = false;
let revealed = {};
let flagged = {};
const NUM_COLORS = {
    1: '#4a9eff', 2: '#2ed573', 3: '#ff4757',
    4: '#a55eea', 5: '#ffa502', 6: '#1dd1a1',
    7: '#ff6b81', 8: '#70a1ff',
};

// Mock game functions
function handleClick(row, col) {
    console.log('Click:', row, col);
}
function handleRightClick(e, row, col) {
    console.log('Right click:', row, col);
}
function handleTouchStart(e, row, col) {
    console.log('Touch start:', row, col);
}
function handleTouchEnd(e, row, col) {
    console.log('Touch end:', row, col);
}
function handleTouchCancel(row, col) {
    console.log('Touch cancel:', row, col);
}

// Load geometry.js
const fs = require('fs');
const geometryCode = fs.readFileSync('geometry.js', 'utf-8');
eval(geometryCode);

// Load renderer.js
const rendererCode = fs.readFileSync('renderer.js', 'utf-8');
eval(rendererCode);

// Test
console.log('Testing Canvas renderer...');

const boardEl = { appendChild: () => {} };
const { width, height } = getBoardSize(sides);
console.log('Board size:', width, height);

createSVGBoard(boardEl, width, height);

console.log('Canvas element created');

// Test getSVGCell
const cell = getSVGCell(0, 0);
console.log('Cell 0,0:', !!cell, cell ? 'has key' : 'null');

// Test setCellState
setCellState(0, 0, 'revealed', 1);
setCellState(1, 1, 'flagged');
setCellState(2, 2, 'mine');

console.log('✅ All tests passed!');
