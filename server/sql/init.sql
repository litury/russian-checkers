CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('device','email')),
  token_hash TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_device_hash ON auth_identities (token_hash) WHERE kind = 'device';
CREATE UNIQUE INDEX IF NOT EXISTS auth_email ON auth_identities (email) WHERE kind = 'email';

CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('bot', 'online')),
  white_id UUID REFERENCES players(id),
  black_id UUID REFERENCES players(id),
  winner TEXT CHECK (winner IN ('white', 'black', 'draw')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_plies (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  ply INT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('white', 'black')),
  from_sq TEXT NOT NULL,
  path TEXT NOT NULL,
  PRIMARY KEY (match_id, ply)
);
