# Capacitor 移动端适配实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将多边形扫雷 Web 游戏转换为 Android App，使用 Capacitor 跨平台方案。

**Architecture:** 创建 shared/ 抽象层隔离平台差异（存储、震动、平台检测），mobile/ 目录存放 Capacitor 项目配置，现有游戏代码通过抽象层实现 Web/App 双平台兼容。

**Tech Stack:** Capacitor 6, @capacitor/preferences, @capacitor-community/sqlite, @capacitor/haptics

---

## Task 1: 创建平台检测模块

**Files:**
- Create: `shared/platform.js`

**Step 1: 创建 shared 目录和 platform.js**

```javascript
// shared/platform.js
// 平台检测模块：区分 Web 和 App 环境

const Platform = {
    isApp: false,
    isWeb: true,
    isAndroid: false,
    isIOS: false
};

// Capacitor 启动后会注入 window.Capacitor
if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    Platform.isApp = true;
    Platform.isWeb = false;
    Platform.isAndroid = window.Capacitor.getPlatform() === 'android';
    Platform.isIOS = window.Capacitor.getPlatform() === 'ios';
}

// 导出到全局（兼容现有非模块化代码）
window.Platform = Platform;
```

**Step 2: 验证 Web 端正常**

Run: `python3 -m http.server 8000`
打开: http://127.0.0.1:8000/
打开浏览器控制台，输入: `Platform`
Expected: `{ isApp: false, isWeb: true, isAndroid: false, isIOS: false }`

**Step 3: Commit**

```bash
git add shared/platform.js
git commit -m "feat: 添加平台检测模块"
```

---

## Task 2: 创建震动抽象层

**Files:**
- Create: `shared/haptics.js`

**Step 1: 创建震动抽象层**

```javascript
// shared/haptics.js
// 震动抽象层：Web 用 navigator.vibrate，App 用 Capacitor Haptics

const HapticsAdapter = {
    _ready: false,
    _haptics: null,

    async init() {
        if (window.Platform && window.Platform.isApp) {
            try {
                // 动态加载 Capacitor Haptics（仅 App 环境）
                const module = await import('../mobile/node_modules/@capacitor/haptics/dist/esm/index.js');
                this._haptics = module.Haptics;
                this._ready = true;
            } catch (e) {
                console.warn('Haptics not available:', e);
            }
        } else {
            this._ready = true;
        }
    },

    // 开格成功 - 短震动
    async light() {
        if (!this._ready) return;
        if (window.Platform && window.Platform.isApp && this._haptics) {
            await this._haptics.impact({ style: 'Light' });
        } else if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    },

    // 标旗 - 轻震
    async tick() {
        if (!this._ready) return;
        if (window.Platform && window.Platform.isApp && this._haptics) {
            await this._haptics.impact({ style: 'Light' });
        } else if (navigator.vibrate) {
            navigator.vibrate(15);
        }
    },

    // 踩雷 - 强震动
    async error() {
        if (!this._ready) return;
        if (window.Platform && window.Platform.isApp && this._haptics) {
            await this._haptics.notification({ type: 'Error' });
        } else if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    }
};

// 导出到全局
window.HapticsAdapter = HapticsAdapter;
```

**Step 2: 验证 Web 端震动正常**

Run: `python3 -m http.server 8000`
打开浏览器控制台，输入: `HapticsAdapter.light()`
Expected: 无报错（移动端浏览器会有震动）

**Step 3: Commit**

```bash
git add shared/haptics.js
git commit -m "feat: 添加震动抽象层"
```

---

## Task 3: 创建存储抽象层（Web 实现）

**Files:**
- Create: `shared/storage.js`

**Step 1: 创建存储抽象层**

