CREATE TABLE IF NOT EXISTS complaints (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id   TEXT UNIQUE NOT NULL,
  session_id    TEXT NOT NULL,
  language      TEXT DEFAULT 'en',
  input_text    TEXT NOT NULL,
  issue_type    TEXT,
  department    TEXT,
  severity      TEXT,
  submit_to     TEXT,
  english_letter TEXT,
  urdu_letter   TEXT,
  summary       TEXT,
  status        TEXT DEFAULT 'filed',
  follow_up_sent INTEGER DEFAULT 0,
  email_encrypted TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id    TEXT PRIMARY KEY,
  created_at    TEXT DEFAULT (datetime('now')),
  complaint_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analysis_cache (
  cache_key     TEXT PRIMARY KEY,
  input_hash    TEXT NOT NULL,
  response_json TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'gemini',
  created_at    TEXT DEFAULT (datetime('now')),
  expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  usage_date    TEXT PRIMARY KEY,
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tracking ON complaints(tracking_id);
CREATE INDEX IF NOT EXISTS idx_session  ON complaints(session_id);
CREATE INDEX IF NOT EXISTS idx_status   ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_created  ON complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_exp ON analysis_cache(expires_at);
