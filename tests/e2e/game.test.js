// tests/e2e/game.test.js
const { test, expect } = require('@playwright/test');

test.describe('页面基础', () => {
  test('标题含"多边形扫雷"', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/多边形扫雷/);
  });

  test('模式选择屏存在', async ({ page }) => {
    await page.goto('/');
    const modeScreen = page.locator('#modeScreen');
    await expect(modeScreen).toBeVisible({ timeout: 5000 });
  });

  test('无 JS 控制台错误', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('单人游戏和双人联机按钮可见', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mode-card').first()).toBeVisible();
    await expect(page.locator('.mode-card').nth(1)).toBeVisible();
  });
});

test.describe('进入单人游戏设置界面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 点击单人游戏
    await page.locator('.mode-card').first().click();
    await page.waitForTimeout(300);
  });

  test('进入后显示开始界面', async ({ page }) => {
    const startScreen = page.locator('#startScreen');
    await expect(startScreen).toBeVisible({ timeout: 3000 });
  });

  test('棋盘形状按钮存在', async ({ page }) => {
    // sides=3,4,5,6,8,34,36 共 7 个
    const sideButtons = page.locator('.side-btn');
    const count = await sideButtons.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('难度按钮存在', async ({ page }) => {
    // easy, medium, hard, hell, custom 共 5 个
    const diffButtons = page.locator('.diff-btn');
    const count = await diffButtons.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('开始游戏按钮存在', async ({ page }) => {
    const startBtn = page.locator('.start-btn').first();
    await expect(startBtn).toBeVisible();
  });
});

test.describe('形状切换', () => {
  const shapes = [
    { sides: 3, label: '三角形' },
    { sides: 4, label: '正方形' },
    { sides: 5, label: '五边形' },
    { sides: 6, label: '六边形' },
    { sides: 8, label: '八边形' },
    { sides: 34, label: '扭棱正方' },
    { sides: 36, label: '三六混合' },
  ];

  for (const { sides, label } of shapes) {
    test(`切换到 ${label}(sides=${sides}) 无报错`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('/');
      // 进入单人游戏
      await page.locator('.mode-card').first().click();
      await page.waitForTimeout(300);

      const btn = page.locator(`#startScreen [data-sides="${sides}"]`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(300);
        // 验证按钮被选中
        await expect(btn).toHaveClass(/selected/);
      }
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe('难度切换', () => {
  const difficulties = [
    { diff: 'easy', label: '简单' },
    { diff: 'medium', label: '中等' },
    { diff: 'hard', label: '困难' },
    { diff: 'hell', label: '地狱' },
    { diff: 'custom', label: '自定义' },
  ];

  for (const { diff, label } of difficulties) {
    test(`切换难度 ${label}(${diff}) 无报错`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('/');
      await page.locator('.mode-card').first().click();
      await page.waitForTimeout(300);

      const btn = page.locator(`#startScreen [data-diff="${diff}"]`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(200);
        await expect(btn).toHaveClass(/selected/);
      }
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe('游戏启动与交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 进入单人游戏
    await page.locator('.mode-card').first().click();
    await page.waitForTimeout(300);
    // 点击开始游戏
    await page.locator('.start-btn').first().click();
    await page.waitForTimeout(800);
  });

  test('canvas 棋盘元素存在且可见', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test('游戏界面显示', async ({ page }) => {
    const gameScreen = page.locator('#gameScreen');
    await expect(gameScreen).toBeVisible({ timeout: 5000 });
  });

  test('计时器元素存在', async ({ page }) => {
    const timer = page.locator('#timer');
    await expect(timer).toBeVisible();
  });

  test('旗帜进度显示', async ({ page }) => {
    const flagProgress = page.locator('#flagProgress');
    await expect(flagProgress).toBeVisible();
  });

  test('右键点击 canvas 无 JS 错误', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const canvas = page.locator('canvas').first();
    await canvas.click({ button: 'right', position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
  });

  test('左键点击 canvas 无 JS 错误', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const canvas = page.locator('canvas').first();
    await canvas.click({ button: 'left', position: { x: 100, y: 100 } });
    await page.waitForTimeout(300);
    expect(errors).toHaveLength(0);
  });

  test('重启按钮存在', async ({ page }) => {
    const restartBtn = page.locator('#restartBtn');
    await expect(restartBtn).toBeVisible();
  });

  test('返回菜单按钮存在', async ({ page }) => {
    const backBtn = page.locator('#gameScreen .back-btn');
    await expect(backBtn).toBeVisible();
  });
});

test.describe('返回导航', () => {
  test('从单人游戏设置界面返回模式选择', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-card').first().click();
    await page.waitForTimeout(300);
    await page.locator('.lobby-back').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#modeScreen')).toBeVisible();
  });

  test('从游戏界面返回菜单', async ({ page }) => {
    await page.goto('/');
    await page.locator('.mode-card').first().click();
    await page.waitForTimeout(300);
    await page.locator('.start-btn').first().click();
    await page.waitForTimeout(800);
    await page.locator('#gameScreen .back-btn').click();
    await page.waitForTimeout(300);
    // 返回后应显示模式屏或开始屏
    const modeVisible = await page.locator('#modeScreen').isVisible();
    const startVisible = await page.locator('#startScreen').isVisible();
    expect(modeVisible || startVisible).toBe(true);
  });
});
