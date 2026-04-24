# Awaaz AI — Platform specification

This document is the **single reference** for what the project **implements today** and what remains **out of scope or missing** for a production-grade civic platform. It is meant for contributors, reviewers, and anyone scoping the next phase of work.

---

## 1. Vision (product intent)

**Awaaz AI (آواز — Voice of the Unheard)** is a **civic complaint assistant** concept aimed at **rural India**, with emphasis on **Kashmiri, Urdu, and Hindi** contexts. The product story is:

- Lower the friction from **spoken or plain-language grievances** to **structured, citable complaint text** (issue type, department, severity, where to submit, bilingual drafts).
- **Does not** replace courts, government portals, or official processes; it **helps document and route** citizen intent.

The repository is a **working full-stack demo** (static UI + Node API + file persistence + Gemini), not a government-certified system.

---

## 2. What we have built (complete inventory)

### 2.1 Frontend (single-page application)

| Area | Implementation |
|------|----------------|
| **Entry** | `index.html` — semantic sections, `id="how"`, `id="demo"`, `id="impact"`, smooth scroll targets from nav. |
| **Fonts** | Google Fonts: **Playfair Display** (headings), **DM Sans** (body), **Noto Nastaliq Urdu** (Urdu copy + RTL textarea). |
| **Design system** | CSS variables in `css/variables.css` — ink/sand/saffron/emerald/crimson/gold, radii, shadows. |
| **CSS layout** | Modular files imported via `css/main.css` — base, nav, hero, sections, demo, impact, map, cta-footer, animations, UI components. |
| **Sticky navbar** | Logo mark (saffron + animated ring), “Awaaz AI” + Urdu آواز, links (How it works, Try Demo, Impact), **File a Complaint** CTA; **mobile hamburger** toggles `body.nav-open`. |
| **Hero** | Eyebrow badge, headline (“complain” italic), Urdu blockquote, description, CTAs, stats row (6.4L villages, ₹2.4T, 10s). |
| **Hero demo card** | Gradient top bar, avatar, voice-wave bars (CSS animation), 5 timed processing steps, emerald tracking badge animation. |
| **Problem strip** | Four stat columns (77 yrs, 0, 85%, ₹0) on dark background. |
| **How it works** | Six steps with icons, flow arrows, hover sand background; copy references Web Speech API where relevant. |
| **Live demo** | Mac-style toolbar, **language toggles** (en/ur/hi), **textarea** with Urdu class + RTL for Urdu, **four sample complaints** (`samples.js`: en/ur/hi per topic). |
| **Voice** | `js/voice.js` — **Web Speech API** mic button, continuous dictation into textarea, locales `en-IN` / `ur-PK` / `hi-IN`, stops on language change; **unsupported browsers** get disabled mic + message. |
| **Analyze** | `js/analyze.js` — `POST /api/analyze` with `{ text, language }`; fills result card (issue, department, severity badge, submit_to, tracking IDs, EN/Urdu letter tabs, copy). |
| **Output UI** | Placeholder / loading spinner + rotating messages / result card with emerald header, severity badges, **English / اردو خط** tabs, copy button, tracking strip. |
| **Impact** | Six cards with colored top borders, hover lift. |
| **Corruption map** | Illustrative bar chart + issue list (static numbers, not wired to DB). |
| **CTA + footer** | Gradient CTA scrolls to `#demo`; footer three-column grid + links. |
| **Responsive** | Hero 2→1 col, demo 2→1, map 2→1, nav collapse on small screens. |

### 2.2 Client-side JavaScript (ES modules)

| File | Role |
|------|------|
| `js/main.js` | `DOMContentLoaded`: nav, demo controls, `initVoice()`, CTA scroll. |
| `js/config.js` | `API.baseUrl` (default `''`); optional `window.__AWAAZ_API_BASE__` for split deploy. |
| `js/ui.js` | Language state, `setLang`, `loadSample`, `showTab`, `copyLetter`, placeholder HTML; dispatches `awaaz:lang` after language change. |
| `js/samples.js` | Four topics × three languages (road, water, school, ration). |
| `js/voice.js` | Web Speech API integration (see §2.1). |
| `js/analyze.js` | Fetch backend, map JSON to DOM, error display with escaped server message. |

