import { getDb } from './index.js';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function purgeExpiredAnalysisCache() {
  const db = getDb();
  db.prepare(`DELETE FROM analysis_cache WHERE datetime(expires_at) <= datetime('now')`).run();
}

export function getAnalysisCache(cacheKey) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT response_json
       FROM analysis_cache
       WHERE cache_key = ?
         AND datetime(expires_at) > datetime('now')`
    )
    .get(cacheKey);
  if (!row?.response_json) return null;
  try {
    return JSON.parse(row.response_json);
  } catch {
    return null;
  }
}

export function putAnalysisCache({ cacheKey, inputHash, response, provider, ttlMs }) {
  if (!ttlMs || ttlMs <= 0) return;
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.prepare(
    `INSERT INTO analysis_cache (cache_key, input_hash, response_json, provider, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       input_hash=excluded.input_hash,
       response_json=excluded.response_json,
       provider=excluded.provider,
       expires_at=excluded.expires_at`
  ).run(cacheKey, inputHash, JSON.stringify(response), provider || 'gemini', expiresAt);
}

export function trimAnalysisCache(maxItems) {
  if (!maxItems || maxItems <= 0) return;
  const db = getDb();
  db.prepare(
    `DELETE FROM analysis_cache
     WHERE cache_key IN (
       SELECT cache_key FROM analysis_cache
       ORDER BY datetime(created_at) ASC
       LIMIT (
         SELECT CASE WHEN COUNT(*) > ? THEN COUNT(*) - ? ELSE 0 END FROM analysis_cache
       )
     )`
  ).run(maxItems, maxItems);
}

export function getDailyEstimatedTokens(date = todayUTC()) {
  const db = getDb();
  const row = db.prepare(`SELECT estimated_tokens FROM ai_usage_daily WHERE usage_date = ?`).get(date);
  return row?.estimated_tokens || 0;
}

export function addDailyEstimatedTokens(tokens, date = todayUTC()) {
  const n = Math.max(0, Math.floor(tokens || 0));
  if (!n) return;
  const db = getDb();
  db.prepare(
    `INSERT INTO ai_usage_daily (usage_date, estimated_tokens, request_count, updated_at)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(usage_date) DO UPDATE SET
       estimated_tokens = estimated_tokens + excluded.estimated_tokens,
       request_count = request_count + 1,
       updated_at = datetime('now')`
  ).run(date, n);
}
