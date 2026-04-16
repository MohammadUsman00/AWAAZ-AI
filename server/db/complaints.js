/**
 * Complaint persistence — better-sqlite3
 */

import crypto from 'crypto';
import { getDb } from './index.js';

function rowFromStmt(row) {
  if (!row) return null;
  return {
    id: row.id,
    trackingId: row.tracking_id,
    sessionId: row.session_id,
    language: row.language,
    inputText: row.input_text,
    issueType: row.issue_type,
    department: row.department,
    severity: row.severity,
    submitTo: row.submit_to,
    englishLetter: row.english_letter,
    urduLetter: row.urdu_letter,
    summary: row.summary,
    status: row.status,
    followUpSent: Boolean(row.follow_up_sent),
    emailEncrypted: row.email_encrypted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function generateTrackingId() {
  const db = getDb();
  for (let i = 0; i < 25; i++) {
    const n = Math.floor(Math.random() * 90000) + 10000;
    const id = `AWZ-2026-0${n}`;
    const existing = db.prepare('SELECT 1 AS x FROM complaints WHERE tracking_id = ?').get(id);
    if (!existing) return id;
  }
  return `AWZ-2026-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

/**
 * @param {object} p
 * @param {string} p.trackingId
 * @param {string} p.sessionId
 * @param {string} p.language
 * @param {string} p.inputText
 * @param {object} p.analysis
 * @param {string | null} [p.emailEncrypted]
 */
export function createComplaint({ trackingId, sessionId, language, inputText, analysis, emailEncrypted = null }) {
  const db = getDb();
  const a = analysis || {};
  const insert = db.prepare(`
    INSERT INTO complaints (
      tracking_id, session_id, language, input_text,
      issue_type, department, severity, submit_to,
      english_letter, urdu_letter, summary,
      status, follow_up_sent, email_encrypted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'filed', 0, ?)
  `);

  const tx = db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO sessions (session_id) VALUES (?)`).run(sessionId);
    db.prepare(`UPDATE sessions SET complaint_count = complaint_count + 1 WHERE session_id = ?`).run(sessionId);
    insert.run(
      trackingId,
      sessionId,
      language || 'en',
      inputText,
      a.issue_type ?? null,
      a.department ?? null,
      a.severity ?? null,
      a.submit_to ?? null,
      a.english_letter ?? null,
      a.urdu_letter ?? null,
      a.summary ?? null,
      emailEncrypted
    );
  });
  tx();

  return getComplaintByTrackingId(trackingId);
}

