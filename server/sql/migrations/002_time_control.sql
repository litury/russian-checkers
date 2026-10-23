ALTER TABLE matches
  ADD COLUMN time_control TEXT NOT NULL DEFAULT '1+0'
  CHECK (time_control IN ('1+0', '1+1', '3+2', '5+3'));
