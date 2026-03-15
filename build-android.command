#!/bin/bash
# 双击此文件即可一键打包 Android APK 并安装到已连接的设备
# macOS: Finder 双击 .command 文件会在终端中运行

cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

echo "======================================"
echo "  多边形扫雷 - Android 一键打包"
echo "======================================"
echo ""

# 1. 语法检查
echo "▶ [1/4] 语法检查..."
node --check geometry.js renderer.js game.js multiplayer.js || {
    echo "❌ 语法检查失败，请修复后重试"
    read -p "按任意键退出..." key
    exit 1
}
echo "✅ 语法检查通过"
echo ""

# 2. 同步 web 资源
echo "▶ [2/4] 同步 web 资源到 mobile/src/..."
bash mobile/scripts/sync-assets.sh || {
    echo "❌ 资源同步失败"
    read -p "按任意键退出..." key
    exit 1
}

# 同步 index.html（以 web 版为准，保留 mobile head）
python3 - <<'PYEOF'
import re

with open("index.html", "r") as f:
    web = f.read()

with open("mobile/src/index.html", "r") as f:
    mobile = f.read()

# 提取 mobile 版的 <head>...</head>
head_match = re.search(r'<head>.*?</head>', mobile, re.DOTALL)
mobile_head = head_match.group(0) if head_match else None

# 提取 web 版的 <body>...</body>，去掉 ?v=xxx 缓存参数
body_match = re.search(r'<body>.*?</body>', web, re.DOTALL)
web_body = body_match.group(0) if body_match else None
web_body = re.sub(r'\?v=[^"]+', '', web_body)

if not mobile_head or not web_body:
    print("❌ index.html 解析失败")
    exit(1)

result = f'<!DOCTYPE html>\n<html lang="zh-CN">\n{mobile_head}\n{web_body}\n</html>\n'

with open("mobile/src/index.html", "w") as f:
    f.write(result)

print("✅ index.html 已同步")
PYEOF
echo ""

# 3. Capacitor sync
echo "▶ [3/4] Capacitor sync..."
(cd mobile && npx cap sync --inline 2>&1) || {
    echo "❌ Capacitor sync 失败"
    read -p "按任意键退出..." key
    exit 1
}
echo ""

# 4. 构建 APK
echo "▶ [4/4] 构建 Release APK..."
(cd mobile/android && ./gradlew assembleRelease 2>&1) || {
    echo "❌ Gradle 构建失败"
    read -p "按任意键退出..." key
    exit 1
}
echo ""

# 找到生成的 APK
APK_PATH=$(find mobile/android/app/build/outputs/apk/release -name "*.apk" | head -1)
if [ -z "$APK_PATH" ]; then
    echo "❌ 找不到生成的 APK 文件"
    read -p "按任意键退出..." key
    exit 1
fi

echo "======================================"
echo "✅ APK 构建成功！"
echo "   路径: $APK_PATH"
echo "======================================"
echo ""

# 检测已连接的 ADB 设备，自动安装
DEVICES=$(adb devices 2>/dev/null | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')
if [ "$DEVICES" -gt 0 ]; then
    echo "📱 检测到 $DEVICES 台设备，开始安装..."
    adb install -r "$APK_PATH" && echo "✅ 安装成功！" || echo "⚠️ 安装失败，请手动安装 APK"
else
    echo "ℹ️  未检测到 ADB 设备，请手动安装 APK："
    echo "   $ROOT_DIR/$APK_PATH"
    # 在 Finder 中高亮显示 APK 文件
    open -R "$ROOT_DIR/$APK_PATH" 2>/dev/null
fi

echo ""
read -p "按任意键关闭..." key
