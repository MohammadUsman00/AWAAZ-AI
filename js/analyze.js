import { API } from './config.js';
import { state, showTab, PLACEHOLDER_HTML } from './ui.js';

const LOADING_MESSAGES = [
  'Transcribing your complaint...',
  'Identifying issue & department...',
  'Searching government authorities...',
  'Generating formal complaint letter...',
  'Preparing Urdu translation...',
];

export function genTrackingId() {
  const n = Math.floor(Math.random() * 90000) + 10000;
  return `AWZ-2026-0${n}`;
}

function parseModelJson(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) throw e;
    return JSON.parse(m[0]);
  }
}

/** Extract text from Gemini `generateContent` response. */
function geminiResponseText(data) {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.map((p) => p.text || '').join('');
}

export async function analyzeComplaint() {
  const text = document.getElementById('complaintText').value.trim();
  if (!text) {
    alert('Please enter your complaint first.');
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  const ph = document.getElementById('outputPlaceholder');
  ph.innerHTML = PLACEHOLDER_HTML;
  ph.style.display = 'none';
  document.getElementById('resultCard').classList.remove('visible');
  const lo = document.getElementById('loadingOverlay');
  lo.classList.add('active');

  let mi = 0;
  const lt = document.getElementById('loadingText');
  lt.textContent = LOADING_MESSAGES[0];
  const msgInterval = setInterval(() => {
    mi = (mi + 1) % LOADING_MESSAGES.length;
    lt.textContent = LOADING_MESSAGES[mi];
  }, 1200);

  const prompt = `You are Awaaz AI, a civic complaint assistant for rural India. Analyze the following complaint and respond ONLY with a JSON object (no markdown, no extra text).
Complaint: ${JSON.stringify(text)}
Respond with valid JSON only, using exactly these keys (double-quoted strings):
{
  "issue_type": "short category",
  "department": "exact Indian govt dept with district",
  "severity": "low|medium|high|critical",
  "submit_to": "specific portal or office",
  "english_letter": "150-200 word formal complaint letter starting with 'To, The [Authority],' citing issue + relevant Indian laws/RTI",
  "urdu_letter": "100-150 word Urdu formal letter",
  "summary": "one line English summary"
}`;

  try {
    const resp = await fetch(API.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: API.maxTokens,
          temperature: 0.4,
        },
      }),
    });

    const data = await resp.json();
    clearInterval(msgInterval);
    if (!resp.ok) {
      const errMsg =
        (data && data.error && (data.error.message || data.error.status)) ||
        resp.statusText ||
        'Request failed';
      throw new Error(errMsg);
    }

    const raw = geminiResponseText(data);
    if (!raw.trim()) {
      throw new Error('Empty response from API');
    }

    const parsed = parseModelJson(raw);

    state.englishLetter = parsed.english_letter || '';
    state.urduLetter = parsed.urdu_letter || '';
    const tid = genTrackingId();

    document.getElementById('issueType').textContent = parsed.issue_type || '—';
    document.getElementById('department').textContent = parsed.department || '—';
    document.getElementById('submitTo').textContent = parsed.submit_to || '—';
    document.getElementById('trackingId').textContent = tid;
    document.getElementById('trackingIdMain').textContent = tid;
    document.getElementById('resultTitle').textContent = parsed.summary || 'Complaint Analyzed';
    document.getElementById('resultBadge').textContent = (parsed.severity || 'NEW').toUpperCase();

    const sev = (parsed.severity || 'medium').toLowerCase();
    const sevEl = document.getElementById('severity');
    sevEl.innerHTML = `<span class="badge-severity ${sev}">${sev.toUpperCase()}</span>`;

    showTab('en');
    lo.classList.remove('active');
    document.getElementById('resultCard').classList.add('visible');
  } catch (e) {
    clearInterval(msgInterval);
    lo.classList.remove('active');
    const phEl = document.getElementById('outputPlaceholder');
    phEl.style.display = 'flex';
    phEl.innerHTML =
      '<div class="output-placeholder-icon">⚠️</div><div>Error analyzing complaint. Please try again.</div>';
  }
  btn.disabled = false;
}
