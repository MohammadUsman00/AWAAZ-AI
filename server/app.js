/**
 * Express application (export for tests + server/index.js)
 */

import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { runGeminiAnalysis } from './lib/gemini.js';
import {
  generateTrackingId,
  createComplaint,
  getComplaintByTrackingId,
  listComplaints,
  getComplaintsBySession,
  updateComplaintStatus,
  deleteComplaint,
  getExtendedStats,
} from './db/complaints.js';
import { validateAnalyze } from './lib/validate.js';
import { encryptEmail } from './lib/email-crypto.js';
import { generateComplaintPDF } from './lib/pdf.js';
import { logger } from './lib/logger.js';
import { transcribeRouter } from './routes/transcribe.js';
import { getDb } from './db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const VALID_STATUSES = new Set(['filed', 'under_review', 'resolved', 'rejected']);

function requireAdmin(req, res, next) {
  const tok = process.env.ADMIN_TOKEN;
  if (!tok) return next();
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${tok}`) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="admin"');
    return res.status(401).json({ error: 'Unauthorized', details: 'Invalid or missing admin token' });
  }
  next();
}

function requireAdminForAdminRoute(req, res, next) {
  const tok = process.env.ADMIN_TOKEN;
  if (!tok) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).send('Not found');
    }
    return next();
  }
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${tok}`) return next();
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      const user = i >= 0 ? decoded.slice(0, i) : '';
      const pass = i >= 0 ? decoded.slice(i + 1) : '';
      if (user === 'admin' && pass === tok) return next();
    } catch {
      /* ignore */
    }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Awaaz Admin"');
  return res.status(401).send('Unauthorized');
}

function isAdmin(req) {
  const tok = process.env.ADMIN_TOKEN;
  return tok && req.headers.authorization === `Bearer ${tok}`;
}

