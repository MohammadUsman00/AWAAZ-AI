import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { runGeminiAnalysis } from './lib/gemini.js';
import {
  generateTrackingId,
  saveComplaint,
  listComplaints,
  getComplaintByTrackingId,
} from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN || true,
  })
);

app.use(express.json({ limit: '512kb' }));

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_ANALYZE || '40', 10),
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'awaaz-ai',
    version: '1.0.0',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  try {
    const { text, language } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or invalid "text"' });
    }
    if (text.length > 12000) {
      return res.status(400).json({ error: 'Text exceeds maximum length' });
    }

    const lang = typeof language === 'string' ? language.slice(0, 8) : 'en';
    const analysis = await runGeminiAnalysis(text.trim());
    const trackingId = generateTrackingId();

    saveComplaint({
      trackingId,
      language: lang,
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
    });

    res.json({
      trackingId,
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
    console.error('[analyze]', err);
    const message = err?.message || 'Analysis failed';
    const status = message.includes('misconfiguration') ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

function requireAdminForList(req, res, next) {
  const tok = process.env.ADMIN_TOKEN;
  if (!tok) return next();
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${tok}`) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Set Authorization: Bearer <ADMIN_TOKEN>' });
  }
  next();
}

app.get('/api/complaints', requireAdminForList, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    res.json(listComplaints({ limit, offset }));
  } catch (err) {
    console.error('[complaints list]', err);
    res.status(500).json({ error: 'Failed to list complaints' });
  }
});

app.get('/api/complaints/:trackingId', (req, res) => {
  try {
    const row = getComplaintByTrackingId(req.params.trackingId);
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      trackingId: row.trackingId,
      createdAt: row.createdAt,
      language: row.language,
      analysis: row.analysis,
    });
  } catch (err) {
    console.error('[complaint get]', err);
    res.status(500).json({ error: 'Failed to load complaint' });
  }
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

app.listen(PORT, () => {
  console.log(`Awaaz AI backend http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY is not set. Set it in .env for /api/analyze.');
  }
});
