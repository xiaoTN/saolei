---
name: build-android-apk
description: 打包并安装 Android APK。当用户要求打包安卓应用、构建 APK、生成 Android 安装包、安装到手机时使用此 skill。如果检测到 ADB 设备，自动安装。
---

# Android APK 打包与安装流程

## 前置条件

- 项目根目录有 `mobile/` 子目录
- 已安装 Node.js 和 Android SDK
- 已配置好 Capacitor 环境

## 打包步骤

### 1. 同步代码到 mobile

```bash
cd mobile && npm run build
```

这会执行 `scripts/sync-assets.sh`，将根目录的 `geometry.js`、`game.js`、`renderer.js`、`style.css` 和 `shared/` 目录复制到 `mobile/src/`。

### 2. 同步到原生平台

```bash
npm run sync
```

即 `npx cap sync`，将 Web 资源同步到 `android/` 和 `ios/` 原生项目。

### 3. 构建 Release APK

```bash
cd android && ./gradlew assembleRelease
```

### 4. 检测设备并安装

**构建完成后，必须检查是否有连接的设备并自动安装：**

```bash
adb devices
```

- 如果检测到设备（List of devices attached 下面有设备ID），执行：
  ```bash
  adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
  ```
  `-r` 参数表示覆盖安装

- 如果没有检测到设备，提示用户连接设备：
  - **USB 连接**：用数据线连接手机，开启「开发者选项」→「USB 调试」，手机上授权
  - **无线连接（Android 11+）**：手机和电脑连同一 WiFi，在手机开发者选项中查看配对端口，然后 `adb pair <IP>:<端口>`

## 输出位置

```
mobile/android/app/build/outputs/apk/release/app-release.apk
```

## 完整命令（一键打包+安装）

```bash
cd /Users/xiaotn/saolei/mobile && \
npm run build && \
npm run sync && \
cd android && ./gradlew assembleRelease && \
cd ../.. && \
if [ $(adb devices | grep -v "List" | grep -c "device") -gt 0 ]; then \
  adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk; \
else \
  echo "未检测到设备，请连接手机后重试"; \
fi
```

## 常见问题

- **Gradle Daemon 启动慢**：首次构建会启动 Gradle Daemon，后续构建会更快
- **SDK 版本警告**：可以忽略，不影响构建
- **构建时间**：首次约 20-30 秒，后续增量构建更快
- **安装失败 INSTALL_FAILED_UPDATE_INCOMPATIBLE**：先卸载旧版本再安装
