/**
 * Voice input via Web Speech API (speech-to-text in the browser).
 * Works best in Chromium browsers (Chrome, Edge) on https:// or localhost.
 */
import { state } from './ui.js';

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** BCP-47 tags tuned for India / Urdu */
const LANG_CODES = {
  en: 'en-IN',
  ur: 'ur-PK',
  hi: 'hi-IN',
};

let recognition = null;
let listening = false;

export function isVoiceSupported() {
  return Boolean(SpeechRecognition);
}

function langForRecognition() {
  return LANG_CODES[state.currentLang] || 'en-IN';
}

function appendTranscript(chunk) {
  const ta = document.getElementById('complaintText');
  if (!ta || !chunk.trim()) return;
  const t = chunk.trim();
  if (ta.value && !/\s$/.test(ta.value)) ta.value += ' ';
  ta.value += t;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function getEls() {
  return {
    mic: document.getElementById('micBtn'),
    status: document.getElementById('voiceStatus'),
  };
}

function setRecordingUI(on, interimLine = '') {
  const { mic, status } = getEls();
  if (mic) {
    mic.classList.toggle('recording', on);
    mic.setAttribute('aria-pressed', on ? 'true' : 'false');
    mic.setAttribute('aria-label', on ? 'Stop recording' : 'Speak your complaint');
  }
  if (status) {
    if (!isVoiceSupported()) return;
    if (on) {
      status.textContent = interimLine || 'Listening… speak your complaint';
    } else {
      refreshVoiceLangHint();
    }
  }
}

function ensureRecognition() {
  if (recognition || !SpeechRecognition) return;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const text = res[0].transcript;
      if (res.isFinal) {
        appendTranscript(text);
      } else {
        interim += text;
      }
    }
    setRecordingUI(true, interim ? `Listening… ${interim}` : 'Listening…');
  };

  recognition.onerror = (e) => {
    const { status } = getEls();
    let msg = 'Voice error. Try again or type instead.';
    if (e.error === 'not-allowed') msg = 'Microphone blocked — allow access in the browser address bar.';
    else if (e.error === 'no-speech') msg = 'No speech detected. Tap mic and try again.';
    else if (e.error === 'network') msg = 'Network error for speech recognition.';
    if (status) status.textContent = msg;
    listening = false;
    setRecordingUI(false);
  };

  recognition.onend = () => {
    listening = false;
    setRecordingUI(false);
  };
}

export function toggleVoice() {
  if (!isVoiceSupported()) return;

  ensureRecognition();

  if (listening) {
    try {
      recognition.stop();
    } catch {
      listening = false;
      setRecordingUI(false);
    }
    return;
  }

  recognition.lang = langForRecognition();
  try {
    recognition.start();
    listening = true;
    setRecordingUI(true);
  } catch {
    listening = false;
    setRecordingUI(false);
    const { status } = getEls();
    if (status) status.textContent = 'Could not start microphone. Check permissions.';
  }
}

/** Call when language buttons change so the next session uses the right locale. */
export function refreshVoiceLangHint() {
  const { status } = getEls();
  if (!status || listening) return;
  if (!isVoiceSupported()) return;
  const labels = {
    en: 'English (India) recognition',
    ur: 'Urdu recognition',
    hi: 'Hindi recognition',
  };
  const hint = labels[state.currentLang] || labels.en;
  status.textContent = `Tap the mic to dictate (${hint}).`;
}

export function initVoice() {
  const { mic, status } = getEls();
  if (!mic) return;

  if (!isVoiceSupported()) {
    mic.disabled = true;
    mic.classList.add('mic-btn--disabled');
    if (status) {
      status.textContent =
        'Voice typing needs Chrome or Edge (Web Speech API). You can still type your complaint.';
    }
    return;
  }

  mic.addEventListener('click', () => toggleVoice());

  window.addEventListener('awaaz:lang', () => {
    if (listening && recognition) {
      try {
        recognition.stop();
      } catch {
        listening = false;
        setRecordingUI(false);
      }
    } else {
      refreshVoiceLangHint();
    }
  });

  refreshVoiceLangHint();
}
