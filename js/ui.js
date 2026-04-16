import { samples } from './samples.js';

export const state = {
  currentLang: 'en',
  englishLetter: '',
  urduLetter: '',
  currentTab: 'en',
};

export const PLACEHOLDER_HTML =
  '<div class="output-placeholder-icon">📋</div><div>Your complaint analysis will appear here</div><div style="font-size:12px; color: var(--ink3)">AI-powered • Legal • Anonymous</div>';

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
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    }
  ).catch(() => {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  });
}
