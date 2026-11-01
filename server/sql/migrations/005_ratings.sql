ALTER TABLE matches ADD COLUMN IF NOT EXISTS rated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS rating_changes JSONB;

CREATE TABLE IF NOT EXISTS player_ratings (
  player_id UUID PRIMARY KEY REFERENCES players(id),
  rating DOUBLE PRECISION NOT NULL DEFAULT 1500,
  deviation DOUBLE PRECISION NOT NULL DEFAULT 350 CHECK (deviation > 0),
  volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06 CHECK (volatility > 0),
  games INTEGER NOT NULL DEFAULT 0 CHECK (games >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rating_ledger (
  match_id UUID NOT NULL REFERENCES matches(id),
  player_id UUID NOT NULL REFERENCES players(id),
  opponent_id UUID NOT NULL REFERENCES players(id),
  algorithm TEXT NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  score DOUBLE PRECISION NOT NULL CHECK (score IN (0, 0.5, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);