```javascript
// shared/storage.js
// 存储抽象层：Web 用 localStorage，App 用 Preferences + SQLite

const StorageAdapter = {
    _ready: false,
    _preferences: null,
    _sqlite: null,
    _db: null,

    async init() {
        if (window.Platform && window.Platform.isApp) {
            // App 端初始化（后续 Task 实现）
            // 暂时 fallback 到 localStorage
            this._ready = true;
        } else {
            // Web 端：直接使用 localStorage
            this._ready = true;
        }
    },

    // === 设置存储 ===
    async saveSettings(settings) {
        if (!this._ready) return;
        const data = JSON.stringify(settings);
        localStorage.setItem('saolei_settings', data);
    },

    async loadSettings() {
        if (!this._ready) return null;
        const data = localStorage.getItem('saolei_settings');
        return data ? JSON.parse(data) : null;
    },

    // === 统计数据 ===
    async saveStats(stats) {
        if (!this._ready) return;
        const data = JSON.stringify(stats);
        localStorage.setItem('saolei_stats', data);
    },

    async loadStats() {
        if (!this._ready) return null;
        const data = localStorage.getItem('saolei_stats');
        return data ? JSON.parse(data) : null;
    },

    // === 对局记录 ===
    // Web 端只保留最近 20 局
    async saveGameRecord(record) {
        if (!this._ready) return;
        const data = localStorage.getItem('saolei_history');
        let history = data ? JSON.parse(data) : [];
        history.unshift(record);
        if (history.length > 20) history = history.slice(0, 20);
        localStorage.setItem('saolei_history', JSON.stringify(history));
    },

    async loadGameHistory(limit = 20, offset = 0) {
        if (!this._ready) return [];
        const data = localStorage.getItem('saolei_history');
        const history = data ? JSON.parse(data) : [];
        return history.slice(offset, offset + limit);
    },

    async deleteGameHistory() {
        localStorage.removeItem('saolei_history');
    }
};

// 导出到全局
window.StorageAdapter = StorageAdapter;
```

**Step 2: 验证 Web 端存储正常**

打开浏览器控制台：
```javascript
StorageAdapter.saveSettings({sides: 4, difficulty: 'medium'})
StorageAdapter.loadSettings()
```
Expected: 返回 `{sides: 4, difficulty: 'medium'}`

**Step 3: Commit**

```bash
git add shared/storage.js
git commit -m "feat: 添加存储抽象层（Web 实现）"
```

---

## Task 4: 修改 game.js 使用抽象层

**Files:**
- Modify: `game.js`

**Step 1: 替换 vibrate 函数**

找到 game.js 第 8-10 行的 vibrate 函数，替换为：

```javascript
// ─── 工具函数 ──────────────────────────────────────────────────

// 震动功能已迁移到 shared/haptics.js
// 保留此函数作为兼容层
function vibrate(pattern) {
    if (window.HapticsAdapter) {
        // 根据参数判断震动类型
        if (Array.isArray(pattern)) {
            HapticsAdapter.error();
        } else if (pattern <= 20) {
            HapticsAdapter.tick();
        } else {
            HapticsAdapter.light();
        }
    } else if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}
```

**Step 2: 验证游戏震动正常**

Run: `python3 -m http.server 8000`
玩一局游戏，点击格子标旗、开格
Expected: 震动正常（移动端浏览器）

**Step 3: Commit**

```bash
git add game.js
git commit -m "refactor: game.js 使用震动抽象层"
```

---

## Task 5: 修改 index.html 引入 shared 模块

**Files:**
- Modify: `index.html`

**Step 1: 在 script 标签前添加 shared 模块**

找到 index.html 第 65-68 行的 script 标签，修改为：

```html
    <!-- 加载顺序：platform → storage → haptics → geometry → renderer → game -->
    <script src="shared/platform.js?v=20260308a"></script>
    <script src="shared/storage.js?v=20260308a"></script>
    <script src="shared/haptics.js?v=20260308a"></script>
    <script src="geometry.js?v=20260225b"></script>
    <script src="renderer.js?v=20260226a"></script>
    <script src="game.js?v=20260308a"></script>
```

**Step 2: 验证 Web 端正常**

Run: `python3 -m http.server 8000`
打开 http://127.0.0.1:8000/
Expected: 游戏正常加载，控制台无报错

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: index.html 引入 shared 模块"
```

---

## Task 6: 创建 Capacitor 项目

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/capacitor.config.json`

**Step 1: 创建 mobile 目录和 package.json**

```bash
mkdir -p mobile/src
```

`mobile/package.json`:
```json
{
  "name": "saolei-mobile",
  "version": "1.0.0",
  "description": "多边形扫雷移动端",
  "main": "index.js",
  "scripts": {
    "build": "echo 'No build step needed' && exit 0",
    "sync": "npx cap sync",
    "android": "npx cap open android",
    "ios": "npx cap open ios"
  },
  "dependencies": {
    "@capacitor/android": "^6.0.0",
    "@capacitor/core": "^6.0.0",
    "@capacitor/haptics": "^6.0.0",
    "@capacitor/preferences": "^6.0.0",
    "@capacitor-community/sqlite": "^6.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^6.0.0"
  }
}
```

