CREATE TABLE IF NOT EXISTS leaderboard_entries (
 id TEXT PRIMARY KEY,
 nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 40),
 score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 9007199254740991),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leaderboard_order ON leaderboard_entries(score DESC,created_at ASC,id ASC);
CREATE TABLE IF NOT EXISTS leaderboard_stats (singleton INTEGER PRIMARY KEY CHECK(singleton=1),entries INTEGER NOT NULL);
INSERT OR IGNORE INTO leaderboard_stats VALUES(1,0);
CREATE TABLE IF NOT EXISTS leaderboard_buckets (bucket INTEGER PRIMARY KEY,entries INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS leaderboard_insert AFTER INSERT ON leaderboard_entries BEGIN
 UPDATE leaderboard_stats SET entries=entries+1 WHERE singleton=1;
 INSERT INTO leaderboard_buckets VALUES(CAST(NEW.score/1000 AS INTEGER),1) ON CONFLICT(bucket) DO UPDATE SET entries=entries+1;
 DELETE FROM leaderboard_entries WHERE id=(SELECT id FROM leaderboard_entries ORDER BY score ASC,created_at DESC,id DESC LIMIT 1)
 AND (SELECT entries FROM leaderboard_stats WHERE singleton=1)>1000000;
END;
CREATE TRIGGER IF NOT EXISTS leaderboard_delete AFTER DELETE ON leaderboard_entries BEGIN
 UPDATE leaderboard_stats SET entries=entries-1 WHERE singleton=1;
 UPDATE leaderboard_buckets SET entries=entries-1 WHERE bucket=CAST(OLD.score/1000 AS INTEGER);
 DELETE FROM leaderboard_buckets WHERE bucket=CAST(OLD.score/1000 AS INTEGER) AND entries=0;
END;
