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
├── minesweeper.html   # 入口文件（仅 HTML 结构）
├── style.css          # 全局样式
├── geometry.js        # 几何计算（多边形顶点、邻居、画布尺寸）
├── renderer.js        # SVG 棋盘渲染器
└── game.js            # 游戏状态与核心逻辑
```

**JS 加载顺序**：`geometry.js` → `renderer.js` → `game.js`（后者依赖前者的全局函数）

## 运行方式

直接用浏览器打开 `minesweeper.html`，或启动本地服务器：

```bash
python3 -m http.server 8080
# 访问 http://localhost:8080/minesweeper.html
```

## 支持的棋盘类型

| 选项 | 平铺方式 | 每格邻居数 |
|------|---------|-----------|
| 3边（三角形） | 正三角形平铺，`(row+col)%2` 决定朝向（尖上/尖下） | 3 |
| 4边（正方形） | 标准矩形网格 | 8（含对角） |
| 6边（六边形） | pointy-top 蜂窝平铺，奇数行水平偏移半格 | 6 |
| 8+4（八边形+正方形） | 扩展网格坐标，八边形在偶数行偶数列，菱形小格在奇数行奇数列 | 八边形 8，小格 4 |

## 关键设计

### geometry.js

- 所有坐标计算依赖全局变量 `cellSize`、`rows`、`cols`（由 `game.js` 维护）
- 统一接口：`getCellVertices(sides, r, c)`、`getCellCenter(sides, r, c)`、`getNeighbors(sides, r, c)`、`getBoardSize(sides)`、`getAllCells(sides)`
- **八边形模式**使用扩展网格 `(gr, gc)`：`gr = 2*r, gc = 2*c` 为八边形，`gr = 2*r+1, gc = 2*c+1` 为菱形小格。小格顶点为旋转 45° 的菱形，半对角线 `t = a√2/2`（`a = cellSize/(1+√2)`），与八边形截角端点精确对齐

### renderer.js

- `createSVGBoard(boardEl, w, h)` — 创建整个 SVG 棋盘
- `setCellState(row, col, state, value?)` — 更新格子视觉状态，`state` 取值：`'normal'` | `'revealed'` | `'flagged'` | `'mine'`
- 所有格子用 `<g data-row data-col>` 包裹，内含 `<polygon>` + `<text>`

### game.js

- **首次点击安全机制**：`firstClick` 标志位，初始化时不放雷；第一次点击后调用 `_placeMines(row, col)`，将点击格及其所有邻居列为安全区，再在剩余格子中随机放雷
- `getAllCells(sides)` 枚举所有有效格（八边形模式下总格数 = `rows×cols + (rows-1)×(cols-1)`）
- `revealCell` 用 `key in board` 判断格子有效性（而非 rows/cols 范围检查），以兼容八边形扩展网格
- 支持"快速开雷"：点击已揭示的数字格，若周围标旗数等于数字则自动点开周围未标格

## 注意事项

- 修改几何参数时需同时更新顶点计算、邻居关系、画布尺寸三个函数
- 八边形模式的 `rows`/`cols` 含义是**八边形的行列数**，而非总格子行列数
- `getNeighbors` 对 `sides===8` 已在内部做边界检查，其他模式在函数末尾统一过滤