**Step 2: 创建 capacitor.config.json**

`mobile/capacitor.config.json`:
```json
{
  "appId": "com.saolei.app",
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

**Step 3: Commit**

```bash
git add mobile/package.json mobile/capacitor.config.json
git commit -m "feat: 创建 Capacitor 项目配置"
```

---

## Task 7: 创建 App 入口 HTML

**Files:**
- Create: `mobile/src/index.html`

**Step 1: 创建 App 入口文件**

`mobile/src/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>多边形扫雷</title>
    <link rel="stylesheet" href="../../style.css">
    <style>
        /* App 专用样式调整 */
        body {
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💣 多边形扫雷</h1>

        <div class="settings">
            <div class="shape-row">
                <button class="side-btn" data-sides="3" onclick="selectSides(3)">3边</button>
                <button class="side-btn selected" data-sides="4" onclick="selectSides(4)">4边</button>
                <button class="side-btn" data-sides="6" onclick="selectSides(6)">6边</button>
                <button class="side-btn" data-sides="8" onclick="selectSides(8)">8+4</button>
            </div>
            <div class="difficulty-row">
                <button class="diff-btn" data-diff="easy"   onclick="selectDifficulty('easy')">简单</button>
                <button class="diff-btn selected" data-diff="medium" onclick="selectDifficulty('medium')">中等</button>
                <button class="diff-btn" data-diff="hard"   onclick="selectDifficulty('hard')">困难</button>
                <button class="diff-btn" data-diff="hell"   onclick="selectDifficulty('hell')">地狱</button>
                <button class="diff-btn" data-diff="custom" onclick="selectDifficulty('custom')">自定义</button>
            </div>
            <div class="custom-settings" id="customSettings" style="display:none">
                <div class="setting-item slider-item">
                    <label>行数: <span id="rows-val">10</span></label>
                    <input type="range" id="rows" value="10" min="3" max="100"
                           oninput="document.getElementById('rows-val').textContent=this.value; previewBoardSize()">
                </div>
                <div class="setting-item slider-item">
                    <label>列数: <span id="cols-val">10</span></label>
                    <input type="range" id="cols" value="10" min="3" max="100"
                           oninput="document.getElementById('cols-val').textContent=this.value; previewBoardSize()">
                </div>
                <div class="setting-item slider-item">
                    <label>雷数: <span id="mines-val">20</span></label>
                    <input type="range" id="mines" value="20" min="1" max="2500"
                           oninput="document.getElementById('mines-val').textContent=this.value; previewMineCount()">
                </div>
            </div>
            <button onclick="initGame()">开始游戏</button>
        </div>

        <div class="status-bar">
            <div class="status-item">格子数: <span id="cellCount">64</span></div>
            <div class="status-item">雷占比: <span id="mineRatio">—</span></div>
            <div class="status-item">标记: <span id="flagProgress">0</span> / <span id="totalMinesDisplay">10</span></div>
            <div class="status-item">用时: <span id="timer">0</span>秒</div>
        </div>

        <div class="game-area">
            <div class="board-viewport" id="boardViewport">
                <div class="game-board" id="board"></div>
            </div>
        </div>

        <div class="message" id="message"></div>

        <div class="tips">单击标记地雷 🚩，右键 / 长按打开格子</div>
    </div>

    <!-- 加载顺序：platform → storage → haptics → geometry → renderer → game -->
    <script src="../../shared/platform.js"></script>
    <script src="../../shared/storage.js"></script>
    <script src="../../shared/haptics.js"></script>
    <script src="../../geometry.js"></script>
    <script src="../../renderer.js"></script>
    <script src="../../game.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add mobile/src/index.html
git commit -m "feat: 创建 App 入口 HTML"
```

---

## Task 8: 安装依赖并添加 Android 平台

**Files:**
- Generate: `mobile/android/` (自动生成)
- Modify: `.gitignore`

**Step 1: 安装 npm 依赖**

```bash
cd mobile && npm install
```

Expected: 依赖安装成功，生成 node_modules/

**Step 2: 添加 Android 平台**

```bash
cd mobile && npx cap add android
```

Expected: 生成 android/ 目录

**Step 3: 更新 .gitignore**

添加到 `.gitignore`:
```
# Capacitor
mobile/node_modules/
mobile/android/
mobile/ios/

# 签名密钥（不要提交）
*.keystore
mobile/keystore/
```

**Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: 更新 gitignore 忽略 Capacitor 生成文件"
```

---

## Task 9: 实现 App 端存储（SQLite）

**Files:**
- Modify: `shared/storage.js`

**Step 1: 更新存储抽象层支持 SQLite**

更新 `shared/storage.js`，在 `init()` 方法中添加 SQLite 初始化：

```javascript
// shared/storage.js
// 存储抽象层：Web 用 localStorage，App 用 Preferences + SQLite

const StorageAdapter = {
    _ready: false,
    _preferences: null,
    _sqlite: null,
    _db: null,
    _isApp: false,

    async init() {
        this._isApp = window.Platform && window.Platform.isApp;

        if (this._isApp) {
            try {
                // 动态加载 Capacitor 插件
                const prefModule = await import('@capacitor/preferences');
                this._preferences = prefModule.Preferences;

                const sqliteModule = await import('@capacitor-community/sqlite');
                this._sqlite = sqliteModule.CapacitorSQLite;

                // 初始化数据库
                await this._sqlite.createConnection({
                    database: 'saolei_db',
                    version: 1
                });
                await this._sqlite.open({ database: 'saolei_db' });

                // 创建表
                await this._sqlite.execute({
                    database: 'saolei_db',
                    statements: `
                        CREATE TABLE IF NOT EXISTS game_records (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            board_type TEXT,
                            rows INTEGER,
                            cols INTEGER,
                            mines INTEGER,
                            result TEXT,
                            duration_seconds INTEGER,
                            revealed_count INTEGER,
                            flagged_count INTEGER,
                            played_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                    `
                });

                console.log('SQLite initialized');
            } catch (e) {
                console.warn('SQLite init failed, fallback to localStorage:', e);
            }
        }
        this._ready = true;
    },

    // === 设置存储 ===
    async saveSettings(settings) {
        if (!this._ready) return;
        const data = JSON.stringify(settings);
        if (this._isApp && this._preferences) {
            await this._preferences.set({ key: 'saolei_settings', value: data });
        } else {
            localStorage.setItem('saolei_settings', data);
        }
    },

    async loadSettings() {
        if (!this._ready) return null;
        if (this._isApp && this._preferences) {
            const { value } = await this._preferences.get({ key: 'saolei_settings' });
            return value ? JSON.parse(value) : null;
        } else {
            const data = localStorage.getItem('saolei_settings');
            return data ? JSON.parse(data) : null;
        }
    },

    // === 统计数据 ===
    async saveStats(stats) {
        if (!this._ready) return;
        const data = JSON.stringify(stats);
        if (this._isApp && this._preferences) {
            await this._preferences.set({ key: 'saolei_stats', value: data });
        } else {
            localStorage.setItem('saolei_stats', data);
        }
    },

    async loadStats() {
        if (!this._ready) return null;
        if (this._isApp && this._preferences) {
            const { value } = await this._preferences.get({ key: 'saolei_stats' });
            return value ? JSON.parse(value) : null;
        } else {
            const data = localStorage.getItem('saolei_stats');
            return data ? JSON.parse(data) : null;
        }
    },

    // === 对局记录 ===
    async saveGameRecord(record) {
        if (!this._ready) return;

        if (this._isApp && this._sqlite) {
            await this._sqlite.run({
                database: 'saolei_db',
                statement: `
                    INSERT INTO game_records
                    (board_type, rows, cols, mines, result, duration_seconds, revealed_count, flagged_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                values: [
                    record.boardType,
                    record.rows,
                    record.cols,
                    record.mines,
                    record.result,
                    record.durationSeconds,
                    record.revealedCount,
                    record.flaggedCount
                ]
            });
        } else {
            // Web 端：只保留最近 20 局
            const data = localStorage.getItem('saolei_history');
            let history = data ? JSON.parse(data) : [];
            history.unshift(record);
            if (history.length > 20) history = history.slice(0, 20);
            localStorage.setItem('saolei_history', JSON.stringify(history));
        }
    },

    async loadGameHistory(limit = 20, offset = 0) {
        if (!this._ready) return [];

        if (this._isApp && this._sqlite) {
            const result = await this._sqlite.query({
                database: 'saolei_db',
                statement: `
                    SELECT * FROM game_records
                    ORDER BY played_at DESC
                    LIMIT ? OFFSET ?
                `,
                values: [limit, offset]
            });
            return result.values || [];
        } else {
            const data = localStorage.getItem('saolei_history');
            const history = data ? JSON.parse(data) : [];
            return history.slice(offset, offset + limit);
        }
    },

    async deleteGameHistory() {
        if (this._isApp && this._sqlite) {
            await this._sqlite.execute({
                database: 'saolei_db',
                statements: 'DELETE FROM game_records'
            });
        } else {
            localStorage.removeItem('saolei_history');
        }
    }
};

