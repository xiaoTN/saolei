#!/bin/bash
# 同步根目录游戏文件到 mobile/src/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_SRC="$SCRIPT_DIR/../src"
ROOT_DIR="$SCRIPT_DIR/../.."

# 复制核心文件
cp "$ROOT_DIR/style.css" "$MOBILE_SRC/"
cp "$ROOT_DIR/geometry.js" "$MOBILE_SRC/"
cp "$ROOT_DIR/renderer.js" "$MOBILE_SRC/"
cp "$ROOT_DIR/game.js" "$MOBILE_SRC/"
cp "$ROOT_DIR/multiplayer.js" "$MOBILE_SRC/"

# 复制 shared 目录（先删除再复制，确保无遗留旧文件）
rm -rf "$MOBILE_SRC/shared" && cp -r "$ROOT_DIR/shared" "$MOBILE_SRC/"

echo "Assets synced to mobile/src/"
