#!/bin/bash
cd "$(dirname "$0")"
echo "正在终止旧进程..."
pkill -f "node server.js" 2>/dev/null
sleep 1
echo "启动 server.js..."
node server.js
