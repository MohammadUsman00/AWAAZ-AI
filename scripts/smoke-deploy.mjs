#!/usr/bin/env node
import crypto from 'node:crypto';

/**
 * Post-deploy smoke tests against a live URL (Render, staging, etc.).
 *
 * Usage:
 *   SMOKE_URL=https://your-app.onrender.com npm run test:deploy
 *
 * Optional:
 *   SMOKE_ADMIN_TOKEN=<same as ADMIN_TOKEN on server> — verifies admin API with Bearer auth
 *   SMOKE_SKIP_ANALYZE=1 — do not POST /api/analyze (avoids Gemini quota)
 */

function baseUrl() {
  const raw = process.env.SMOKE_URL || process.env.DEPLOY_URL || '';
  const u = String(raw).trim().replace(/\/$/, '');
  return u;
}

function fail(msg) {
  console.error(`[smoke] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[smoke] OK: ${msg}`);
}

async function req(method, path, { headers, body, json } = {}) {
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const opts = { method, headers: { ...headers } };
  if (json !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(json);
  } else if (body !== undefined) {
    opts.body = body;
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, text, data };
}

async function main() {
  const b = baseUrl();
  if (!b) {
    fail('Set SMOKE_URL (or DEPLOY_URL) to your deployed origin, e.g. https://awaaz-ai.onrender.com');
  }
  ok(`target ${b}`);

  // Health
  {
    const { res, data } = await req('GET', '/api/health');
    if (res.status !== 200) fail(`/api/health expected 200, got ${res.status}`);
    if (!data || data.ok !== true) fail(`/api/health body missing ok:true`);
    ok('/api/health');
  }

  // Stats shape
  {
    const { res, data } = await req('GET', '/api/stats');
    if (res.status !== 200) fail(`/api/stats expected 200, got ${res.status}`);
    if (typeof data?.total !== 'number') fail(`/api/stats missing total`);
    if (!data?.by_severity || !data?.by_issue_type || !data?.by_language) {
      fail(`/api/stats missing aggregate fields`);
    }
    ok('/api/stats shape');
  }

  // SPA shell
  {
    const { res, text } = await req('GET', '/');
    if (res.status !== 200) fail(`GET / expected 200, got ${res.status}`);
    if (!text.includes('Try Awaaz AI now')) fail(`GET / missing demo section marker`);
    if (!text.includes('data-lang="ks"')) fail(`GET / missing Kashmiri language toggle`);
    ok('GET / HTML markers');
  }

  // Validation path (no Gemini call)
  {
    const { res, data } = await req('POST', '/api/analyze', { json: { text: 'short' } });
    if (res.status !== 400) fail(`/api/analyze short text expected 400, got ${res.status}`);
    if (!data || data.error !== 'Validation failed') fail(`/api/analyze expected validation error`);
    ok('POST /api/analyze validation');
  }

  // Admin page: protected or disabled — never 5xx
  {
    const { res } = await req('GET', '/admin');
    if (res.status >= 500) fail(`/admin server error ${res.status}`);
    if (![200, 401, 404].includes(res.status)) {
      fail(`/admin unexpected status ${res.status}`);
    }
    ok(`/admin status ${res.status} (401=protected, 404=disabled in prod)`);
  }

  // Optional: admin API with Bearer
  const adminTok = process.env.SMOKE_ADMIN_TOKEN;
  if (adminTok) {
    const { res } = await req('GET', '/api/complaints?limit=1', {
      headers: { Authorization: `Bearer ${adminTok}` },
    });
    if (res.status !== 200) fail(`/api/complaints with Bearer expected 200, got ${res.status}`);
    ok('GET /api/complaints (Bearer)');
  } else {
    console.log('[smoke] skip: SMOKE_ADMIN_TOKEN not set (optional admin API check)');
  }

  // Optional: full analyze (uses Gemini quota)
  if (process.env.SMOKE_SKIP_ANALYZE === '1') {
    console.log('[smoke] skip: SMOKE_SKIP_ANALYZE=1 (analyze not run)');
  } else if (process.env.SMOKE_RUN_ANALYZE === '1') {
    const sessionId = crypto.randomUUID();
    const { res, data } = await req('POST', '/api/analyze', {
      json: {
        text: 'This is a deployment smoke complaint with enough characters for validation rules.',
        language: 'en',
        sessionId,
      },
    });
    if (res.status !== 200) {
      fail(`/api/analyze expected 200, got ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
    if (!data?.trackingId) fail(`/api/analyze missing trackingId`);
    ok('POST /api/analyze (SMOKE_RUN_ANALYZE=1)');
  } else {
    console.log('[smoke] skip: analyze (set SMOKE_RUN_ANALYZE=1 to test Gemini path, uses quota)');
  }

  console.log('[smoke] all required checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
