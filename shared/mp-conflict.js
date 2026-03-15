// shared/mp-conflict.js
// 联机竞点冲突检测模块（纯逻辑，无 DOM 依赖）
//
// 职责：记录本端最近的 reveal 操作时间戳，
//       当对方的 reveal 消息到达时，判断是否与本端同格竞点。

const MpConflict = (() => {
    const _recentLocalReveals = {}; // key → timestamp
    const WINDOW_MS = 1000;         // 冲突判定时间窗口（毫秒）

    /**
     * 记录本端点击了某格（在发出 reveal 消息前调用）
     * @param {string} key  格子坐标字符串，如 "2,3"
     */
    function recordLocalReveal(key) {
        _recentLocalReveals[key] = Date.now();
    }

    /**
     * 检测对方 reveal 是否与本端竞点
     * @param {string}   key     格子坐标字符串
     * @param {function} notify  冲突时的通知回调 (message: string) => void
     * @returns {boolean} 是否检测到竞点冲突
     */
    function detectConflict(key, notify) {
        const ts = _recentLocalReveals[key];
        if (ts && Date.now() - ts < WINDOW_MS) {
            delete _recentLocalReveals[key];
            notify('对方抢先一步！');
            return true;
        }
        return false;
    }

    /**
     * 清空所有记录（游戏重置时调用）
     */
    function clear() {
        for (const k in _recentLocalReveals) delete _recentLocalReveals[k];
    }

    return { recordLocalReveal, detectConflict, clear, WINDOW_MS };
})();

// 浏览器环境：挂到 window
if (typeof window !== 'undefined') {
    window.MpConflict = MpConflict;
}

// Node 环境（单元测试）：CommonJS 导出
if (typeof module !== 'undefined') {
    module.exports = MpConflict;
}