// 导出到全局
window.StorageAdapter = StorageAdapter;
```

**Step 2: Commit**

```bash
git add shared/storage.js
git commit -m "feat: 存储抽象层支持 SQLite"
```

---

## Task 10: 生成 Android 签名密钥

**Files:**
- Generate: `mobile/keystore/saolei.keystore`

**Step 1: 创建 keystore 目录并生成密钥**

```bash
mkdir -p mobile/keystore
keytool -genkey -v -keystore mobile/keystore/saolei.keystore \
  -alias saolei -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_STORE_PASSWORD -keypass YOUR_KEY_PASSWORD \
  -dname "CN=Saolei, OU=Game, O=Saolei, L=Unknown, ST=Unknown, C=CN"
```

注意：请替换 `YOUR_STORE_PASSWORD` 和 `YOUR_KEY_PASSWORD` 为你自己的密码，并妥善保管。

**Step 2: 创建签名配置文件**

`mobile/keystore/keystore.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=saolei
storeFile=keystore/saolei.keystore
```

**注意：** keystore.properties 和 .keystore 文件已在 .gitignore 中，不会被提交。

---

## Task 11: 同步并构建 Android 项目

**Step 1: 同步 Web 资源到 Android**

```bash
cd mobile
npx cap sync android
```

Expected: 资源同步成功

**Step 2: 配置 Android 签名**

编辑 `mobile/android/app/build.gradle`，在 `android` 块中添加：

```gradle
// 在文件顶部添加
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... 现有配置 ...

    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

