import { setLang, loadSample, showTab, copyLetter } from './ui.js';
import { analyzeComplaint } from './analyze.js';
import { initVoice } from './voice.js';

function initNav() {
  document.querySelector('.nav-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
  });
  document.querySelectorAll('.nav-links a').forEach((a) => {
    a.addEventListener('click', () => document.body.classList.remove('nav-open'));
  });
}

function initDemo() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang, btn));
  });
  document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', () => loadSample(btn.dataset.sample));
  });
  document.getElementById('analyzeBtn')?.addEventListener('click', analyzeComplaint);
  document.getElementById('tabEn')?.addEventListener('click', () => showTab('en'));
  document.getElementById('tabUr')?.addEventListener('click', () => showTab('ur'));
  document.getElementById('copyLetterBtn')?.addEventListener('click', copyLetter);
  document.querySelector('.cta-btn')?.addEventListener('click', () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initDemo();
  initVoice();
});
