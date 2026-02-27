# 后端最小接入说明（Python）

## 1) 安装依赖

建议使用虚拟环境：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) 准备 PostgreSQL 数据库

先创建数据库（示例名 `minesweeper`），再执行建表脚本：

```bash
psql "$DATABASE_URL" -f server/sql/schema.sql
```

## 3) 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少设置：
# DATABASE_URL=postgresql://...
# IP_HASH_SALT=随机长字符串
```

## 4) 启动

```bash
python3 server/app.py
```

默认会在 `http://127.0.0.1:8000` 提供：
- 静态页面（当前扫雷前端）
- API 接口：
  - `GET /api/health`
  - `POST /api/sessions/start`
  - `POST /api/sessions/<gameId>/end`
  - `POST /api/sessions/<gameId>/events`

## 5) 当前前端已上报的数据

- 开局参数：行列、边数、总格子、总雷数、难度
- 局结束：胜/负/中断、用时、已开格、标旗数、排雷数
- 行为计数：左键、右键、长按、chord
- 环境：设备类型、输入类型、视口尺寸、客户端版本
