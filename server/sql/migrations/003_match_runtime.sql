ALTER TABLE matches ADD COLUMN IF NOT EXISTS runtime JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS end_reason TEXT;
CREATE INDEX IF NOT EXISTS matches_active_runtime
  ON matches (started_at) WHERE ended_at IS NULL AND runtime IS NOT NULL;