**Step 3: 复制签名配置到 Android 项目**

```bash
cp mobile/keystore/keystore.properties mobile/android/
```

**Step 4: 构建 APK**

```bash
cd mobile
npx cap open android
```

在 Android Studio 中：
1. Build → Generate Signed Bundle / APK
2. 选择 APK
3. Build → Make Bundle(s) / APK(s) → Build APK(s)

或者使用命令行：
```bash
cd mobile/android
./gradlew assembleRelease
```

APK 输出位置: `mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## Task 12: 最终验证

**Step 1: Web 端验证**

```bash
python3 -m http.server 8000
```
打开 http://127.0.0.1:8000/
- 游戏正常加载
- 设置、统计存储正常
- 震动正常

**Step 2: Android 端验证**

安装 APK 到测试设备：
```bash
adb install mobile/android/app/build/outputs/apk/release/app-release.apk
```

验证：
- App 正常启动
- 游戏可正常进行
- 震动反馈正常
- 对局记录保存正常（关闭 App 再打开数据仍存在）

**Step 3: Commit 最终状态**

```bash
git add -A
git commit -m "feat: Capacitor Android 适配完成"
```

---

## 文件清单

### 新建文件
| 文件 | 说明 |
|------|------|
| `shared/platform.js` | 平台检测 |
| `shared/haptics.js` | 震动抽象层 |
| `shared/storage.js` | 存储抽象层 |
| `mobile/package.json` | Capacitor 依赖 |
| `mobile/capacitor.config.json` | Capacitor 配置 |
| `mobile/src/index.html` | App 入口 |
| `mobile/keystore/saolei.keystore` | 签名密钥（不提交） |
| `mobile/keystore/keystore.properties` | 签名配置（不提交） |

### 修改文件
| 文件 | 改动 |
|------|------|
| `game.js` | 使用 HapticsAdapter |
| `index.html` | 引入 shared 模块 |
| `.gitignore` | 忽略生成文件和密钥 |

### 自动生成（不提交）
| 目录/文件 | 说明 |
|-----------|------|
| `mobile/node_modules/` | npm 依赖 |
| `mobile/android/` | Android 原生项目 |
| `mobile/ios/` | iOS 原生项目（未来） |
