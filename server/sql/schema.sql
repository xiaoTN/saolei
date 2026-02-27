CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_hash TEXT NOT NULL,
    client_session_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'win', 'lose', 'abandon')),
    result TEXT CHECK (result IN ('win', 'lose', 'abandon')),

    board_rows INTEGER NOT NULL,
    board_cols INTEGER NOT NULL,
    sides SMALLINT NOT NULL,
    total_cells INTEGER NOT NULL,
    total_mines INTEGER NOT NULL,
    difficulty TEXT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    first_action_ms INTEGER,

    revealed_count INTEGER NOT NULL DEFAULT 0,
    flag_count INTEGER NOT NULL DEFAULT 0,
    mines_cleared_count INTEGER NOT NULL DEFAULT 0,

    actions_total INTEGER NOT NULL DEFAULT 0,
    left_clicks INTEGER NOT NULL DEFAULT 0,
    right_clicks INTEGER NOT NULL DEFAULT 0,
    long_press_count INTEGER NOT NULL DEFAULT 0,
    chord_count INTEGER NOT NULL DEFAULT 0,

    device_type TEXT,
    input_type TEXT,
    viewport_width INTEGER,
    viewport_height INTEGER,
    user_agent TEXT,
    client_version TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_ip_hash ON game_sessions(ip_hash);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);

CREATE TABLE IF NOT EXISTS game_events (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id);
CREATE INDEX IF NOT EXISTS idx_game_events_created_at ON game_events(created_at DESC);

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