export function getComplaintByTrackingId(trackingId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM complaints WHERE tracking_id = ?`).get(trackingId);
  return rowFromStmt(row);
}

export function getComplaintsBySession(sessionId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tracking_id, issue_type, severity, status, created_at
       FROM complaints WHERE session_id = ?
       ORDER BY datetime(created_at) DESC`
    )
    .all(sessionId);
  return rows.map((r) => ({
    trackingId: r.tracking_id,
    issueType: r.issue_type,
    severity: r.severity,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/**
 * @param {object} opts
 * @param {number} [opts.limit]
 * @param {number} [opts.offset]
 * @param {string} [opts.status]
 * @param {string} [opts.severity]
 * @param {string} [opts.language]
 * @param {string} [opts.q] - tracking id substring
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 */
export function listComplaints({ limit = 20, offset = 0, status, severity, language, q, dateFrom, dateTo } = {}) {
  const db = getDb();
  const where = [];
  const params = [];

  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (severity) {
    where.push('severity = ?');
    params.push(severity);
  }
  if (language) {
    where.push('language = ?');
    params.push(language);
  }
  if (q && String(q).trim()) {
    where.push('tracking_id LIKE ?');
    params.push(`%${String(q).trim()}%`);
  }
  if (dateFrom) {
    where.push(`date(created_at) >= date(?)`);
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push(`date(created_at) <= date(?)`);
    params.push(dateTo);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM complaints ${clause}`).get(...params);
  const total = totalRow?.n ?? 0;

  const rows = db
    .prepare(
      `SELECT tracking_id, language, summary, issue_type, severity, department, status, created_at
       FROM complaints ${clause}
       ORDER BY datetime(created_at) DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const mapped = rows.map((r) => ({
    trackingId: r.tracking_id,
    language: r.language,
    summary: r.summary,
    issue_type: r.issue_type,
    severity: r.severity,
    department: r.department,
    status: r.status,
    createdAt: r.created_at,
  }));

  return { rows: mapped, total, limit, offset };
}

export function updateComplaintStatus(trackingId, status) {
  const db = getDb();
  const r = db
    .prepare(`UPDATE complaints SET status = ?, updated_at = datetime('now') WHERE tracking_id = ?`)
    .run(status, trackingId);
  return r.changes > 0;
}

export function markFollowUpSent(trackingId) {
  const db = getDb();
  db.prepare(`UPDATE complaints SET follow_up_sent = 1, updated_at = datetime('now') WHERE tracking_id = ?`).run(
    trackingId
  );
}

export function getPendingFollowUps() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM complaints
       WHERE follow_up_sent = 0 AND status = 'filed'
       AND datetime(created_at) <= datetime('now', '-7 days')`
    )
    .all();
  return rows.map((row) => rowFromStmt(row));
}

export function deleteComplaint(trackingId) {
  const db = getDb();
  const r = db.prepare(`DELETE FROM complaints WHERE tracking_id = ?`).run(trackingId);
  return r.changes > 0;
}

export function getStats() {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END), 0) AS critical_count,
        COALESCE(SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END), 0) AS resolved_count,
        COALESCE(json_group_array(DISTINCT issue_type), '[]') AS issue_types
      FROM complaints`
    )
    .get();

  let issueTypes = [];
  try {
    issueTypes = JSON.parse(row.issue_types || '[]').filter(Boolean);
  } catch {
    issueTypes = [];
  }

  return {
    total: row.total ?? 0,
    critical_count: row.critical_count ?? 0,
    resolved_count: row.resolved_count ?? 0,
    issue_types: issueTypes,
  };
}

/** Rich stats for /api/stats and admin */
export function getExtendedStats() {
  const db = getDb();
  const base = getStats();

  const sessionsRow = db.prepare(`SELECT COUNT(*) AS n FROM sessions`).get();
  const todayRow = db
    .prepare(`SELECT COUNT(*) AS n FROM complaints WHERE date(created_at) = date('now')`)
    .get();

  const sevRows = db
    .prepare(
      `SELECT severity, COUNT(*) AS c FROM complaints
       WHERE severity IS NOT NULL AND severity != ''
       GROUP BY severity`
    )
    .all();
  const by_severity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of sevRows) {
    const k = String(r.severity).toLowerCase();
    if (k in by_severity) by_severity[k] = r.c;
  }

  const issueTop = db
    .prepare(
      `SELECT issue_type AS issue_type, COUNT(*) AS count FROM complaints
       WHERE issue_type IS NOT NULL AND issue_type != ''
       GROUP BY issue_type ORDER BY count DESC LIMIT 10`
    )
    .all();

  const langRows = db
    .prepare(`SELECT language, COUNT(*) AS c FROM complaints GROUP BY language`)
    .all();
  const by_language = { en: 0, ur: 0, hi: 0, ks: 0 };
  for (const r of langRows) {
    const k = String(r.language || 'en').toLowerCase();
    if (k in by_language) by_language[k] = r.c;
  }

  const recent = db
    .prepare(
      `SELECT tracking_id, issue_type, severity, created_at FROM complaints
       ORDER BY datetime(created_at) DESC LIMIT 5`
    )
    .all();

  return {
    ...base,
    today: todayRow?.n ?? 0,
    sessions: sessionsRow?.n ?? 0,
    critical: base.critical_count,
    resolved: base.resolved_count,
    by_severity,
    by_issue_type: issueTop.map((r) => ({ issue_type: r.issue_type, count: r.count })),
    by_language,
    recent: recent.map((r) => ({
      trackingId: r.tracking_id,
      issueType: r.issue_type,
      severity: r.severity,
      createdAt: r.created_at,
    })),
  };
}
