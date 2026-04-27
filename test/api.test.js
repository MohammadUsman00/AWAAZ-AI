process.env.ADMIN_TOKEN = 'test-admin-token';

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../server/lib/gemini.js', () => ({
  runGeminiAnalysis: vi.fn().mockResolvedValue({
    issue_type: 'Roads',
    department: 'PWD',
    severity: 'medium',
    submit_to: 'portal.example',
    english_letter: 'Formal letter text here.',
    urdu_letter: 'اردو',
    summary: 'Road damage summary',
  }),
}));

import { createApp } from '../server/app.js';

const app = createApp();

describe('api', () => {
  it('GET /api/health → 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/analyze — missing text → 400', async () => {
    const res = await request(app).post('/api/analyze').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('POST /api/analyze — text too short → 400', async () => {
    const res = await request(app).post('/api/analyze').send({
      text: 'short',
      language: 'en',
      sessionId: '00000000-0000-4000-8000-000000000099',
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/analyze — valid → 200 with trackingId', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        text: 'This complaint is long enough for validation rules.',
        language: 'en',
        sessionId: '00000000-0000-4000-8000-000000000099',
      });
    expect(res.status).toBe(200);
    expect(res.body.trackingId).toMatch(/^AWZ-2026-/);
    expect(res.body.analysis.issue_type).toBe('Roads');
  });

  it('GET /api/complaints/:trackingId — not found → 404', async () => {
    const res = await request(app).get('/api/complaints/AWZ-2026-00000');
    expect(res.status).toBe(404);
  });

  it('GET /api/complaints — no token when ADMIN_TOKEN set → 401', async () => {
    const res = await request(app).get('/api/complaints');
    expect(res.status).toBe(401);
  });

  it('GET /api/complaints — production without ADMIN_TOKEN → 503', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevTok = process.env.ADMIN_TOKEN;
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_TOKEN;
    try {
      const res = await request(app).get('/api/complaints');
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Admin not configured');
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.ADMIN_TOKEN = prevTok;
    }
  });

  it('GET /api/stats → 200 with shape', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.by_severity).toBeDefined();
    expect(res.body.by_issue_type).toBeDefined();
    expect(res.body.by_language).toBeDefined();
    expect(Array.isArray(res.body.recent)).toBe(true);
  });
});
