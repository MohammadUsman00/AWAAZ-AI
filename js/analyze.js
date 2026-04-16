import { API } from './config.js';
import { state, showTab, PLACEHOLDER_HTML } from './ui.js';
import { getSessionId } from './session.js';
import { setLastTrackingId } from './history.js';

const LOADING_MESSAGES = [
  'Transcribing your complaint...',
  'Identifying issue & department...',
  'Searching government authorities...',
  'Generating formal complaint letter...',
  'Preparing Urdu translation...',
];

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

  const url = `${API.baseUrl}${API.analyzePath}`;
  const emailEl = document.getElementById('complaintEmail');
  const email = emailEl && emailEl.value ? String(emailEl.value).trim() : '';

  try {
    const body = {
      text,
      language: state.currentLang,
      sessionId: getSessionId(),
    };
    if (email) body.email = email;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await resp.json().catch(() => ({}));
    clearInterval(msgInterval);

    if (!resp.ok) {
      const errMsg = payload.error || resp.statusText || 'Request failed';
      throw new Error(errMsg);
    }

    const { trackingId, analysis } = payload;
    if (!analysis) {
      throw new Error('Invalid response from server');
    }

    setLastTrackingId(trackingId);
    const pdfLink = document.getElementById('pdfDownloadBtn');
    if (pdfLink && trackingId) {
      pdfLink.href = `${API.baseUrl}/api/complaints/${encodeURIComponent(trackingId)}/pdf`;
      pdfLink.style.display = 'inline-flex';
    }

    state.englishLetter = analysis.english_letter || '';
    state.urduLetter = analysis.urdu_letter || '';

    document.getElementById('issueType').textContent = analysis.issue_type || '—';
    document.getElementById('department').textContent = analysis.department || '—';
    document.getElementById('submitTo').textContent = analysis.submit_to || '—';
    document.getElementById('trackingId').textContent = trackingId || '—';
    document.getElementById('trackingIdMain').textContent = trackingId || '—';
    document.getElementById('resultTitle').textContent = analysis.summary || 'Complaint Analyzed';
    document.getElementById('resultBadge').textContent = (analysis.severity || 'NEW').toUpperCase();

    const sev = (analysis.severity || 'medium').toLowerCase();
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
    const detail = e && e.message ? String(e.message) : '';
    phEl.innerHTML = `<div class="output-placeholder-icon">⚠️</div><div>Error analyzing complaint. Please try again.</div><div style="font-size:12px; color: var(--ink3); max-width: 280px">${escapeHtml(detail)}</div>`;
  }
  btn.disabled = false;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
