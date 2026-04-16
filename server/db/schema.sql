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

CREATE INDEX IF NOT EXISTS idx_tracking ON complaints(tracking_id);
CREATE INDEX IF NOT EXISTS idx_session  ON complaints(session_id);
CREATE INDEX IF NOT EXISTS idx_status   ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_created  ON complaints(created_at);
