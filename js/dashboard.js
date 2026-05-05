/**
 * User dashboard — session-scoped complaint list (same localStorage session as main app).
 */
import { API } from './config.js';
import { getSessionId } from './session.js';
import { initTheme } from './theme.js';
import { refreshLucide } from './icons.js';

let allItems = [];

const COPY_BTN_HTML = '<i data-lucide="copy" class="icon-sm" aria-hidden="true"></i> Copy';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function severityClass(sev) {
  const k = (sev || 'medium').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(k)) return `dash-sev dash-sev--${k}`;
  return 'dash-sev dash-sev--medium';
}

function computeMetrics(items) {
  const total = items.length;
  let filed = 0;
  let review = 0;
  let resolved = 0;
  for (const row of items) {
    const st = (row.status || 'filed').toLowerCase();
    if (st === 'filed') filed += 1;
    else if (st === 'under_review') review += 1;
    else if (st === 'resolved') resolved += 1;
  }
  return { total, filed, review, resolved };
}

function renderMetrics(items) {
  const m = computeMetrics(items);
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
  };
  set('mTotal', m.total);
  set('mFiled', m.filed);
  set('mReview', m.review);
  set('mResolved', m.resolved);
}

function renderTable(items) {
  const tbody = document.getElementById('complaintRows');
  const tableWrap = document.getElementById('tableWrap');
  const empty = document.getElementById('emptyState');
  if (!tbody || !tableWrap || !empty) return;

  tbody.innerHTML = '';
  if (!items.length) {
    if (allItems.length === 0) {
      tableWrap.hidden = true;
      empty.hidden = false;
      refreshLucide();
      return;
    }
    empty.hidden = true;
    tableWrap.hidden = false;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.5rem">No complaints match this filter.</td>';
    tbody.appendChild(tr);
    refreshLucide();
    return;
  }
  empty.hidden = true;
  tableWrap.hidden = false;

  for (const row of items) {
    const tid = row.trackingId || '';
    const pdf = `${API.baseUrl}/api/complaints/${encodeURIComponent(tid)}/pdf`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code class="dashboard-tid">${escapeHtml(tid)}</code></td>
      <td>${escapeHtml(row.issueType || '—')}</td>
      <td><span class="${severityClass(row.severity)}">${escapeHtml((row.severity || '—').toString())}</span></td>
      <td><span class="dashboard-status-pill">${escapeHtml(row.status || 'filed')}</span></td>
      <td>${escapeHtml((row.createdAt || '').slice(0, 10))}</td>
      <td><a class="dashboard-pdf" href="${pdf}" target="_blank" rel="noopener"><i data-lucide="file-down" class="icon-sm" aria-hidden="true"></i> PDF</a></td>
    `;
    tbody.appendChild(tr);
  }
  refreshLucide();
}

function applyFilter() {
  const sel = document.getElementById('statusFilter');
  const v = sel ? sel.value : '';
  if (!v) {
    renderTable(allItems);
    renderMetrics(allItems);
    return;
  }
  const filtered = allItems.filter((r) => (r.status || 'filed').toLowerCase() === v.toLowerCase());
  renderTable(filtered);
  renderMetrics(allItems);
}

async function loadComplaints() {
  const loading = document.getElementById('loadingState');
  const errEl = document.getElementById('errorState');
  if (loading) loading.hidden = false;
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = '';
  }

  const sid = getSessionId();
  const sidEl = document.getElementById('sessionIdDisplay');
  if (sidEl) sidEl.textContent = sid;

  try {
    const url = `${API.baseUrl}/api/session/complaints?sessionId=${encodeURIComponent(sid)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || 'Failed to load');
    allItems = Array.isArray(data.items) ? data.items : [];
    if (loading) loading.hidden = true;
    renderMetrics(allItems);
    applyFilter();
  } catch (e) {
    if (loading) loading.hidden = true;
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = e.message || 'Could not load complaints.';
    }
    document.getElementById('emptyState')?.setAttribute('hidden', '');
    document.getElementById('tableWrap')?.setAttribute('hidden', '');
  }
  refreshLucide();
}

function initNav() {
  document.querySelector('.nav-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
  });
  document.querySelectorAll('.nav-links a').forEach((a) => {
    a.addEventListener('click', () => document.body.classList.remove('nav-open'));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  document.getElementById('refreshBtn')?.addEventListener('click', () => loadComplaints());
  document.getElementById('statusFilter')?.addEventListener('change', () => applyFilter());
  document.getElementById('copySessionBtn')?.addEventListener('click', async () => {
    const sid = getSessionId();
    try {
      await navigator.clipboard.writeText(sid);
      const btn = document.getElementById('copySessionBtn');
      if (btn) {
        btn.innerHTML = '<i data-lucide="copy" class="icon-sm" aria-hidden="true"></i> Copied!';
        refreshLucide();
        setTimeout(() => {
          btn.innerHTML = COPY_BTN_HTML;
          refreshLucide();
        }, 2000);
      }
    } catch {
      /* ignore */
    }
  });
  loadComplaints();
  refreshLucide();
});
