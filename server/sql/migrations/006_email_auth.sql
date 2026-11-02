CREATE UNIQUE INDEX IF NOT EXISTS auth_email_player ON auth_identities (player_id) WHERE kind = 'email';

CREATE TABLE IF NOT EXISTS email_challenges (
  id UUID PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_id UUID REFERENCES players(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('link', 'login')),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_challenges_requester ON email_challenges (requester_id);
CREATE INDEX IF NOT EXISTS email_challenges_expiry ON email_challenges (expires_at);

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY REFERENCES email_challenges(id) ON DELETE CASCADE,
  payload TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed', 'expired')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  provider_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_outbox_pending ON email_outbox (available_at) WHERE state IN ('pending', 'sending');

CREATE TABLE IF NOT EXISTS email_rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS email_rate_limits_expiry ON email_rate_limits (expires_at);