### 2.3 Backend (Node.js + Express)

| Component | Detail |
|-----------|--------|
| **Runtime** | `package.json` `"type": "module"`; Node with native `fetch`. |
| **Entry** | `server/index.js` — Express, CORS, JSON body limit **512kb**, `trust proxy`. |
| **Helm** | **No** `helmet` middleware (optional hardening not added). |
| **Rate limiting** | `express-rate-limit` on **`POST /api/analyze`** only — window **15 min**, max **`RATE_LIMIT_ANALYZE`** (default **40**). |
| **Gemini** | `server/lib/gemini.js` — `POST` to `generativelanguage.googleapis.com/.../models/{GEMINI_MODEL}:generateContent?key=...`, parses JSON from model text (strips fences, fallback `{...}` extract). |
| **Persistence** | `server/lib/store.js` — **`data/complaints.json`**, array of records with `trackingId`, `createdAt`, `language`, `inputText`, `analysis` fields; **FIFO cap** `COMPLAINTS_MAX_STORED` (default **500**). |
| **Tracking IDs** | `AWZ-2026-0` + random 5-digit number (server-generated). |
| **Static hosting** | Serves repo root (`index.html`, `css/`, `js/`, `assets/`); SPA fallback for **non-extension** GET paths; **404** for unknown `/api/*` and missing static assets with extension. |

### 2.4 HTTP API (contract)

| Method | Path | Request | Response / notes |
|--------|------|---------|-------------------|
| `GET` | `/api/health` | — | `{ ok, service, version, geminiConfigured }` |
| `POST` | `/api/analyze` | `{ "text": string, "language"?: string }` — text max **12000** chars | **200** `{ trackingId, analysis }` or **400** / **500** / **503** `{ error }` |
| `GET` | `/api/complaints` | `?limit=&offset=` | Summary list; if **`ADMIN_TOKEN`** set, requires **`Authorization: Bearer <token>`** |
| `GET` | `/api/complaints/:trackingId` | — | Full `analysis` for that ID (no auth in demo) |

**List endpoint** returns **metadata only** (no full `inputText` in list items — see `store.js` mapping). **Single-complaint GET** returns stored analysis; **input text** is stored server-side for the record but not exposed in list API.

### 2.5 Configuration (environment)

Documented in **`.env.example`**:

- `GEMINI_API_KEY` — **required** for analyze.
- `PORT` — default **8080**.
- `GEMINI_MODEL` — default **gemini-2.0-flash**.
- `GEMINI_MAX_TOKENS` — passed to Gemini.
- `ADMIN_TOKEN` — optional; locks **`GET /api/complaints`**.
- `COMPLAINTS_MAX_STORED` — max rows in JSON file.
- `RATE_LIMIT_ANALYZE` — analyze rate limit.
- `CORS_ORIGIN` — `*` or explicit origin.

### 2.6 Repository & tooling

- **`.gitignore`**: `node_modules/`, `.env`, `data/`, logs.
- **Scripts**: `npm run dev` (watch), `npm start`, `npm run serve-static` (static only).
- **README**: problem statement, solution summary, tech stack, UI gallery, architecture diagram, run instructions, API table, short roadmap.
- **Assets**: PNG banners/screenshots under `assets/` for documentation.

---

## 3. What is not built (gaps and missing backend features)

This section merges **product** gaps with **engineering** gaps so planning is explicit.

### 3.1 Data & persistence

| Gap | Why it matters |
|-----|----------------|
| **No real database** | JSON file is not safe for **concurrent writes**, **backup**, **replication**, or **query** at scale. |
| **No migrations / schema versioning** | Adding fields or indexes requires ad-hoc edits. |
| **No encryption at rest** | `complaints.json` is **plain text** on disk. |
| **No retention policy** | Records are not auto-expired or anonymized. |
| **No PII classification** | `inputText` is sensitive; no **redaction**, **hashing**, or **consent** model. |

