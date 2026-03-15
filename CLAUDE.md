# CLAUDE.md

## 项目概述

多边形扫雷游戏，纯前端实现（原生 HTML/CSS/JavaScript），使用 Canvas 绘制棋盘。项目强调几何正确性、移动端可用性和大棋盘性能。

## 技术栈

- HTML5 + CSS3（无框架、无构建工具）
- JavaScript (ES6+)（全局脚本，按顺序加载）
- Canvas（棋盘渲染，原 SVG 已替换）

## 文件结构

```text
index.html      # 页面结构与脚本加载顺序（含缓存版本号）
style.css       # UI 样式、布局、视口区域样式
geometry.js     # 多边形几何/邻居/画布尺寸/有效格枚举
renderer.js     # Canvas 渲染、格子状态更新、事件委托
multiplayer.js  # 前端联机模块（WebSocket 通信）
game.js         # 游戏状态、规则、计时器、设置、平移与交互
shared/         # 共享模块（haptics、platform、storage、mp-conflict）
                #   mp-conflict.js：联机竞点冲突检测（纯逻辑，无 DOM 依赖）
server/         # 联机服务器相关文件
mobile/         # Capacitor 移动端包装
```

加载顺序必须保持：`shared/platform.js -> shared/storage.js -> shared/haptics.js -> geometry.js -> renderer.js -> multiplayer.js -> game.js`。

## 当前功能（重要）

### 棋盘与几何

支持以下 7 种平铺模式（`sides` 值）：

| `sides` | 名称 | 说明 |
|---------|------|------|
| `3` | 三角形 | 尖朝上/尖朝下交替平铺，每格最多 12 个顶点邻居 |
| `4` | 正方形 | 标准 8 邻居（含对角） |
| `5` | Cairo 五边形 | 等边开罗五边形镶嵌，4 个五边形为一组，使用扩展坐标 `(gr, gc)` |
| `6` | 六边形 | pointy-top 蜂窝平铺，6 个面邻居 |
| `8` | 八边形+正方形 | 扩展网格：gr 偶 gc 偶为八边形，gr 奇 gc 奇为正方形 |
| `34` | 扭棱正方形（Snub Square）| 3.3.4.3.4 平铺，每基本域 2 正方形 + 4 三角形共 6 格，通过空间哈希建边图，使用缓存计算 |
| `36` | 三六混合镶嵌（kagome）| 3.6.3.6 平铺，六边形+三角形，通过顶点共享构建邻居，使用缓存计算 |

- 邻居定义统一为：**共享至少一个顶点即为邻居**（计入数字）。
- `sides === 5 / 8 / 34 / 36` 使用扩展网格坐标 `(gr, gc)`，有效性判断应使用 `key in board`。
- `sides === 34` 通过 `_ensureSnubSqCache()` 使用 Polytope Wiki 精确顶点公式（s=√(2+√3)/4）构建缓存（按 `rows|cols|cellSize` 签名失效）。
- `sides === 36` 通过 `_triHexCache` 缓存所有格子及邻居关系（按 `rows|cols|cellSize` 签名失效）。

### 难度预设（`DIFFICULTY_PRESETS`）

各难度按**实际格子数**的固定密度设定雷数，确保跨棋盘类型的难度一致性：

| 难度 | 目标雷密度 |
|------|-----------|
| easy | ≈12% |
| medium | ≈16% |
| hard | ≈21% |
| hell | ≈25% |

各模式的实际格子数计算方式（修改雷数预设时必须使用正确公式）：

| `sides` | 实际格子数公式 |
|---------|--------------|
| `3` | `rows × (cols × 2)`（cols 内部已乘 2）|
| `4` | `rows × cols` |
| `5` | `rows × cols × 4`（每组 4 个五边形）|
| `6` | `rows × cols` |
| `8` | `rows×cols + (rows-1)×(cols-1)` |
| `34` | `rows × cols × 6`（每基本域 2 正方形 + 4 三角形）|
| `36` | `2×rows×cols + rows + cols` |

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

