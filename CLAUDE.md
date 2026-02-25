# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

多边形扫雷游戏，纯前端项目，使用原生 HTML5 + CSS3 + JavaScript (ES6+)，通过 SVG 精确绘制棋盘。支持四种几何平铺方式，每种均经过数学验证确保无缝拼接。

## 技术栈

- **HTML5** — 页面结构
- **CSS3** — 深色主题样式、range 滑动条自定义样式
- **JavaScript (ES6+)** — 游戏逻辑、几何计算
- **SVG** — 矢量多边形渲染（无 canvas，无框架）

无框架、无构建工具，直接用浏览器打开即可运行。

## 项目结构

```
├── index.html    # 入口文件（仅 HTML 结构）
├── style.css     # 全局样式
├── geometry.js   # 几何计算（多边形顶点、邻居、画布尺寸）
├── renderer.js   # SVG 棋盘渲染器
└── game.js       # 游戏状态与核心逻辑
```

**JS 加载顺序**：`geometry.js` → `renderer.js` → `game.js`（后者依赖前者的全局函数）

## 运行方式

直接用浏览器打开 `index.html`，或启动本地服务器：

```bash
python3 -m http.server 8080
# 访问 http://localhost:8080/index.html
```

## 支持的棋盘类型

| 选项 | 平铺方式 | 每格邻居数 |
|------|---------|-----------|
| 3边（三角形） | 正三角形平铺，`(row+col)%2` 决定朝向（尖上/尖下） | 最多 12（顶点邻居） |
| 4边（正方形） | 标准矩形网格 | 8（顶点邻居，含对角） |
| 6边（六边形） | pointy-top 蜂窝平铺，奇数行水平偏移半格 | 6（边邻居 = 顶点邻居） |
| 8+4（八边形+正方形） | 扩展网格坐标，八边形在偶数行偶数列，菱形小格在奇数行奇数列 | 八边形 8，小格 4（均为顶点邻居） |

## 邻居计算规范

**核心原则：只要两格共享至少一个顶点，就互为邻居（计入雷数统计）。**

新增多边形模式时必须遵守此规范，推荐流程：

1. **推导顶点坐标**：用数学公式精确计算每个格子的顶点像素坐标
2. **穷举偏移验证**：用脚本对内部格子（避免边界干扰）遍历 `(dr, dc)` 偏移范围，通过比较顶点坐标是否重合（误差 < 0.01px）来确定所有邻居偏移
3. **按朝向分组**：若同一种多边形有不同朝向（如三角形的 up/down），分别归纳各自的偏移列表
4. **硬编码偏移表**：将验证后的偏移写入 `geometry.js` 对应的 `xxxNeighbors` 函数，不依赖运行时几何计算
5. **边界过滤**：在偏移表应用后统一过滤越界坐标（`r < 0 || r >= rows || c < 0 || c >= cols`）

验证脚本模板（Node.js）：

```js
// 用 sharedVertex 检测两格是否共享顶点
function sharedVertex(v1, v2) {
    for (const p1 of v1) for (const p2 of v2)
        if (Math.abs(p1[0]-p2[0]) < 0.01 && Math.abs(p1[1]-p2[1]) < 0.01) return true;
    return false;
}
// 对内部格子 (tr, tc) 遍历偏移，收集所有顶点邻居
for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
    if (dr === 0 && dc === 0) continue;
    if (sharedVertex(getVerts(tr, tc), getVerts(tr+dr, tc+dc)))
        offsets.push([dr, dc]);
}
```

## 关键设计

### geometry.js

- 所有坐标计算依赖全局变量 `cellSize`、`rows`、`cols`（由 `game.js` 维护）
- 统一接口：`getCellVertices(sides, r, c)`、`getCellCenter(sides, r, c)`、`getNeighbors(sides, r, c)`、`getBoardSize(sides)`、`getAllCells(sides)`
- **八边形模式**使用扩展网格 `(gr, gc)`：`gr = 2*r, gc = 2*c` 为八边形，`gr = 2*r+1, gc = 2*c+1` 为菱形小格。小格顶点为旋转 45° 的菱形，半对角线 `t = a√2/2`（`a = cellSize/(1+√2)`），与八边形截角端点精确对齐

