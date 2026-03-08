# Capacitor 移动端适配设计

## 概述

将多边形扫雷 Web 游戏转换为 Android App，使用 Capacitor 作为跨平台方案，同时保持代码对 iOS 的兼容性。

## 需求总结

| 项目 | 选择 |
|------|------|
| 目标平台 | Android（保持 iOS 兼容） |
| 数据存储 | 本地持久化（SQLite） |
| 震动反馈 | 统一用 Haptics |
| App 图标 | 先用占位图标 |
| 签名 | 正式签名 |

## 项目结构

```
saolei/
├── index.html          # Web 入口（稍作修改）
├── style.css           # 样式（共享）
├── geometry.js         # 几何计算（共享）
├── renderer.js         # 渲染（共享）
├── game.js             # 游戏逻辑（稍作修改）
├── mobile/             # 新增：Capacitor 项目
│   ├── src/
│   │   └── index.html  # App 入口（引用根目录的 JS/CSS）
│   ├── android/        # Android 原生项目（自动生成）
│   ├── capacitor.config.json
│   ├── package.json
│   └── keystore/       # 签名密钥
├── shared/             # 新增：共享模块
│   ├── storage.js      # 存储抽象层
│   ├── haptics.js      # 震动抽象层
│   └── platform.js     # 平台检测
└── ...
```

## 存储抽象层

### 接口设计

```javascript
// shared/storage.js

const StorageAdapter = {
  // 初始化（App 端需要等待 SQLite 就绪）
  async init() { ... },

  // 保存游戏设置
  async saveSettings(settings) { ... },
  async loadSettings() { ... },

  // 保存统计数据
  async saveStats(stats) { ... },
  async loadStats() { ... },

  // 对局记录（仅 App 端 SQLite 支持）
  async saveGameRecord(record) { ... },
  async loadGameHistory(limit, offset) { ... },
  async deleteGameHistory() { ... }
};
```

### Web 端实现

- 使用 `localStorage` 存储设置和统计
- 对局记录只保留最近 10 局（存 JSON）

### App 端实现

- 使用 `@capacitor/preferences` 存设置
- 使用 `@capacitor-community/sqlite` 存对局记录

### SQLite 表结构

```sql
CREATE TABLE game_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_type TEXT,        -- 棋盘类型 '3'/'4'/'6'/'8+4'
  rows INTEGER,
  cols INTEGER,
  mines INTEGER,
  result TEXT,            -- 'win'/'lose'
  duration_seconds INTEGER,
  revealed_count INTEGER,
  flagged_count INTEGER,
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 震动抽象层

### 接口设计

```javascript
// shared/haptics.js

const HapticsAdapter = {
  // 开格成功 - 短震动
  async light() { ... },

  // 标旗 - 轻震
  async tick() { ... },

  // 踩雷 - 强震动模式
  async error() { ... }
};
```

### Web 端实现

```javascript
HapticsAdapter.light = () => navigator.vibrate?.(30);
HapticsAdapter.tick = () => navigator.vibrate?.(15);
HapticsAdapter.error = () => navigator.vibrate?.([100, 50, 100]);
```

### App 端实现

```javascript
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

HapticsAdapter.light = () => Haptics.impact({ style: ImpactStyle.Light });
HapticsAdapter.tick = () => Haptics.impact({ style: ImpactStyle.Light });
HapticsAdapter.error = () => Haptics.notification({ type: NotificationType.Error });
```

## 平台检测

```javascript
// shared/platform.js

const Platform = {
  isApp: false,
  isWeb: true,
  isAndroid: false,
  isIOS: false
};

if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
  Platform.isApp = true;
  Platform.isWeb = false;
  Platform.isAndroid = window.Capacitor.getPlatform() === 'android';
  Platform.isIOS = window.Capacitor.getPlatform() === 'ios';
}
```

## 入口文件

### Web 入口（index.html）

```html
<script src="shared/platform.js"></script>
<script src="shared/storage.js"></script>
<script src="shared/haptics.js"></script>
<script src="geometry.js"></script>
<script src="renderer.js"></script>
<script src="game.js"></script>
```

### App 入口（mobile/src/index.html）

```html
<script src="../../shared/platform.js"></script>
<script src="../../shared/storage.js"></script>
<script src="../../shared/haptics.js"></script>
<script src="../../geometry.js"></script>
<script src="../../renderer.js"></script>
<script src="../../game.js"></script>
```

## Capacitor 配置

```json
{
  "appId": "com.yourname.saolei",
  "appName": "多边形扫雷",
  "webDir": "src",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "SQLite": {
      "iosDatabaseLocation": "Library/CapacitorDatabase",
      "iosIsEncryption": false,
      "androidIsEncryption": false
    }
  }
}
```

## Android 签名

```bash
# 生成密钥
keytool -genkey -v -keystore saolei.keystore \
  -alias saolei -keyalg RSA -keysize 2048 -validity 10000

# 放置位置
mobile/keystore/saolei.keystore
```

## 文件改动清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `shared/platform.js` | 平台检测 |
| `shared/storage.js` | 存储抽象层 |
| `shared/haptics.js` | 震动抽象层 |
| `mobile/package.json` | Capacitor 依赖 |
| `mobile/capacitor.config.json` | Capacitor 配置 |
| `mobile/src/index.html` | App 入口 HTML |
| `mobile/keystore/saolei.keystore` | 签名密钥 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `game.js` | 引用 shared/ 模块，替换 navigator.vibrate() 调用 |
| `index.html` | 引用 shared/ 模块 |
| `.gitignore` | 忽略 mobile/node_modules/、mobile/android/、密钥文件 |

### 不改动文件

| 文件 | 原因 |
|------|------|
| `geometry.js` | 纯计算，无平台依赖 |
| `renderer.js` | SVG 渲染，无平台依赖 |
| `style.css` | 样式共享 |

## iOS 扩展说明

扩展 iOS 非常方便：

1. 代码零改动 — shared/ 抽象层已处理平台差异
2. 只需一条命令 — `npx cap add ios` 生成 iOS 项目
3. Haptics 已兼容 — Capacitor Haptics 在 iOS 上使用系统触感反馈

额外需求：Mac + Xcode + Apple 开发者账号（$99/年）
