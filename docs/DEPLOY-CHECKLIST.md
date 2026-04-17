# Deployment checklist — Awaaz AI

Use this after every production deploy (e.g. Render) and when rotating API keys.

## 1) Host configuration

- [ ] **Persistent disk** is attached and mounted where `DB_PATH` points (see `render.yaml`: `/data` → `DB_PATH=/data/awaaz.db`).
- [ ] **Environment variables** are set in the host dashboard (never commit `.env` to git).
- [ ] **`PUBLIC_BASE_URL`** matches your HTTPS site URL (for email links).
- [ ] **`PORT`** is not overridden incorrectly — Render injects `PORT`; the app reads it automatically.

## 2) Required secrets (minimum viable product)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | AI analysis (`/api/analyze`) |
| `ADMIN_TOKEN` | Protects `/admin` and admin APIs (Basic: user `admin`, password = token) |
| `EMAIL_SECRET` | Encrypts optional reminder emails (32+ chars) |

Optional:

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Audio upload transcription |
| `RESEND_API_KEY` | 7-day email reminders |
| `CORS_ORIGIN` | Browser CORS (same-origin deploy: `*` is usually fine) |

## 3) Automated checks (before / after merge)

- [ ] `npm run test:ci` — unit + API tests (Vitest + Supertest)
- [ ] `npm run test:e2e` — browser smoke (Playwright; starts server automatically)
- [ ] After deploy: `SMOKE_URL=https://your-host npm run test:deploy` — live HTTP smoke

## 4) Manual smoke on the **real URL** (do this once per deploy)

Run these in order in a browser and note any failure.

1. [ ] **`GET /api/health`** — `200`, JSON `{ "ok": true }`
2. [ ] **Homepage** — loads, no blank screen, demo section visible
3. [ ] **`GET /api/stats`** — `200`, JSON has `total`, `by_severity`, `by_issue_type`
4. [ ] **File a complaint** — Analyze with valid text (needs `GEMINI_API_KEY`).
5. [ ] **Result card** — tracking ID shown, severity badge, letters tab
6. [ ] **Download PDF** — opens/downloads PDF for that tracking ID
7. [ ] **Session history** — “View My Previous Complaints” lists the complaint (same browser session)
8. [ ] **`/admin`** — login with Basic auth (`admin` / `ADMIN_TOKEN`); list loads
9. [ ] **Admin** — change status or delete a test row if you used test data

## 5) Known product gaps (not blockers)

- **Full E2E of Gemini** — not run in CI by default (quota/cost); use manual step 4 or `SMOKE_RUN_ANALYZE=1` locally against staging.

**User dashboard:** session-scoped list at **`/dashboard`** (linked from the main nav as “My Dashboard”).

## 6) Rollback

- Revert deploy in Render **or** restore previous container image.
- If SQLite is corrupted, restore from disk snapshot backup (if enabled).
