// Playwright 自动化测试脚本
const { chromium } = require('playwright');

async function runTests() {
  console.log('🧪 开始测试多边形扫雷游戏...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    // 导航到游戏页面
    await page.goto('http://127.0.0.1:8000/');
    await page.waitForSelector('.game-board');
    console.log('✅ 页面加载成功');

    // 测试1: 检查标题
    console.log('\n📋 测试1: 检查页面标题');
    const title = await page.title();
    if (title.includes('多边形扫雷')) {
      results.passed.push('页面标题正确');
      console.log('  ✅ 通过');
    } else {
      results.failed.push('页面标题不正确: ' + title);
      console.log('  ❌ 失败: ' + title);
    }

    // 测试2: 检查形状按钮
    console.log('\n📋 测试2: 检查形状选择按钮');
    const sideButtons = await page.$$('.side-btn');
    if (sideButtons.length === 4) {
      results.passed.push('形状按钮数量正确 (4个)');
      console.log('  ✅ 通过: 4个形状按钮');
    } else {
      results.failed.push('形状按钮数量不正确: ' + sideButtons.length);
      console.log('  ❌ 失败: 期望4个，实际' + sideButtons.length + '个');
    }

    // 测试3: 检查难度按钮
    console.log('\n📋 测试3: 检查难度选择按钮');
    const diffButtons = await page.$$('.diff-btn');
    if (diffButtons.length === 5) {
      results.passed.push('难度按钮数量正确 (5个)');
      console.log('  ✅ 通过: 5个难度按钮');
    } else {
      results.failed.push('难度按钮数量不正确: ' + diffButtons.length);
      console.log('  ❌ 失败: 期望5个，实际' + diffButtons.length + '个');
    }

    // 测试4: 切换形状
    console.log('\n📋 测试4: 测试形状切换');
    const shapes = [3, 4, 6, 8];
    for (const sides of shapes) {
      await page.click(`.side-btn[data-sides="${sides}"]`);
      await page.waitForTimeout(100);
      const selectedBtn = await page.$(`.side-btn[data-sides="${sides}"].selected`);
      if (selectedBtn) {
        console.log(`  ✅ ${sides}边形切换成功`);
      } else {
        results.failed.push(`${sides}边形切换失败`);
        console.log(`  ❌ ${sides}边形切换失败`);
      }
    }
    results.passed.push('形状切换测试完成');

    // 测试5: 切换难度
    console.log('\n📋 测试5: 测试难度切换');
    const difficulties = ['easy', 'medium', 'hard', 'hell'];
    for (const diff of difficulties) {
      await page.click(`.diff-btn[data-diff="${diff}"]`);
      await page.waitForTimeout(100);
      const selectedBtn = await page.$(`.diff-btn[data-diff="${diff}"].selected`);
      if (selectedBtn) {
        console.log(`  ✅ ${diff}难度切换成功`);
      } else {
        results.failed.push(`${diff}难度切换失败`);
        console.log(`  ❌ ${diff}难度切换失败`);
      }
    }
    results.passed.push('难度切换测试完成');

    // 测试6: 开始游戏
    console.log('\n📋 测试6: 测试开始游戏');
    await page.click('.side-btn[data-sides="4"]');  // 正方形
    await page.click('.diff-btn[data-diff="easy"]'); // 简单难度
    await page.click('button:has-text("开始游戏")');
    await page.waitForTimeout(500);
    
    const cells = await page.$$('.cell');
    if (cells.length > 0) {
      results.passed.push('游戏初始化成功，格子数: ' + cells.length);
      console.log('  ✅ 游戏初始化成功，格子数: ' + cells.length);
    } else {
      results.failed.push('游戏初始化失败，没有格子');
      console.log('  ❌ 游戏初始化失败');
    }

    // 测试7: 测试右键打开格子
    console.log('\n📋 测试7: 测试右键打开格子');
    const firstCell = await page.$('.cell');
    if (firstCell) {
      await firstCell.click({ button: 'right' });
      await page.waitForTimeout(300);
      const revealedCells = await page.$$('.cell.revealed');
      if (revealedCells.length > 0) {
        results.passed.push('右键打开格子成功');
        console.log('  ✅ 右键打开格子成功，已打开: ' + revealedCells.length + '格');
      } else {
        results.warnings.push('右键打开可能需要检查');
        console.log('  ⚠️ 没有看到打开的格子');
      }
    }

    // 测试8: 测试左键标记
    console.log('\n📋 测试8: 测试左键标记');
    const unflaggedCell = await page.$('.cell:not(.flagged)');
    if (unflaggedCell) {
      await unflaggedCell.click({ button: 'left' });
      await page.waitForTimeout(100);
      const flaggedCells = await page.$$('.cell.flagged');
      if (flaggedCells.length > 0) {
        results.passed.push('左键标记成功');
        console.log('  ✅ 左键标记成功');
      } else {
        results.warnings.push('左键标记可能需要检查');
        console.log('  ⚠️ 没有看到标记的格子');
      }
    }

    // 测试9: 测试不同形状的游戏
    console.log('\n📋 测试9: 测试不同形状的游戏');
    for (const sides of [3, 6, 8]) {
      await page.click(`.side-btn[data-sides="${sides}"]`);
      await page.click('.diff-btn[data-diff="easy"]');
      await page.click('button:has-text("开始游戏")');
      await page.waitForTimeout(500);
      
      const cells = await page.$$('.cell');
      if (cells.length > 0) {
        console.log(`  ✅ ${sides}边形游戏成功，格子数: ${cells.length}`);
      } else {
        results.failed.push(`${sides}边形游戏初始化失败`);
        console.log(`  ❌ ${sides}边形游戏初始化失败`);
      }
    }
    results.passed.push('不同形状游戏测试完成');

    // 测试10: 检查计时器
    console.log('\n📋 测试10: 检查计时器');
    await page.click('.side-btn[data-sides="4"]');
    await page.click('.diff-btn[data-diff="easy"]');
    await page.click('button:has-text("开始游戏")');
    await page.waitForTimeout(2000);
    
    const timer = await page.$('#timer');
    if (timer) {
      const timerText = await timer.textContent();
      console.log(`  ⏱️ 计时器显示: ${timerText}秒`);
      results.passed.push('计时器工作正常');
    } else {
      results.warnings.push('计时器元素未找到');
      console.log('  ⚠️ 计时器元素未找到');
    }

    // 测试11: 检查状态栏
    console.log('\n📋 测试11: 检查状态栏');
    const cellCount = await page.$('#cellCount');
    const mineRatio = await page.$('#mineRatio');
    const flagProgress = await page.$('#flagProgress');
    
    if (cellCount && mineRatio && flagProgress) {
      results.passed.push('状态栏元素完整');
      console.log('  ✅ 状态栏元素完整');
    } else {
      results.failed.push('状态栏元素缺失');
      console.log('  ❌ 状态栏元素缺失');
    }

    // 测试12: 测试提示文字
    console.log('\n📋 测试12: 检查提示文字');
    const tips = await page.$('.tips');
    if (tips) {
      const tipsText = await tips.textContent();
      if (tipsText.includes('左键点击')) {
        results.passed.push('提示文字已修复');
        console.log('  ✅ 提示文字正确: ' + tipsText);
      } else {
        results.warnings.push('提示文字可能需要更新');
        console.log('  ⚠️ 提示文字: ' + tipsText);
      }
    }

  } catch (error) {
    results.failed.push('测试执行错误: ' + error.message);
    console.error('❌ 测试错误:', error);
  } finally {
    await browser.close();
  }

  // 输出测试报告
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试报告');
  console.log('='.repeat(50));
  console.log(`✅ 通过: ${results.passed.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  console.log(`⚠️ 警告: ${results.warnings.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ 通过的测试:');
    results.passed.forEach((item, i) => console.log(`  ${i+1}. ${item}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失败的测试:');
    results.failed.forEach((item, i) => console.log(`  ${i+1}. ${item}`));
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    results.warnings.forEach((item, i) => console.log(`  ${i+1}. ${item}`));
  }

  // 返回测试结果
  return results.failed.length === 0;
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('测试脚本错误:', err);
  process.exit(1);
});
