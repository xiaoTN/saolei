// shared/haptics.js
// 震动抽象层：Web 用 navigator.vibrate，App 用 Capacitor Haptics

const HapticsAdapter = {
    _ready: false,
    _haptics: null,

    async init() {
        if (window.Platform && window.Platform.isApp) {
            try {
                // 动态加载 Capacitor Haptics（仅 App 环境）
                const module = await import('../mobile/node_modules/@capacitor/haptics/dist/esm/index.js');
                this._haptics = module.Haptics;
                this._ready = true;
            } catch (e) {
                console.warn('Haptics not available:', e);
            }
        } else {
            this._ready = true;
        }
    },

    // 开格成功 - 短震动
    async light() {
        if (!this._ready) return;
        if (window.Platform && window.Platform.isApp && this._haptics) {
            await this._haptics.impact({ style: 'Light' });
        } else if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    },

    // 标旗 - 轻震
    async tick() {
        if (!this._ready) return;
        if (window.Platform && window.Platform.isApp && this._haptics) {
            await this._haptics.impact({ style: 'Light' });
        } else if (navigator.vibrate) {
            navigator.vibrate(15);
        }
    },

    // 踩雷 - 强震动
    async error() {
        if (!this._ready) return;
        if (window.Platform && window.Platform.isApp && this._haptics) {
            await this._haptics.notification({ type: 'Error' });
        } else if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.HapticsAdapter = HapticsAdapter;
}
