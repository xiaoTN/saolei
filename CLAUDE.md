# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个多边形扫雷游戏（Minesweeper），纯前端项目，使用原生 HTML5 + CSS3 + JavaScript (ES6+)，通过 SVG 绘制棋盘。

## 技术栈

- **HTML5** - 页面结构，SVG 图形
- **CSS3** - 深色主题样式
- **JavaScript (ES6+)** - 游戏逻辑、几何计算
- **SVG** - 矢量图形渲染

无框架、无构建工具。

## 项目结构

```
├── minesweeper.html   # 入口文件
├── game.js            # 游戏核心逻辑（状态管理、点击处理、胜负判定）
├── geometry.js        # 几何计算（多边形顶点、邻居关系、画布尺寸）
├── renderer.js        # SVG 渲染器
└── style.css          # 样式文件
```

加载顺序：`geometry.js` -> `renderer.js` -> `game.js`

## 常用命令

由于是纯前端项目，无需构建。

**运行方式**：
- 直接用浏览器打开 `minesweeper.html`
- 或使用 HTTP 服务器：
  ```bash
  python3 -m http.server 8080
  # 访问 http://localhost:8080/minesweeper.html
  ```

## 主要功能

- 支持多种多边形棋盘：三角形 (3边)、正方形 (4边)、六边形 (6边)、八边形+正方形 (8+4边)
- 左键揭示、右键标记地雷
- 计时器、胜负判定
- 空格键扩散（显示周围所有安全格子）
