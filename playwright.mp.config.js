// playwright.mp.config.js
// 联机模式 E2E 测试专用 Playwright 配置
// 使用独立端口 8766 启动 server.js，避免与开发服务器（8765）冲突
const { defineConfig } = require('@playwright/test');

const TEST_PORT = process.env.MP_E2E_PORT || 8766;

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/mp-click-conflict.test.js',
  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`,
    headless: true,
  },
  webServer: {
    command: `PORT=${TEST_PORT} node server.js`,
    url: `http://127.0.0.1:${TEST_PORT}`,
    reuseExistingServer: false,   // 始终启动独立测试服务器
    timeout: 10000,
  },
  timeout: 30000,
  workers: 1,   // 联机测试顺序执行，避免端口/房间冲突
});