### 3.2 Identity, security, and access control

| Gap | Why it matters |
|-----|----------------|
| **No user accounts** | No way to bind complaints to a **verified** identity or **anonymous** session safely. |
| **No JWT / sessions** | Only optional **`ADMIN_TOKEN`** for admin APIs; **single-complaint GET/PDF** is open to anyone with the high-entropy ID. |
| **No RBAC** | No roles (citizen, officer, admin). |
| **No API keys for clients** | No **per-app** or **per-device** keys for external frontends. |
| **Limited hardening** | No **Helmet**, **CSRF** (if cookies), **request signing**, **WAF** rules in code. |

### 3.3 Voice and media

| Gap | Why it matters |
|-----|----------------|
| **No server-side STT** | Voice uses **browser Web Speech API** only; **no** Whisper / Google Cloud Speech / Azure on the backend. |
| **No audio upload API** | No **`multipart`** endpoint for recordings or evidence files. |
| **No Kashmiri-specific STT** | Browser locales are approximate; **Kashmiri** is not a first-class STT locale in the app. |

### 3.4 AI and quality

| Gap | Why it matters |
|-----|----------------|
| **Single model path** | Only **Gemini** `generateContent`; no **fallback** model or **human review** queue. |
| **No prompt versioning / A/B** | Prompts are **embedded** in code without version tags or experiments. |
| **No evaluation harness** | No automated tests for **JSON shape** or **quality** of letters. |

### 3.5 Integrations and workflow

| Gap | Why it matters |
|-----|----------------|
| **No real government submission** | No **CPGRAMS**, **email-to-authority**, **PDF** generation, or **portal automation**. |
| **No notifications** | No **SMTP**, **SMS**, or **webhooks** for status or reminders (“7-day follow-up” is UI story only). |
| **No job queue** | No **BullMQ** / cron for scheduled follow-ups or retries. |

### 3.6 Abuse, validation, and operations

| Gap | Why it matters |
|-----|----------------|
| **No CAPTCHA** | Analyze endpoint can be **abused** (rate limit only mitigates). |
| **No strict input schema** | **Zod/Joi** validation not used server-side beyond basic checks. |
| **No structured logging** | **console.error** only; no **correlation IDs**, **metrics**, or **Sentry**. |
| **No tests** | No **Jest/supertest** for API or store. |
| **No container / deployment** | No **Dockerfile**, **compose**, or **K8s** manifests in repo. |

### 3.7 Frontend / product (non-backend but listed for completeness)

| Gap | Notes |
|-----|--------|
| **Map & stats** | **Static** illustrative data; not driven by `complaints.json` or analytics DB. |
| **Admin UI** | No dashboard to browse complaints in the browser (only API + optional token). |
| **Footer links** | Placeholder `#` URLs. |

---

## 4. Suggested roadmap (phased)

Phases are **suggestions**, not commitments.

| Phase | Focus | Examples |
|-------|--------|----------|
| **A — Harden** | SQLite or Postgres, migrations, delete-by-ID, env-based retention, Helmet, structured logs, integration tests. |
| **B — Trust** | Auth (anonymous session + optional phone/email), ADMIN dashboard, protect `GET /api/complaints/:id` or use opaque tokens. |
| **C — Voice & evidence** | `POST /api/transcribe` with audio upload + Google STT or Whisper; store transcript + hash. |
| **D — Outbound** | Email/PDF export, deep links to CPGRAMS, webhook subscriptions. |
| **E — Ops** | Docker, CI, staging, monitoring, load testing. |

---

## 5. Document maintenance

| Item | Location |
|------|----------|
| Run instructions | Root `README.md` |
| Env vars | `.env.example` |
| This spec | `docs/PLATFORM-SPEC.md` |

When you add or remove a major feature, update **§2** and **§3** accordingly.

---

*Last updated to match the repository layout and behavior described in the codebase.*
