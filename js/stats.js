import { API } from './config.js';

const FALLBACK_BARS = [
  { label: 'Infrastructure / Roads', pct: 85 },
  { label: 'Water Supply', pct: 62 },
  { label: 'School / Education', pct: 47 },
  { label: 'Ration / PDS', pct: 38 },
  { label: 'Electricity', pct: 29 },
];

function renderBars(container, items, maxCount) {
  if (!container) return;
  const max = maxCount > 0 ? maxCount : 1;
  container.innerHTML = items
    .map((row, i) => {
      const pct = Math.round((row.count / max) * 100);
      const colors = ['var(--saffron)', 'var(--saffron2)', 'var(--gold)', 'var(--emerald2)', 'var(--emerald2)'];
      const bg = colors[i % colors.length];
      const label = row.issue_type || 'Other';
      return `<div class="bar-row">
        <div class="bar-label">${escapeHtml(truncate(label, 28))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:0%; background:${bg}" data-width="${pct}%"></div></div>
        <div class="bar-pct">${row.count}</div>
      </div>`;
    })
    .join('');
  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach((el) => {
      const w = el.getAttribute('data-width');
      if (w) el.style.width = w;
    });
  });
}

function renderBarsFallback(container) {
  if (!container) return;
  const max = 100;
  container.innerHTML = FALLBACK_BARS.map((row, i) => {
    const colors = ['var(--saffron)', 'var(--saffron2)', 'var(--gold)', 'var(--emerald2)', 'var(--emerald2)'];
    const bg = colors[i % colors.length];
    return `<div class="bar-row">
      <div class="bar-label">${row.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:0%; background:${bg}" data-width="${row.pct}%"></div></div>
      <div class="bar-pct">${row.pct}%</div>
    </div>`;
  }).join('');
  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach((el) => {
      const w = el.getAttribute('data-width');
      if (w) el.style.width = w;
    });
  });
}

function renderIssues(container, items) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="issue-row"><div class="issue-name">No data yet</div><div class="issue-count">—</div></div>';
    return;
  }
  container.innerHTML = items
    .map(
      (row) => `<div class="issue-row">
      <div class="issue-name">${escapeHtml(truncate(row.issue_type || 'Issue', 40))}</div>
      <div class="issue-count">${row.count}</div>
    </div>`
    )
    .join('');
}

function truncate(s, n) {
  const t = String(s);
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function initStats() {
  const barsEl = document.getElementById('statsBars');
  const issuesEl = document.getElementById('statsIssues');
  const badge = document.getElementById('statsLiveBadge');

  try {
    const url = `${API.baseUrl}/api/stats`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('stats failed');
    const data = await resp.json();
    const top = (data.by_issue_type || []).slice(0, 5);
    const maxCount = top.length ? Math.max(...top.map((x) => x.count), 1) : 1;
    if (top.length) {
      renderBars(barsEl, top, maxCount);
    } else {
      renderBarsFallback(barsEl);
    }
    renderIssues(issuesEl, (data.by_issue_type || []).slice(0, 6));
    if (badge) {
      badge.style.display = 'inline-flex';
      badge.textContent = `Live data · updated ${new Date().toLocaleString()}`;
    }
  } catch {
    renderBarsFallback(barsEl);
    renderIssues(issuesEl, []);
    if (badge) {
      badge.style.display = 'inline-flex';
      badge.textContent = 'Illustrative data (API unavailable)';
    }
  }
}
