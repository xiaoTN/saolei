// tests/e2e/mp-click-conflict.test.js
// 联机竞点冲突检测 E2E 测试
//
// 架构：
//   - guestPage   — 真实浏览器，加入房间，验证 Toast
//   - hostWs      — Node.js WebSocket 客户端，模拟 host 发送消息
// 这样测试不依赖游戏内部全局变量，只测可观察行为（Toast 的显示与否）
//
// 运行：npm run test:mp-e2e

const { test, expect, chromium } = require('@playwright/test');
const WebSocket = require('ws');

const BASE_URL = process.env.MP_E2E_PORT
    ? `http://127.0.0.1:${process.env.MP_E2E_PORT}`
    : 'http://127.0.0.1:8766';

const WS_URL = BASE_URL.replace('http://', 'ws://');

// ── WebSocket 工具 ────────────────────────────────────────────────

/** 创建 Node.js WebSocket 客户端，等待连接成功 */
function wsConnect() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

/** 发送 JSON 消息 */
function wsSend(ws, data) {
    ws.send(JSON.stringify(data));
}

/**
 * 等待收到特定 type 的消息，返回该消息
 * @param {WebSocket} ws
 * @param {string} type
 * @param {number} timeout
 */
function wsWaitFor(ws, type, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`等待 "${type}" 消息超时`)), timeout);
        ws.on('message', function handler(raw) {
            const msg = JSON.parse(raw);
            if (msg.type === type) {
                clearTimeout(timer);
                ws.off('message', handler);
                resolve(msg);
            }
        });
    });
}

// ── 浏览器工具 ───────────────────────────────────────────────────

async function gotoStart(page) {
    await page.goto(BASE_URL);
    await page.waitForSelector('#startScreen', { timeout: 5000 });
}

/** host WebSocket 创建房间，返回房间码 */
async function hostCreateRoom(hostWs) {
    const codePromise = wsWaitFor(hostWs, 'room-created');
    wsSend(hostWs, { type: 'create', config: { sides: 4, rows: 8, cols: 8 } });
    const msg = await codePromise;
    return msg.code;
}

/** guest 浏览器加入房间，等待进入游戏界面 */
async function guestJoinAndWaitGame(guestPage, hostWs, code) {
    // host WebSocket 等待 partner-joined
    const partnerJoinedPromise = wsWaitFor(hostWs, 'partner-joined');

    // guest 浏览器加入房间
    await guestPage.locator('#joinCodeInput').fill(code);
    await guestPage.locator('.join-btn').click();

    // 等待 host ws 收到 partner-joined
    await partnerJoinedPromise;

    // 等待 guest 页面进入游戏界面
    await guestPage.waitForSelector('#gameScreen', { timeout: 8000 });
    await guestPage.waitForSelector('canvas', { timeout: 5000 });
    await guestPage.waitForTimeout(400);
}

/**
 * host WebSocket 发送 board-init（让 guest 棋盘就绪）
 * 发一个最小有效的 board-init（8x8 正方形，3,3 位置有雷）
 */
async function hostSendBoardInit(hostWs) {
    wsSend(hostWs, {
        type: 'board-init',
        mineLocations: ['0,7', '1,6', '2,5', '3,4', '5,3', '6,2', '7,1', '7,7'],
    });
    await new Promise(r => setTimeout(r, 300));
}

// ── 测试套件 ─────────────────────────────────────────────────────

