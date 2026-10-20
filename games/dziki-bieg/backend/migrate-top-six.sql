-- Run after schema.sql and again after both origins use the new worker.
-- Leave the legacy table intact for a safe rollout and historical recovery.
INSERT INTO leaderboard_entries(id,nickname,score,created_at)
SELECT id,nickname,score,created_at FROM scores WHERE 1
ON CONFLICT(id) DO NOTHING;
