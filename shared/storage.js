// shared/storage.js
// 存储抽象层：Web 用 localStorage，App 用 Preferences + SQLite

const StorageAdapter = {
    _ready: false,
    _preferences: null,
    _sqlite: null,
    _db: null,

    async init() {
        if (window.Platform && window.Platform.isApp) {
            // App 端初始化（后续 Task 实现）
            // 暂时 fallback 到 localStorage
            this._ready = true;
        } else {
            // Web 端：直接使用 localStorage
            this._ready = true;
        }
    },

    // === 设置存储 ===
    async saveSettings(settings) {
        if (!this._ready) return;
        try {
            const data = JSON.stringify(settings);
            localStorage.setItem('saolei_settings', data);
        } catch (e) {
            console.error('saveSettings failed:', e);
        }
    },

    async loadSettings() {
        if (!this._ready) return null;
        try {
            const data = localStorage.getItem('saolei_settings');
            return data ? JSON.parse(data) : null;
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
            localStorage.setItem('saolei_stats', data);
        } catch (e) {
            console.error('saveStats failed:', e);
        }
    },

    async loadStats() {
        if (!this._ready) return null;
        try {
            const data = localStorage.getItem('saolei_stats');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('loadStats failed:', e);
            return null;
        }
    },

    // === 对局记录 ===
    // Web 端只保留最近 20 局
    async saveGameRecord(record) {
        if (!this._ready) return;
        try {
            const data = localStorage.getItem('saolei_history');
            let history = data ? JSON.parse(data) : [];
            history.unshift(record);
            if (history.length > 20) history = history.slice(0, 20);
            localStorage.setItem('saolei_history', JSON.stringify(history));
        } catch (e) {
            console.error('saveGameRecord failed:', e);
        }
    },

    async loadGameHistory(limit = 20, offset = 0) {
        if (!this._ready) return [];
        try {
            const data = localStorage.getItem('saolei_history');
            const history = data ? JSON.parse(data) : [];
            return history.slice(offset, offset + limit);
        } catch (e) {
            console.error('loadGameHistory failed:', e);
            return [];
        }
    },

    async deleteGameHistory() {
        try {
            localStorage.removeItem('saolei_history');
        } catch (e) {
            console.error('deleteGameHistory failed:', e);
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.StorageAdapter = StorageAdapter;
}
