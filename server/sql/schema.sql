CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS game_events;
DROP TABLE IF EXISTS game_sessions;

CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_hash TEXT NOT NULL,
    client_session_id TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'in_progress' CHECK (result IN ('in_progress', 'win', 'lose', 'abandon')),

    board_rows INTEGER NOT NULL,
    board_cols INTEGER NOT NULL,
    total_cells INTEGER NOT NULL,
    total_mines INTEGER NOT NULL,

    duration_seconds INTEGER,
    revealed_cells INTEGER NOT NULL DEFAULT 0,
    mines_cleared INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_ip_hash ON game_sessions(ip_hash);
CREATE INDEX IF NOT EXISTS idx_game_sessions_result ON game_sessions(result);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_sessions_updated_at ON game_sessions;

CREATE TRIGGER trg_game_sessions_updated_at
BEFORE UPDATE ON game_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