- `renderer.js`（已从 SVG 改为 Canvas，这是最核心的性能优化）
  - **Canvas 替代 SVG**：大棋盘下 SVG DOM 节点过多导致卡顿，全量改用 `<canvas>` 绘制，消除 DOM 瓶颈
  - `cellDomMap` 缓存格子元数据（`{ key, row, col, fontSize }`），避免重复计算
  - **按需单格重绘**：`setCellState()` 只调 `_drawCell()` 重绘单个格子，hover 只重绘旧格+新格，不做全量 `_renderBoard()`
  - 点击检测：正方形（sides=4）直接数学计算行列（O(1)快速路径），其余形状用边界框快速排除再做精确射线法
- `geometry.js`
  - **空间哈希加速建图**（sides=34）：步骤2用 `spatialHash` 将查找相距为 a 的顶点对从 O(N²) 降为 O(N)
  - **缓存机制**（sides=34/36/5/8）：几何计算结果按 `rows|cols|cellSize` 签名缓存（`_snubSqCache` / `_triHexCache`），棋盘参数不变时直接复用，不重新计算
  - sides=34 顶点坐标在缓存初始化时统一平移对齐（保证左上角留 pad 空白），平移是一次性 O(N)，后续读取无额外开销
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
- `_effectiveCellSize()` 确保 sides=3/4/5/6 主格子面积等于 40²=1600px²；修改格子尺寸时不要绕过此函数。

## 本地运行与验证

### 运行

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/
```

### 联机服务（多人模式）

**本地/局域网**（注意：部分路由器有 AP 隔离，局域网可能无法跨设备访问）

```bash
node server.js
# 启动后会打印 LAN 地址，手机同局域网访问该地址即可
```

**公网访问（推荐，绕开 AP 隔离）**

需先安装 ngrok：`brew install ngrok`

```bash
# 终端 1：启动本地服务
node server.js

# 终端 2：开启 ngrok 隧道
ngrok http 8765
# ngrok 会输出 https://xxxx.ngrok-free.app，手机访问该地址即可联机
```

### 最小验证清单

```bash
node --check game.js renderer.js geometry.js
```

手工验证建议：
- 切换七种棋盘类型并开局
- 左键标旗、右键开格、长按开格
- 大棋盘（如 `100x100`）创建是否分帧、交互是否恢复
- 拖拽/双指滑动平移、默认居中是否正常
- 踩雷后雷格 hover 颜色不变

## 单元测试

项目使用 Node.js 内置测试运行器：

```bash
npm test              # 运行所有单元测试
npm run test:unit     # 同上
npm run test:e2e      # 游戏 E2E 测试（需先 npx playwright install）
npm run test:mp-e2e   # 联机多人 E2E 测试（需先 npx playwright install）
```

单元测试文件位于 `tests/unit/`：
- `geometry.test.js` — 几何计算测试
- `renderer.test.js` — 渲染逻辑测试
- `snub-square.test.js` — 扭棱正方形专项测试
- `mp-click-conflict.test.js` — 联机竞点冲突检测单元测试

E2E 测试文件位于 `tests/e2e/`：
- `game.test.js` — 游戏核心 E2E 测试
- `mp-click-conflict.test.js` — 联机竞点冲突 E2E 测试（4 个场景）

**规则：**
- 新增功能（新棋盘类型、新游戏机制）必须添加对应单元测试
- 小改动（修改颜色、字体大小等）无需单元测试，由 Claude 判断

## 测试用例（重要）

所有执行过的测试用例必须记录在 `TEST-CASES.md` 文件中。

- 每次测试后发现的问题和修复方案都要添加到测试用例文件
- 测试用例按功能模块分类，包含：测试步骤、预期结果、关联修复
- 发布前按 `TEST-CASES.md` 清单逐项验证

## 约定

- 每次完成代码或文档改动后立即执行 `git commit`
- `git commit` 信息使用中文，简洁描述本次改动
