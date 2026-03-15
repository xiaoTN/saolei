'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'saolei.db');

let _db = null;

function _getDb() {
    if (!_db) {
        _db = new Database(DB_PATH);
        _initSchema(_db);
    }
    return _db;
}

// 测试专用：注入外部 db 实例（内存数据库）
function _initWithDb(sqlite) {
    _db = sqlite;
    _initSchema(_db);
}

function _initSchema(sqlite) {
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS matches (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code        TEXT NOT NULL,
            board_type       TEXT NOT NULL,
            difficulty       TEXT NOT NULL,
            rows             INTEGER NOT NULL,
            cols             INTEGER NOT NULL,
            mines            INTEGER NOT NULL,
            winner           TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL,
            loser_revealed   INTEGER NOT NULL,
            first_click_at   INTEGER NOT NULL,
            host_user_id     TEXT,
            guest_user_id    TEXT,
            played_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_board_difficulty
            ON matches (board_type, difficulty, duration_seconds);
    `);
}

function init() {
    _getDb();
}

function saveMatch(match) {
    if (match.duration_seconds < 0) {
        console.warn(`[db] saveMatch: 异常 duration_seconds=${match.duration_seconds}，room=${match.room_code}`);
    }
    const db = _getDb();
    const stmt = db.prepare(`
        INSERT INTO matches
            (room_code, board_type, difficulty, rows, cols, mines,
             winner, duration_seconds, loser_revealed, first_click_at)
        VALUES
            (@room_code, @board_type, @difficulty, @rows, @cols, @mines,
             @winner, @duration_seconds, @loser_revealed, @first_click_at)
    `);
    stmt.run(match);
}

function getLeaderboard({ board_type, difficulty, limit = 20 } = {}) {
    const db = _getDb();
    const stmt = db.prepare(`
        SELECT * FROM matches
        WHERE board_type = @board_type AND difficulty = @difficulty
        ORDER BY duration_seconds ASC
        LIMIT @limit
    `);
    return stmt.all({ board_type, difficulty, limit });
}

module.exports = { init, saveMatch, getLeaderboard, _initWithDb };
