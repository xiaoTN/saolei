// shared/platform.js
// 平台检测模块：区分 Web 和 App 环境

const Platform = {
    isApp: false,
    isWeb: true,
    isAndroid: false,
    isIOS: false
};

// Capacitor 启动后会注入 window.Capacitor
if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    Platform.isApp = true;
    Platform.isWeb = false;
    Platform.isAndroid = window.Capacitor.getPlatform() === 'android';
    Platform.isIOS = window.Capacitor.getPlatform() === 'ios';
}

// 导出到全局（兼容现有非模块化代码）
if (typeof window !== 'undefined') {
    window.Platform = Platform;
}
