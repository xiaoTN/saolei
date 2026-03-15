---
name: sync-web-to-mobile
description: 将 web 端代码同步到 mobile 端（Capacitor Android/iOS）。当根目录的 JS/CSS/HTML 文件有改动，需要同步到 mobile/src/ 时使用此 skill。
---

# 同步 Web 代码到 Mobile

## 概述

本项目使用 Capacitor 封装为 Android/iOS App。web 端代码（根目录）与 mobile 端代码（`mobile/src/`）通过 `sync-assets.sh` 脚本同步。

**核心原则：** 先改 web → 运行脚本同步 → Capacitor sync → 验证。

**启动时声明：** "我正在使用 sync-web-to-mobile skill 将 web 代码同步到移动端。"

## 何时使用

当以下文件有改动时：
- `geometry.js` / `renderer.js` / `game.js` / `multiplayer.js` / `style.css`
- `shared/` 目录下的文件
- `index.html`（需要手动同步，见下文）

## 同步流程

### 1. 确认 web 端改动已提交

```bash
git status
```

确保 web 端的 JS/CSS 改动已经 commit。

### 2. 语法检查

```bash
node --check geometry.js renderer.js game.js multiplayer.js
```

### 3. 运行同步脚本

```bash
bash mobile/scripts/sync-assets.sh
```

预期输出：`Assets synced to mobile/src/`

### 4. 验证同步结果

```bash
ls mobile/src/
diff game.js mobile/src/game.js && echo "game.js: OK" || echo "FAIL"
diff multiplayer.js mobile/src/multiplayer.js && echo "multiplayer.js: OK" || echo "FAIL"
diff -r shared/ mobile/src/shared/ && echo "shared: OK" || echo "FAIL"
```

### 5. Capacitor 同步

```bash
(cd mobile && npx cap sync)
```

预期输出：`✔ Sync finished in X.XXs`

### 6. 手动同步 index.html（必须）

见下文「index.html 同步」章节，检查并同步 DOM 差异。

### 7. 提交 mobile 端改动

```bash
git add mobile/src/
git commit -m "chore: 同步 web 端代码到 mobile/src/"
```

## index.html 同步（手动，必须执行）

`index.html` 不会被 `sync-assets.sh` 自动覆盖。**每次触发本 skill 都必须检查并同步 index.html。**

### 同步原则

**web 版是唯一源头**，mobile 版的所有 DOM 结构必须以 web 版为准。

mobile 版（`mobile/src/index.html`）只允许保留以下差异：
- `<head>` 里的移动端专用 meta 标签（viewport、apple-mobile-web-app）
- 脚本标签**不带** `?v=xxx` 缓存参数

**不允许在 `mobile/src/index.html` 里单独开发新功能**，所有功能改动必须先在 web 版实现，再同步到 mobile。

### 手动同步步骤

1. 运行 diff 查看差异：
   ```bash
   diff index.html mobile/src/index.html
   ```
2. 将 web 版的 `<body>` 内容同步到 mobile 版，保留 mobile 专用的 `<head>` 和脚本标签（去掉 `?v=xxx`）
3. 确保脚本加载顺序一致：`platform → storage → haptics → geometry → renderer → multiplayer → game`

## 验证清单

同步完成后，在设备上验证：

**Android：**
```bash
(cd mobile && npx cap open android)
```
- 启动正常，无白屏
- 七种棋盘形状切换正常
- 联机大厅能连接服务器

**iOS：**
```bash
(cd mobile && npx cap open ios)
```
- 同 Android 验证项
- 震动反馈正常（使用 `@capacitor/haptics`）

## 快速参考

| 命令 | 说明 |
|------|------|
| `bash mobile/scripts/sync-assets.sh` | 同步 JS/CSS/shared 到 mobile/src/ |
| `(cd mobile && npx cap sync)` | 同步到 Android/iOS 原生层 |
| `(cd mobile && npx cap open android)` | 打开 Android Studio |
| `(cd mobile && npx cap open ios)` | 打开 Xcode |

## 注意事项

- **不要直接修改 `mobile/src/` 下的 JS/CSS 文件**，它们会被脚本覆盖
- **`mobile/src/index.html` 是例外**，需要手动维护
- 同步后务必在真机或模拟器上验证，Capacitor WebView 行为可能与浏览器不同
