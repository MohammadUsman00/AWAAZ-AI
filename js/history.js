import { API } from './config.js';
import { getSessionId } from './session.js';

export function setLastTrackingId() {
  /* hook after successful analyze (e.g. highlight latest) */
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function severityDot(sev) {
  const k = (sev || 'medium').toLowerCase();
  const map = {
    critical: 'crimson',
    high: 'var(--saffron)',
    medium: 'var(--gold)',
    low: 'var(--emerald)',
  };
  const color = map[k] || map.medium;
  return `<span class="history-sev-dot" style="background:${color}"></span>`;
}

function statusPill(st) {
  return `<span class="history-status">${escapeHtml(st || 'filed')}</span>`;
}

export async function toggleHistory() {
  const panel = document.getElementById('historyPanel');
  const inner = document.getElementById('historyInner');
  const link = document.getElementById('historyToggle');
  if (!panel || !inner) return;

  const open = panel.classList.toggle('history-panel--open');
  if (link) link.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (!open) return;

  inner.innerHTML = '<div class="history-loading">Loading…</div>';
  try {
    const sid = getSessionId();
    const url = `${API.baseUrl}/api/session/complaints?sessionId=${encodeURIComponent(sid)}`;
    const resp = await fetch(url);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Failed');
    const items = data.items || [];
    if (!items.length) {
      inner.innerHTML = '<p class="history-empty">No previous complaints in this session</p>';
      return;
    }
    inner.innerHTML = items
      .map((row) => {
        const tid = row.trackingId || '';
        const pdf = `${API.baseUrl}/api/complaints/${encodeURIComponent(tid)}/pdf`;
        return `<div class="history-item">
          <div class="history-item-main">
            <span class="history-track">${escapeHtml(tid)}</span>
            ${severityDot(row.severity)}
            <span class="history-issue">${escapeHtml(row.issueType || '—')}</span>
            ${statusPill(row.status)}
          </div>
          <div class="history-item-meta">
            <span>${escapeHtml((row.createdAt || '').slice(0, 10))}</span>
            <a class="history-pdf" href="${pdf}" target="_blank" rel="noopener">Download PDF</a>
          </div>
        </div>`;
      })
      .join('');
  } catch {
    inner.innerHTML = '<p class="history-empty">Could not load complaints.</p>';
  }
}

export function initHistory() {
  document.getElementById('historyToggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleHistory();
  });
}
