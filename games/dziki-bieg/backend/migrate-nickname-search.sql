-- For an existing leaderboard, before deploying the nickname-search worker.
-- Skip ALTER if PRAGMA table_info(leaderboard_entries) already contains nickname_key.
ALTER TABLE leaderboard_entries ADD COLUMN nickname_key TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS leaderboard_nicknames ON leaderboard_entries(nickname_key,score DESC,created_at ASC,id ASC);
-- Backfill nickname_key in bounded batches using the worker's Unicode folding:
-- nickname.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replaceAll('ł','l').
-- Keep original nicknames, scores, IDs and timestamps intact.