function complaintToJson(row, { includeInput } = {}) {
  if (!row) return null;
  const out = {
    trackingId: row.trackingId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    language: row.language,
    status: row.status,
    analysis: {
      issue_type: row.issueType,
      department: row.department,
      severity: row.severity,
      submit_to: row.submitTo,
      english_letter: row.englishLetter,
      urdu_letter: row.urduLetter,
      summary: row.summary,
    },
  };
  if (includeInput) out.inputText = row.inputText;
  return out;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'"],
        },
      },
    })
  );

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN || true,
    })
  );

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const analyzeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_ANALYZE || '40', 10),
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);
  app.use(express.json({ limit: '512kb' }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      logger.info({ reqId: req.id, method: req.method, path: req.path, status: res.statusCode, responseTime: ms });
    });
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      service: 'awaaz-ai',
      version: '1.0.0',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.get('/api/stats', (req, res) => {
    try {
      const data = getExtendedStats();
      res.json({
        total: data.total,
        today: data.today,
        critical: data.critical,
        resolved: data.resolved,
        by_severity: data.by_severity,
        by_issue_type: data.by_issue_type,
        by_language: data.by_language,
        recent: data.recent,
        sessions: data.sessions,
      });
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'stats failed');
      res.status(500).json({ error: 'Failed to load stats' });
    }
  });

  app.get('/api/session/complaints', (req, res) => {
    try {
      const sessionId = req.query.sessionId;
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'Missing sessionId query parameter' });
      }
      const list = getComplaintsBySession(sessionId.trim());
      res.json({ items: list });
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'session complaints failed');
      res.status(500).json({ error: 'Failed to load session complaints' });
    }
  });

  app.post('/api/analyze', analyzeLimiter, validateAnalyze, async (req, res) => {
    try {
      const { text, language, sessionId: sid, email } = req.body;
      const sessionId = sid || crypto.randomUUID();

      const analysis = await runGeminiAnalysis(text.trim());
      const trackingId = generateTrackingId();

      const secret = process.env.EMAIL_SECRET;
      let emailEncrypted = null;
      if (email && String(email).trim()) {
        if (!secret) {
          logger.warn({ reqId: req.id }, 'Email provided but EMAIL_SECRET not set — not stored');
        } else {
          emailEncrypted = encryptEmail(String(email).trim(), secret);
        }
      }

      const maxStored = parseInt(process.env.COMPLAINTS_MAX_STORED || '10000', 10);
      const countRow = getDb().prepare(`SELECT COUNT(*) AS n FROM complaints`).get();
      if (countRow && countRow.n >= maxStored) {
        return res.status(503).json({ error: 'Storage limit reached. Try again later.' });
      }

      createComplaint({
        trackingId,
        sessionId,
        language,
        inputText: text.trim(),
        analysis: {
          issue_type: analysis.issue_type,
          department: analysis.department,
          severity: analysis.severity,
          submit_to: analysis.submit_to,
          english_letter: analysis.english_letter,
          urdu_letter: analysis.urdu_letter,
          summary: analysis.summary,
        },
        emailEncrypted,
      });

      res.json({
        trackingId,
        sessionId,
        analysis: {
          issue_type: analysis.issue_type || '',
          department: analysis.department || '',
          severity: analysis.severity || 'medium',
          submit_to: analysis.submit_to || '',
          english_letter: analysis.english_letter || '',
          urdu_letter: analysis.urdu_letter || '',
          summary: analysis.summary || '',
        },
      });
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'analyze failed');
      const message = err?.message || 'Analysis failed';
      const status = message.includes('misconfiguration') || message.includes('GEMINI') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/complaints/:trackingId/pdf', async (req, res) => {
    try {
      const row = getComplaintByTrackingId(req.params.trackingId);
      if (!row) {
        return res.status(404).json({ error: 'Not found' });
      }
      const buf = await generateComplaintPDF(row);
      const safe = String(req.params.trackingId).replace(/[^a-zA-Z0-9-_]/g, '');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="AWZ-complaint-${safe}.pdf"`);
      res.send(buf);
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'pdf failed');
      res.status(500).json({ error: 'PDF generation failed' });
    }
  });

  app.get('/api/complaints/:trackingId', (req, res) => {
    try {
      const row = getComplaintByTrackingId(req.params.trackingId);
      if (!row) {
        return res.status(404).json({ error: 'Not found' });
      }
      const includeInput = isAdmin(req);
      res.json(complaintToJson(row, { includeInput }));
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'complaint get failed');
      res.status(500).json({ error: 'Failed to load complaint' });
    }
  });

  app.patch('/api/complaints/:trackingId/status', requireAdmin, (req, res) => {
    try {
      const status = req.body?.status;
      if (!status || !VALID_STATUSES.has(String(status))) {
        return res.status(400).json({
          error: 'Validation failed',
          details: { status: 'Must be filed|under_review|resolved|rejected' },
        });
      }
      const ok = updateComplaintStatus(req.params.trackingId, status);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true, trackingId: req.params.trackingId, status });
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'status patch failed');
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  app.delete('/api/complaints/:trackingId', requireAdmin, (req, res) => {
    try {
      const ok = deleteComplaint(req.params.trackingId);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'delete failed');
      res.status(500).json({ error: 'Failed to delete' });
    }
  });

  app.get('/api/complaints', requireAdmin, (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);
      const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
      const { rows, total, ...rest } = listComplaints({
        limit,
        offset,
        status: req.query.status,
        severity: req.query.severity,
        language: req.query.language,
        q: req.query.q,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });
      res.json({ items: rows, total, ...rest });
    } catch (err) {
      logger.error({ err, reqId: req.id }, 'complaints list failed');
      res.status(500).json({ error: 'Failed to list complaints' });
    }
  });

  app.use(transcribeRouter);

  app.get('/admin', requireAdminForAdminRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api') && !res.headersSent) {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  });

  app.use(express.static(ROOT));

  app.use((req, res, next) => {
    if (res.headersSent) return next();
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api')) return next();
    if (req.path.includes('.')) return res.status(404).end();
    res.sendFile(path.join(ROOT, 'index.html'));
  });

  return app;
}
