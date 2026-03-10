# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

多边形扫雷游戏，纯前端实现（原生 HTML/CSS/JavaScript），使用 SVG 绘制棋盘。项目强调几何正确性、移动端可用性和大棋盘性能。

## 技术栈

- HTML5 + CSS3（无框架、无构建工具）
- JavaScript (ES6+)（全局脚本，按顺序加载）
- SVG（棋盘渲染与交互事件）

## 文件结构

```text
index.html     # 页面结构与脚本加载顺序（含缓存版本号）
style.css      # UI 样式、布局、视口区域样式
geometry.js    # 多边形几何/邻居/画布尺寸/有效格枚举
renderer.js    # SVG 创建、格子状态更新、事件委托
game.js        # 游戏状态、规则、计时器、设置、平移与交互
```

加载顺序必须保持：`geometry.js -> renderer.js -> game.js`。

## 当前功能（重要）

### 棋盘与几何

- 支持 `3 / 4 / 6 / 8+4` 四种平铺模式。
- 邻居定义统一为：**共享至少一个顶点即为邻居**（计入数字）。
- `8+4` 模式使用扩展网格，存在“无效坐标空位”，有效性判断应使用 `key in board`。

### 操作方式（与传统扫雷不同）

- `左键单击`：标旗/取消标旗
- `右键单击` 或 `长按(450ms)`：开格
- `首次点击`（无论左/右/短按/长按）都会触发安全开格
- 点击已揭示数字格：若周围旗子数等于数字，会执行快速开雷（chord）

### 移动端与触控板

- 触摸短按走 `handleClick`（标旗），长按走 `handleRightClick`（开格）
- 支持拖拽平移棋盘（触摸/鼠标）
- Mac 触控板双指滑动通过 `wheel` 事件平移棋盘（`ctrl+wheel` 保留浏览器缩放）
- 棋盘重建后默认居中（`window._panCenter()`）

### 震动反馈（移动端）

- 开格成功：短震动 `vibrate(30)`
- 标旗：轻震 `vibrate(15)`
- 踩雷：震动模式 `vibrate([100, 50, 100])`
- 注意：iOS Safari 通常不支持 `navigator.vibrate()`

## 性能优化现状（大棋盘相关）

已实现的关键优化（修改时不要回退）：

- `renderer.js`
  - `cellDomMap` 缓存格子 DOM 引用（避免频繁 `querySelector`）
  - SVG 事件委托（替代每格多个监听器）
  - `DocumentFragment` 批量挂载
  - 大棋盘分帧渲染（`requestAnimationFrame` chunk render）
  - 分帧期间临时 `pointer-events: none`，完成后恢复
- `game.js`
  - `revealedCount` + `totalCellsCount` 实现 `checkWin()` O(1)
  - `allCellsCache` / `neighborsCache` 热路径缓存
  - `revealCell()` 改为迭代队列 flood fill（含入队去重）
  - 放雷使用部分 Fisher-Yates（无放回随机抽样）

## 关键实现约束

### geometry.js

- 修改几何参数时，必须同步检查：顶点计算、邻居偏移、画布尺寸、有效格枚举。
- 新增多边形模式时，必须用“顶点重合验证脚本”确认邻居偏移表，不可凭直觉估算。

### renderer.js

- `setCellState()` 依赖 `cellDomMap`，不要恢复为 DOM 查询。
- 游戏结束后 hover 不应再改变格子颜色（尤其雷格）。
- 若 `renderer.js` 行为改了但浏览器看起来没生效，先检查 `index.html` 脚本版本号缓存参数。

### game.js

- 游戏进行中（`firstClick === false`）设置项会锁定，避免改盘面导致状态不一致。
- 平移手势通过 `_isPanning` 抑制点击/长按；改交互时要回归测试鼠标、触摸、触控板三条路径。
- `revealCell()` / 开雷逻辑中对有效格判断优先使用 `board` 映射，而不是单纯 `rows/cols` 范围。

## 本地运行与验证

### 运行

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/
```

### 最小验证清单

```bash
node --check game.js renderer.js geometry.js
```

手工验证建议：
- 切换四种棋盘类型并开局
- 左键标旗、右键开格、长按开格
- 大棋盘（如 `100x100`）创建是否分帧、交互是否恢复
- 拖拽/双指滑动平移、默认居中是否正常
- 踩雷后雷格 hover 颜色不变

## 测试用例（重要）

所有执行过的测试用例必须记录在 `TEST-CASES.md` 文件中。

- 每次测试后发现的问题和修复方案都要添加到测试用例文件
- 测试用例按功能模块分类，包含：测试步骤、预期结果、关联修复
- 发布前按 `TEST-CASES.md` 清单逐项验证

## 文档同步规则（重要）

`CLAUDE.md` 与 `AGENTS.md` 必须保持相同内容，用于 Claude Code / Codex 共用上下文。

- 更新任一文件时，必须同步更新另一个文件
- 提交前建议执行：`cmp -s CLAUDE.md AGENTS.md`
- 约定：每次完成代码或文档改动后立即执行 `git commit`
- 约定：`git commit` 信息使用中文，简洁描述本次改动
