// shared/storage.js
// 存储抽象层：Web 用 localStorage，App 用 Preferences + SQLite

const StorageAdapter = {
    _ready: false,
    _preferences: null,
    _sqlite: null,
    _db: null,
    _isApp: false,

    async init() {
        this._isApp = window.Platform && window.Platform.isApp;

        if (this._isApp) {
            try {
                // 动态加载 Capacitor 插件
                const prefModule = await import('@capacitor/preferences');
                this._preferences = prefModule.Preferences;

                const sqliteModule = await import('@capacitor-community/sqlite');
                this._sqlite = sqliteModule.CapacitorSQLite;

                // 初始化数据库
                await this._sqlite.createConnection({
                    database: 'saolei_db',
                    version: 1
                });
                await this._sqlite.open({ database: 'saolei_db' });

                // 创建表
                await this._sqlite.execute({
                    database: 'saolei_db',
                    statements: `
                        CREATE TABLE IF NOT EXISTS game_records (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            board_type TEXT,
                            rows INTEGER,
                            cols INTEGER,
                            mines INTEGER,
                            result TEXT,
                            duration_seconds INTEGER,
                            revealed_count INTEGER,
                            flagged_count INTEGER,
                            played_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                    `
                });

                console.log('SQLite initialized');
            } catch (e) {
                console.warn('SQLite init failed, fallback to localStorage:', e);
            }
        }
        this._ready = true;
    },

    // === 设置存储 ===
    async saveSettings(settings) {
        if (!this._ready) return;
        try {
            const data = JSON.stringify(settings);
            if (this._isApp && this._preferences) {
                await this._preferences.set({ key: 'saolei_settings', value: data });
            } else {
                localStorage.setItem('saolei_settings', data);
            }
        } catch (e) {
            console.error('saveSettings failed:', e);
        }
    },

    async loadSettings() {
        if (!this._ready) return null;
        try {
            if (this._isApp && this._preferences) {
                const { value } = await this._preferences.get({ key: 'saolei_settings' });
                return value ? JSON.parse(value) : null;
            } else {
                const data = localStorage.getItem('saolei_settings');
                return data ? JSON.parse(data) : null;
            }
        } catch (e) {
            console.error('loadSettings failed:', e);
            return null;
        }
    },

    // === 统计数据 ===
    async saveStats(stats) {
        if (!this._ready) return;
        try {
            const data = JSON.stringify(stats);
            if (this._isApp && this._preferences) {
                await this._preferences.set({ key: 'saolei_stats', value: data });
            } else {
                localStorage.setItem('saolei_stats', data);
            }
        } catch (e) {
            console.error('saveStats failed:', e);
        }
    },

    async loadStats() {
        if (!this._ready) return null;
        try {
            if (this._isApp && this._preferences) {
                const { value } = await this._preferences.get({ key: 'saolei_stats' });
                return value ? JSON.parse(value) : null;
            } else {
                const data = localStorage.getItem('saolei_stats');
                return data ? JSON.parse(data) : null;
            }
        } catch (e) {
            console.error('loadStats failed:', e);
            return null;
        }
    },

    // === 对局记录 ===
    async saveGameRecord(record) {
        if (!this._ready) return;
        try {
            if (this._isApp && this._sqlite) {
                await this._sqlite.run({
                    database: 'saolei_db',
                    statement: `
                        INSERT INTO game_records
                        (board_type, rows, cols, mines, result, duration_seconds, revealed_count, flagged_count)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    values: [
                        record.boardType,
                        record.rows,
                        record.cols,
                        record.mines,
                        record.result,
                        record.durationSeconds,
                        record.revealedCount,
                        record.flaggedCount
                    ]
                });
            } else {
                // Web 端：只保留最近 20 局
                const data = localStorage.getItem('saolei_history');
                let history = data ? JSON.parse(data) : [];
                history.unshift(record);
                if (history.length > 20) history = history.slice(0, 20);
                localStorage.setItem('saolei_history', JSON.stringify(history));
            }
        } catch (e) {
            console.error('saveGameRecord failed:', e);
        }
    },

    async loadGameHistory(limit = 20, offset = 0) {
        if (!this._ready) return [];
        try {
            if (this._isApp && this._sqlite) {
                const result = await this._sqlite.query({
                    database: 'saolei_db',
                    statement: `
                        SELECT * FROM game_records
                        ORDER BY played_at DESC
                        LIMIT ? OFFSET ?
                    `,
                    values: [limit, offset]
                });
                return result.values || [];
            } else {
                const data = localStorage.getItem('saolei_history');
                const history = data ? JSON.parse(data) : [];
                return history.slice(offset, offset + limit);
            }
        } catch (e) {
            console.error('loadGameHistory failed:', e);
            return [];
        }
    },

    async deleteGameHistory() {
        try {
            if (this._isApp && this._sqlite) {
                await this._sqlite.execute({
                    database: 'saolei_db',
                    statements: 'DELETE FROM game_records'
                });
            } else {
                localStorage.removeItem('saolei_history');
            }
        } catch (e) {
            console.error('deleteGameHistory failed:', e);
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.StorageAdapter = StorageAdapter;
}
