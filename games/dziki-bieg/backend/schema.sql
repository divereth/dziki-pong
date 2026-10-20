CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 40),
  score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 10000000),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS score_ranking ON scores(score DESC,created_at ASC,id ASC);