### renderer.js

- `createSVGBoard(boardEl, w, h)` — 创建整个 SVG 棋盘
- `setCellState(row, col, state, value?)` — 更新格子视觉状态，`state` 取值：`'normal'` | `'revealed'` | `'flagged'` | `'mine'`
- 所有格子用 `<g data-row data-col>` 包裹，内含 `<polygon>` + `<text>`
- 悬停高亮：未揭示格悬停变蓝，已标旗格悬停变深紫，已揭示格无效果

### game.js

- **操作方式**：单击 = 标记旗子（`handleClick`）；右键单击 / 长按 = 打开格子（`handleRightClick`）；首次任意操作均触发安全打开
- **首次点击安全机制**：`firstClick` 标志位，初始化时不放雷；第一次打开操作后调用 `_placeMines(row, col)`，将点击格及其所有邻居列为安全区，再在剩余格子中随机放雷
- **难度系统**：`currentDifficulty` 取值 `'easy'` | `'medium'` | `'hard'` | `'custom'`；`DIFFICULTY_PRESETS[sides][diff]` 存储各边数×难度的 `[rows, cols, mines]` 预设；`selectDifficulty()` 切换难度，`_applyDifficultyPreset()` 将预设同步到滑动条并重建棋盘；自定义模式显示滑动条，其他模式隐藏
- **快速开雷**：单击已揭示的数字格，若周围标旗数等于数字则自动展开周围未标格（右键同样触发）
- `getAllCells(sides)` 枚举所有有效格（八边形模式下总格数 = `rows×cols + (rows-1)×(cols-1)`）
- `revealCell` 用 `key in board` 判断格子有效性（而非 rows/cols 范围检查），以兼容八边形扩展网格
- **触摸长按**：`handleTouchStart` 设置 450ms 定时器，触发则调用 `handleRightClick`（打开格子）；`handleTouchEnd` 短按时调用 `handleClick`（标记）

### 棋盘平移（game.js 末尾）

- 用 `.board-viewport`（`overflow: hidden`，`max-height: 65vh`）作为可视窗口，`.game-board` 通过 `transform: translate()` 在其中移动
- **鼠标**：`mousedown` 记录起点，`mousemove` / `mouseup` 挂在 `document` 上跟踪
- **触摸**：视口上 `touchstart` 记录起点（`passive: true`）；`touchmove` 超过 6px 阈值后进入平移模式并 `preventDefault` 阻止页面滚动；同时清除所有长按计时器防止误触
- 全局标志 `_isPanning`：进入平移后置 `true`，`pointerup` / `touchend` 后延迟 30ms 复位；`handleClick` / `handleRightClick` / `handleTouchEnd` 开头均检查此标志，平移期间忽略游戏逻辑
- `window._panReset()`：棋盘重建（`_buildBoard`）时调用，将偏移归零

## 注意事项

- 修改几何参数时需同时更新顶点计算、邻居关系、画布尺寸三个函数
- 八边形模式的 `rows`/`cols` 含义是**八边形的行列数**，而非总格子行列数
- `getNeighbors` 对 `sides===8` 已在内部做边界检查，其他模式在函数末尾统一过滤
- 新增多边形模式时，**必须用顶点重合验证脚本确认邻居偏移表**，不得凭直觉估算
- 游戏进行中（`firstClick === false`）不允许修改行列数/雷数/边数，设置控件会被禁用
- 触摸平移与格子触摸事件共存：视口的 `touchstart` 不阻止冒泡，格子的 `touchend` 通过 `_isPanning` 标志判断是否为平移手势
