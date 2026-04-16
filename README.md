# Awaaz AI — آواز

**Voice-first civic complaint platform for India** with AI analysis, multilingual drafting, PDF export, and complaint tracking.

**Tagline:** ہر شہری کی آواز، اب ایک شکایت بن سکتی ہے · हर नागरिक की आवाज़ अब शिकायत बन सकती है

## Why Awaaz AI

Awaaz AI helps citizens file strong, structured complaints in **English, Urdu, Hindi, and Kashmiri** without complex bureaucracy. Users can speak or type, get department-specific guidance, download official-style complaint PDFs, and track submissions by session.

## Core capabilities

- Multilingual complaint intake (`en`, `ur`, `hi`, `ks`)
- Gemini-powered issue classification and complaint letter generation
- Voice input with browser speech recognition + fallback upload transcription
- SQLite persistence with tracking IDs and session-based complaint history
- PDF export per complaint
- Optional encrypted email reminders (7-day follow-up)
- Admin dashboard with filters, status updates, and deletion controls
- Live stats API + frontend data visualization
- Docker + Render-ready deployment assets

## Tech stack

- **Runtime:** Node.js 20+, ESM
- **Backend:** Express, Helmet, CORS, express-rate-limit, Zod
- **DB:** SQLite via better-sqlite3
- **AI:** Gemini (`gemini-2.0-flash`)
- **Voice fallback:** Groq Whisper transcription endpoint
- **PDF:** PDFKit
- **Email:** Resend (optional)
- **Scheduler:** node-cron
- **Logging:** Pino + pino-pretty
- **Tests:** Vitest + Supertest

## Quick start (free tier setup)

1. Clone the repo.
2. Copy environment template:
   - `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
3. Add required keys in `.env`:
   - `GEMINI_API_KEY` (required for `/api/analyze`)
   - `GROQ_API_KEY` (optional, for audio upload transcription)
   - `RESEND_API_KEY` (optional, for follow-up emails)
4. Install and run:
   - `npm install`
   - `npm start`
5. Open:
   - `http://localhost:8080`

If optional keys are not set, related features degrade gracefully (e.g. transcription/email endpoints return controlled errors).

## Deployment (Render free tier)

1. Push repository to GitHub.
2. Create a new Web Service on [Render](https://render.com).
3. Use `render.yaml` (recommended) or set:
   - **Build:** `npm install`
   - **Start:** `node server/index.js`
4. Configure environment variables in Render dashboard.
5. Attach persistent disk at `/app/data` for SQLite durability.

## Architecture

```text
Browser  ->  Express  ->  Zod validation  ->  Gemini API (analyze)
                |             |                   |
                |             +-> rate limits     +-> response parsing
                |
                +-> Groq API (transcribe) [optional]
                +-> SQLite (complaints, sessions)
                +-> PDFKit (complaint PDFs)
                +-> Resend + node-cron (follow-up emails) [optional]
```

## API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health and Gemini key status |
| POST | `/api/analyze` | Analyze complaint text and create complaint record |
| GET | `/api/stats` | Platform aggregate stats for map/dashboard |
| GET | `/api/session/complaints?sessionId=` | Session complaint list (metadata only) |
| GET | `/api/complaints/:trackingId` | Single complaint detail |
| GET | `/api/complaints/:trackingId/pdf` | Download complaint PDF |
| GET | `/api/complaints` | Admin complaint list (token-protected if enabled) |
| PATCH | `/api/complaints/:trackingId/status` | Admin status update |
| DELETE | `/api/complaints/:trackingId` | Admin delete complaint |
| POST | `/api/transcribe` | Audio upload transcription (Groq, optional) |
| GET | `/admin` | Admin dashboard page |

## Environment variables

See `.env.example` for full list. Key variables:

- `GEMINI_API_KEY` (required for analyze)
- `GROQ_API_KEY` (optional for upload STT)
- `RESEND_API_KEY` (optional for reminders)
- `EMAIL_SECRET` (required to store email encrypted)
- `ADMIN_TOKEN` (protect admin/list APIs)
- `DB_PATH` (default `data/awaaz.db`)

## Screenshots (real frontend)

### 1) Landing + full app flow

![Awaaz AI Home](docs/screenshots/home-full.png)

### 2) Demo complaint experience

![Awaaz AI Demo](docs/screenshots/demo-section.png)

### 3) Impact and live stats section

![Awaaz AI Impact Stats](docs/screenshots/impact-stats.png)

## Testing

- `npm test` -> runs full Vitest suite
- `npm run test:watch` -> interactive watch mode
- `npm run test:coverage` -> coverage run

## Development notes

- `npm run dev` uses Node watch mode
- SQLite DB file is created automatically under `data/`
- If you switch Node versions and see `better-sqlite3` ABI errors, run:
  - `npm rebuild better-sqlite3`

## Security highlights

- Helmet CSP + hardened headers
- API and analyze-specific rate limits
- Zod validation for analyze payload
- Correlation IDs + structured request logging
- AES-256-GCM email encryption (never stored raw)

## License

Intended for civic-tech and educational use. Add your preferred OSS license file for distribution.
