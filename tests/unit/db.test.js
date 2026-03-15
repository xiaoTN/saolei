'use strict';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// 每个 test 用独立内存数据库，避免状态共享
function createDb() {
    // 清除模块缓存，确保每个测试拿到全新的模块实例
    delete require.cache[require.resolve('../../server/db')];
    const Database = require('better-sqlite3');
    const sqlite = new Database(':memory:');
    const db = require('../../server/db');
    db._initWithDb(sqlite);
    return { db, sqlite };
}

describe('db.saveMatch 参数校验', () => {
    let db, sqlite;
    afterEach(() => { if (sqlite) { sqlite.close(); sqlite = null; } });

    test('duration_seconds 为负数时打印警告并仍可写入', () => {
        ({ db, sqlite } = createDb());
        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));
        db.saveMatch({
            room_code: 'ZZZZ', board_type: '4', difficulty: 'easy',
            rows: 9, cols: 9, mines: 10, winner: 'host',
            duration_seconds: -1, loser_revealed: 0,
            first_click_at: Date.now(),
        });
        console.warn = origWarn;
        assert.ok(warnings.some(w => w.includes('duration')), '应有 duration 警告日志');
        const rows = db.getLeaderboard({ board_type: '4', difficulty: 'easy', limit: 5 });
        assert.equal(rows.length, 1);
    });
});

describe('db.saveMatch', () => {
    let db, sqlite;

    afterEach(() => { if (sqlite) { sqlite.close(); sqlite = null; } });

    test('写入一条记录后可查询到', () => {
        ({ db, sqlite } = createDb());
        db.saveMatch({
            room_code: 'ABCD',
            board_type: '6',
            difficulty: 'hard',
            rows: 20,
            cols: 20,
            mines: 84,
            winner: 'host',
            duration_seconds: 137,
            loser_revealed: 42,
            first_click_at: Date.now() - 137000,
        });
        const rows = db.getLeaderboard({ board_type: '6', difficulty: 'hard', limit: 10 });
        assert.equal(rows.length, 1);
        assert.equal(rows[0].room_code, 'ABCD');
        assert.equal(rows[0].winner, 'host');
        assert.equal(rows[0].loser_revealed, 42);
    });

    test('多次调用 saveMatch 均可成功写入', () => {
        ({ db, sqlite } = createDb());
        db.saveMatch({ room_code: 'AA11', board_type: '4', difficulty: 'easy', rows: 9, cols: 9, mines: 10, winner: 'guest', duration_seconds: 60, loser_revealed: 5, first_click_at: Date.now() - 60000 });
        db.saveMatch({ room_code: 'BB22', board_type: '4', difficulty: 'easy', rows: 9, cols: 9, mines: 10, winner: 'host',  duration_seconds: 90, loser_revealed: 8, first_click_at: Date.now() - 90000 });
        const rows = db.getLeaderboard({ board_type: '4', difficulty: 'easy', limit: 10 });
        assert.equal(rows.length, 2);
    });

    test('getLeaderboard 按 duration_seconds 升序排列', () => {
        ({ db, sqlite } = createDb());
        const base = { room_code: 'XX99', board_type: '6', difficulty: 'hard', rows: 20, cols: 20, mines: 84, winner: 'host', loser_revealed: 10, first_click_at: Date.now() - 200000 };
        db.saveMatch({ ...base, room_code: 'CC33', duration_seconds: 200 });
        db.saveMatch({ ...base, room_code: 'DD44', duration_seconds: 50  });
        db.saveMatch({ ...base, room_code: 'EE55', duration_seconds: 120 });
        const rows = db.getLeaderboard({ board_type: '6', difficulty: 'hard', limit: 10 });
        assert.equal(rows[0].duration_seconds, 50);
        assert.equal(rows[1].duration_seconds, 120);
        assert.equal(rows[2].duration_seconds, 200);
    });
});
