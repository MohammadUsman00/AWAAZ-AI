import { samples } from './samples.js';
import { refreshLucide } from './icons.js';

export const state = {
  currentLang: 'en',
  englishLetter: '',
  urduLetter: '',
  currentTab: 'en',
};

export const PLACEHOLDER_HTML = `<div class="output-placeholder-icon"><i data-lucide="file-text" class="icon-2xl icon-muted" aria-hidden="true"></i></div><div>Your complaint analysis will appear here</div><div class="output-placeholder-sub">AI-powered · Legal · Anonymous</div>`;

function copyBtnDefaultHtml() {
  return '<i data-lucide="copy" class="icon-sm" aria-hidden="true"></i> Copy';
}

export function setLang(lang, btn) {
  state.currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const ta = document.getElementById('complaintText');
  ta.classList.toggle('urdu', lang === 'ur');
  ta.placeholder =
    lang === 'ur'
      ? 'اپنی شکایت یہاں لکھیں...'
      : lang === 'hi'
        ? 'अपनी शिकायत यहाँ लिखें...'
        : lang === 'ks'
          ? 'کٔرۍ یتھ تہِ پَنٕنۍ شِکایت لِکھِو...'
          : "Describe your issue... e.g. 'The new road built in our village broke after first rain, contractor has disappeared with the money'";
  window.dispatchEvent(new CustomEvent('awaaz:lang'));
}

export function loadSample(type) {
  const ta = document.getElementById('complaintText');
  const row = samples[type];
  ta.value = row[state.currentLang] || row.en;
  ta.classList.toggle('urdu', state.currentLang === 'ur');
  refreshLucide();
}

export function showTab(tab) {
  state.currentTab = tab;
  document.getElementById('tabEn').classList.toggle('active', tab === 'en');
  document.getElementById('tabUr').classList.toggle('active', tab === 'ur');
  const lb = document.getElementById('letterBody');
  const ll = document.getElementById('letterLabel');
  if (tab === 'en') {
    lb.textContent = state.englishLetter || '—';
    lb.classList.remove('urdu-text');
    ll.textContent = 'Formal Complaint Letter (English)';
  } else {
    lb.textContent = state.urduLetter || '—';
    lb.classList.add('urdu-text');
    ll.textContent = 'شکایتی خط (اردو)';
  }
}

export function copyLetter() {
  const text = document.getElementById('letterBody').textContent;
  const copyBtn = document.getElementById('copyLetterBtn');
  navigator.clipboard.writeText(text).then(
    () => {
      copyBtn.innerHTML = '<i data-lucide="copy" class="icon-sm" aria-hidden="true"></i> Copied!';
      refreshLucide();
      setTimeout(() => {
        copyBtn.innerHTML = copyBtnDefaultHtml();
        refreshLucide();
      }, 2000);
    }
  ).catch(() => {
    copyBtn.innerHTML = '<i data-lucide="copy" class="icon-sm" aria-hidden="true"></i> Copy failed';
    refreshLucide();
    setTimeout(() => {
      copyBtn.innerHTML = copyBtnDefaultHtml();
      refreshLucide();
    }, 2000);
  });
}
