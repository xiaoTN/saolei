const crypto = require('crypto');
const path = require('path');

const dotenv = require('dotenv');
const express = require('express');
const { Pool } = require('pg');

dotenv.config();

const port = Number(process.env.PORT || 8000);
const dbUrl = process.env.DATABASE_URL;
const ipHashSalt = process.env.IP_HASH_SALT || 'dev-only-change-me';

if (!dbUrl) {
    console.error('Missing DATABASE_URL. Copy .env.example to .env and set DATABASE_URL.');
    process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const app = express();

app.set('trust proxy', true);
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.resolve(__dirname, '..')));

function normalizeIp(ip) {
    if (!ip) return 'unknown';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
}

function hashIp(ip) {
    const normalized = normalizeIp(ip);
    return crypto.createHash('sha256').update(`${ipHashSalt}:${normalized}`).digest('hex');
}

function clampInt(value, min, max, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizeStartPayload(body) {
    return {
        clientSessionId: String(body.clientSessionId || '').slice(0, 128),
        boardRows: clampInt(body.boardRows, 1, 1000),
        boardCols: clampInt(body.boardCols, 1, 1000),
        sides: clampInt(body.sides, 3, 16),
        totalCells: clampInt(body.totalCells, 1, 1000000),
        totalMines: clampInt(body.totalMines, 1, 1000000),
        difficulty: typeof body.difficulty === 'string' ? body.difficulty.slice(0, 32) : null,
        deviceType: typeof body.deviceType === 'string' ? body.deviceType.slice(0, 32) : null,
        inputType: typeof body.inputType === 'string' ? body.inputType.slice(0, 32) : null,
        viewportWidth: clampInt(body.viewportWidth, 0, 20000),
        viewportHeight: clampInt(body.viewportHeight, 0, 20000),
        clientVersion: typeof body.clientVersion === 'string' ? body.clientVersion.slice(0, 64) : null,
    };
}

function sanitizeEndPayload(body) {
    const status = ['win', 'lose', 'abandon'].includes(body.result) ? body.result : 'abandon';
    return {
        status,
        durationSeconds: clampInt(body.durationSeconds, 0, 60 * 60 * 24),
        firstActionMs: clampInt(body.firstActionMs, 0, 60 * 60 * 1000),
        revealedCount: clampInt(body.revealedCount, 0, 1000000),
        flagCount: clampInt(body.flagCount, 0, 1000000),
        minesClearedCount: clampInt(body.minesClearedCount, 0, 1000000),
        actionsTotal: clampInt(body.actionsTotal, 0, 1000000),
        leftClicks: clampInt(body.leftClicks, 0, 1000000),
        rightClicks: clampInt(body.rightClicks, 0, 1000000),
        longPressCount: clampInt(body.longPressCount, 0, 1000000),
        chordCount: clampInt(body.chordCount, 0, 1000000),
        extra: body.extra && typeof body.extra === 'object' ? body.extra : {},
    };
}

app.get('/api/health', async (_, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true, serverTime: new Date().toISOString() });
    } catch (error) {
        console.error('health check failed', error);
        res.status(500).json({ ok: false });
    }
});

app.post('/api/sessions/start', async (req, res) => {
    try {
        const data = sanitizeStartPayload(req.body || {});
        if (!data.clientSessionId) {
            return res.status(400).json({ ok: false, error: 'clientSessionId is required' });
        }

        const ipHash = hashIp(req.ip);
        const ua = String(req.get('user-agent') || '').slice(0, 512);

        const result = await pool.query(
            `INSERT INTO game_sessions (
                ip_hash, client_session_id, board_rows, board_cols, sides,
                total_cells, total_mines, difficulty, device_type, input_type,
                viewport_width, viewport_height, user_agent, client_version
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14
             )
             RETURNING id, started_at`,
            [
                ipHash,
                data.clientSessionId,
                data.boardRows,
                data.boardCols,
                data.sides,
                data.totalCells,
                data.totalMines,
                data.difficulty,
                data.deviceType,
                data.inputType,
                data.viewportWidth,
                data.viewportHeight,
                ua,
                data.clientVersion,
            ]
        );

        return res.json({
            ok: true,
            gameId: result.rows[0].id,
            startedAt: result.rows[0].started_at,
        });
    } catch (error) {
        console.error('failed to start session', error);
        return res.status(500).json({ ok: false, error: 'internal_error' });
    }
});

app.post('/api/sessions/:gameId/end', async (req, res) => {
    try {
        const gameId = String(req.params.gameId || '');
        if (!gameId) return res.status(400).json({ ok: false, error: 'gameId is required' });

        const data = sanitizeEndPayload(req.body || {});
        const ipHash = hashIp(req.ip);

        const result = await pool.query(
            `UPDATE game_sessions
             SET
                status = $1,
                result = $1,
                ended_at = COALESCE(ended_at, NOW()),
                duration_seconds = $2,
                first_action_ms = $3,
                revealed_count = $4,
                flag_count = $5,
                mines_cleared_count = $6,
                actions_total = $7,
                left_clicks = $8,
                right_clicks = $9,
                long_press_count = $10,
                chord_count = $11,
                extra = $12::jsonb
             WHERE id = $13 AND ip_hash = $14
             RETURNING id`,
            [
                data.status,
                data.durationSeconds,
                data.firstActionMs,
                data.revealedCount,
                data.flagCount,
                data.minesClearedCount,
                data.actionsTotal,
                data.leftClicks,
                data.rightClicks,
                data.longPressCount,
                data.chordCount,
                JSON.stringify(data.extra),
                gameId,
                ipHash,
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, error: 'session_not_found' });
        }

        return res.json({ ok: true });
    } catch (error) {
        console.error('failed to end session', error);
        return res.status(500).json({ ok: false, error: 'internal_error' });
    }
});

app.post('/api/sessions/:gameId/events', async (req, res) => {
    try {
        const gameId = String(req.params.gameId || '');
        if (!gameId) return res.status(400).json({ ok: false, error: 'gameId is required' });

        const eventType = typeof req.body?.eventType === 'string' ? req.body.eventType.slice(0, 64) : '';
        const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
        if (!eventType) return res.status(400).json({ ok: false, error: 'eventType is required' });

        await pool.query(
            'INSERT INTO game_events (game_id, event_type, payload) VALUES ($1, $2, $3::jsonb)',
            [gameId, eventType, JSON.stringify(payload)]
        );

        return res.json({ ok: true });
    } catch (error) {
        console.error('failed to insert event', error);
        return res.status(500).json({ ok: false, error: 'internal_error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://127.0.0.1:${port}`);
});
