/**
 * JSON file persistence for complaint records (demo / small-scale).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'complaints.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ complaints: [] }, null, 2), 'utf8');
  }
}

function readDb() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const db = JSON.parse(raw);
    if (!Array.isArray(db.complaints)) db.complaints = [];
    return db;
  } catch {
    return { complaints: [] };
  }
}

function writeDb(db) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export function generateTrackingId() {
  const n = Math.floor(Math.random() * 90000) + 10000;
  return `AWZ-2026-0${n}`;
}

/**
 * @param {object} record
 * @param {string} record.trackingId
 * @param {string} record.language
 * @param {string} record.inputText - stored for retrieval by ID (configure retention in production)
 * @param {object} record.analysis - full parsed analysis
 */
export function saveComplaint(record) {
  const db = readDb();
  db.complaints.unshift({
    ...record,
    createdAt: new Date().toISOString(),
  });
  // Cap list size (FIFO trim)
  const max = parseInt(process.env.COMPLAINTS_MAX_STORED || '500', 10);
  if (db.complaints.length > max) {
    db.complaints = db.complaints.slice(0, max);
  }
  writeDb(db);
  return record;
}

export function listComplaints({ limit = 50, offset = 0 } = {}) {
  const db = readDb();
  const slice = db.complaints.slice(offset, offset + limit);
  return {
    total: db.complaints.length,
    limit,
    offset,
    items: slice.map((c) => ({
      trackingId: c.trackingId,
      createdAt: c.createdAt,
      language: c.language,
      summary: c.analysis?.summary,
      issue_type: c.analysis?.issue_type,
      severity: c.analysis?.severity,
      department: c.analysis?.department,
    })),
  };
}

export function getComplaintByTrackingId(trackingId) {
  const db = readDb();
  return db.complaints.find((c) => c.trackingId === trackingId) || null;
}