test.describe('联机竞点冲突检测', () => {
    test.setTimeout(30000);

    test('对方 reveal 同一格（本端 1s 内也点了）→ 显示"抢先"Toast', async () => {
        // 1. 建立 host WebSocket 连接
        const hostWs = await wsConnect();

        // 2. 打开 guest 浏览器
        const browser = await chromium.launch({ headless: true });
        const guestPage = await (await browser.newContext()).newPage();

        try {
            await gotoStart(guestPage);

            // 3. host 创建房间
            const code = await hostCreateRoom(hostWs);
            expect(code).toMatch(/^[A-Z0-9]{4}$/);

            // 4. guest 加入，等待游戏就绪
            await guestJoinAndWaitGame(guestPage, hostWs, code);

            // 5. host 发送 board-init（建立 guest 棋盘）
            await hostSendBoardInit(hostWs);

            // 6. 在 guestPage 中预先记录"本端也点了 3,3"（通过 MpConflict 全局对象）
            const targetKey = '3,3';
            await guestPage.evaluate((key) => {
                window.MpConflict.recordLocalReveal(key);
            }, targetKey);

            // 7. host WebSocket 发送 reveal 消息（模拟对方点了同格）
            wsSend(hostWs, { type: 'reveal', key: targetKey });

            // 8. 验证 guest 页面出现"抢先" Toast
            const toast = guestPage.locator('.toast');
            await expect(toast.first()).toBeVisible({ timeout: 3000 });
            const text = await toast.first().textContent();
            expect(text).toContain('抢先');
        } finally {
            hostWs.close();
            await browser.close();
        }
    });

    test('本端未记录该格 → 对方 reveal 不触发冲突 Toast', async () => {
        const hostWs = await wsConnect();
        const browser = await chromium.launch({ headless: true });
        const guestPage = await (await browser.newContext()).newPage();

        try {
            await gotoStart(guestPage);
            const code = await hostCreateRoom(hostWs);
            await guestJoinAndWaitGame(guestPage, hostWs, code);
            await hostSendBoardInit(hostWs);

            // guest 未预记录任何格子
            wsSend(hostWs, { type: 'reveal', key: '1,1' });
            await guestPage.waitForTimeout(600);

            // 不应出现"抢先" Toast
            const toasts = guestPage.locator('.toast');
            const count = await toasts.count();
            for (let i = 0; i < count; i++) {
                const t = await toasts.nth(i).textContent();
                expect(t).not.toContain('抢先');
            }
        } finally {
            hostWs.close();
            await browser.close();
        }
    });

    test('本端时间戳过期（>1s）后对方 reveal → 不触发冲突', async () => {
        const hostWs = await wsConnect();
        const browser = await chromium.launch({ headless: true });
        const guestPage = await (await browser.newContext()).newPage();

        try {
            await gotoStart(guestPage);
            const code = await hostCreateRoom(hostWs);
            await guestJoinAndWaitGame(guestPage, hostWs, code);
            await hostSendBoardInit(hostWs);

            const targetKey = '4,4';

            // 预记录时间戳
            await guestPage.evaluate((key) => {
                window.MpConflict.recordLocalReveal(key);
            }, targetKey);

            // 等待超过 WINDOW_MS（1000ms）
            await guestPage.waitForTimeout(1100);

            // host reveal（时间戳已过期）
            wsSend(hostWs, { type: 'reveal', key: targetKey });
            await guestPage.waitForTimeout(600);

            // 不应出现"抢先" Toast
            const toasts = guestPage.locator('.toast');
            const count = await toasts.count();
            for (let i = 0; i < count; i++) {
                const t = await toasts.nth(i).textContent();
                expect(t).not.toContain('抢先');
            }
        } finally {
            hostWs.close();
            await browser.close();
        }
    });

    test('冲突触发后清除记录，再次 reveal 同格不重复提示', async () => {
        const hostWs = await wsConnect();
        const browser = await chromium.launch({ headless: true });
        const guestPage = await (await browser.newContext()).newPage();

        try {
            await gotoStart(guestPage);
            const code = await hostCreateRoom(hostWs);
            await guestJoinAndWaitGame(guestPage, hostWs, code);
            await hostSendBoardInit(hostWs);

            const targetKey = '2,5';

            // 第一次：记录 + reveal → 冲突触发
            await guestPage.evaluate((key) => {
                window.MpConflict.recordLocalReveal(key);
            }, targetKey);
            wsSend(hostWs, { type: 'reveal', key: targetKey });

            await expect(guestPage.locator('.toast').first()).toBeVisible({ timeout: 3000 });
            const firstText = await guestPage.locator('.toast').first().textContent();
            expect(firstText).toContain('抢先');

            // 等 Toast 消失（duration 2000ms + 动画 300ms）
            await guestPage.waitForTimeout(2500);
            await expect(guestPage.locator('.toast')).toHaveCount(0);

            // 第二次：不再记录，同格 reveal → 不触发
            wsSend(hostWs, { type: 'reveal', key: targetKey });
            await guestPage.waitForTimeout(600);
            expect(await guestPage.locator('.toast').count()).toBe(0);
        } finally {
            hostWs.close();
            await browser.close();
        }
    });
});
