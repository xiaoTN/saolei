import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
import psycopg

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent
PORT = int(os.getenv('PORT', '8000'))
DATABASE_URL = os.getenv('DATABASE_URL')
IP_HASH_SALT = os.getenv('IP_HASH_SALT', 'dev-only-change-me')

if not DATABASE_URL:
    raise RuntimeError('Missing DATABASE_URL. Copy .env.example to .env and set DATABASE_URL.')

app = Flask(__name__, static_folder=str(ROOT_DIR), static_url_path='')


def normalize_ip(ip: str | None) -> str:
    if not ip:
        return 'unknown'
    if ip.startswith('::ffff:'):
        return ip[7:]
    return ip


def get_request_ip() -> str:
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return normalize_ip(forwarded.split(',')[0].strip())
    return normalize_ip(request.remote_addr)


def hash_ip(ip: str) -> str:
    plain = f'{IP_HASH_SALT}:{normalize_ip(ip)}'.encode('utf-8')
    return hashlib.sha256(plain).hexdigest()


def clamp_int(value, min_val: int, max_val: int, fallback: int = 0) -> int:
    if value is None or value == '':
        return fallback
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        return fallback
    return max(min_val, min(max_val, n))


def sanitize_start_payload(body: dict) -> dict:
    return {
        'client_session_id': str(body.get('clientSessionId', ''))[:128],
        'board_rows': clamp_int(body.get('boardRows'), 1, 1000),
        'board_cols': clamp_int(body.get('boardCols'), 1, 1000),
        'total_cells': clamp_int(body.get('totalCells'), 1, 1_000_000),
        'total_mines': clamp_int(body.get('totalMines'), 1, 1_000_000),
    }


def sanitize_end_payload(body: dict) -> dict:
    result = body.get('result')
    game_result = result if result in ('win', 'lose', 'abandon') else 'abandon'
    return {
        'result': game_result,
        'duration_seconds': clamp_int(body.get('durationSeconds'), 0, 60 * 60 * 24),
        'revealed_cells': clamp_int(body.get('revealedCount'), 0, 1_000_000),
        'mines_cleared': clamp_int(body.get('minesClearedCount'), 0, 1_000_000),
    }


def db_execute(query: str, params: tuple = (), fetchone: bool = False, fetchall: bool = False):
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            if fetchone:
                row = cur.fetchone()
                conn.commit()
                return row
            if fetchall:
                rows = cur.fetchall()
                conn.commit()
                return rows
        conn.commit()
    return None


@app.get('/api/health')
def api_health():
    try:
        db_execute('SELECT 1')
        return jsonify({'ok': True, 'serverTime': datetime.now(timezone.utc).isoformat()})
    except Exception:
        return jsonify({'ok': False}), 500


@app.post('/api/sessions/start')
def start_session():
    body = request.get_json(silent=True) or {}
    data = sanitize_start_payload(body)
    if not data['client_session_id']:
        return jsonify({'ok': False, 'error': 'clientSessionId is required'}), 400

    ip_hash = hash_ip(get_request_ip())
    query = """
        INSERT INTO game_sessions (
            ip_hash, client_session_id, board_rows, board_cols, total_cells, total_mines
        ) VALUES (
            %(ip_hash)s, %(client_session_id)s, %(board_rows)s, %(board_cols)s, %(total_cells)s, %(total_mines)s
        )
        RETURNING id, created_at
    """

    try:
        row = db_execute(
            query,
            {
                **data,
                'ip_hash': ip_hash,
            },
            fetchone=True,
        )
        return jsonify({'ok': True, 'gameId': str(row[0]), 'startedAt': row[1].isoformat()})
    except Exception:
        return jsonify({'ok': False, 'error': 'internal_error'}), 500


@app.post('/api/sessions/<game_id>/end')
def end_session(game_id: str):
    if not game_id:
        return jsonify({'ok': False, 'error': 'gameId is required'}), 400

    body = request.get_json(silent=True) or {}
    data = sanitize_end_payload(body)
    ip_hash = hash_ip(get_request_ip())

    query = """
        UPDATE game_sessions
        SET
            result = %(result)s,
            duration_seconds = %(duration_seconds)s,
            revealed_cells = %(revealed_cells)s,
            mines_cleared = %(mines_cleared)s
        WHERE id = %(game_id)s AND ip_hash = %(ip_hash)s
        RETURNING id
    """

    try:
        row = db_execute(
            query,
            {
                **data,
                'game_id': game_id,
                'ip_hash': ip_hash,
            },
            fetchone=True,
        )
        if not row:
            return jsonify({'ok': False, 'error': 'session_not_found'}), 404
        return jsonify({'ok': True})
    except Exception:
        return jsonify({'ok': False, 'error': 'internal_error'}), 500


@app.get('/')
def serve_index():
    return send_from_directory(ROOT_DIR, 'index.html')


@app.get('/<path:filename>')
def serve_static(filename: str):
    target = ROOT_DIR / filename
    if target.exists() and target.is_file():
        return send_from_directory(ROOT_DIR, filename)
    return ('Not Found', 404)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=PORT)
