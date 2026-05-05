/**
 * Voice: Web Speech API when available; otherwise Record & Upload → /api/transcribe (Groq).
 */
import { state } from './ui.js';
import { API } from './config.js';

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const LANG_CODES = {
  en: 'en-IN',
  ur: 'ur-PK',
  hi: 'hi-IN',
  ks: 'ur-IN',
};

/** Groq / Whisper language hint */
const GROQ_LANG = {
  en: 'en',
  ur: 'ur',
  hi: 'hi',
  ks: 'ur',
};

let recognition = null;
let listening = false;

let mediaRecorder = null;
let recordChunks = [];
let recordTimerId = null;
let recordStart = 0;
let recordSeconds = 0;

export function isVoiceSupported() {
  return Boolean(SpeechRecognition);
}

function langForRecognition() {
  return LANG_CODES[state.currentLang] || 'en-IN';
}

function groqLang() {
  return GROQ_LANG[state.currentLang] || 'en';
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
    speechRow: document.getElementById('voiceSpeechRow'),
    fallback: document.getElementById('voiceFallback'),
    recordBtn: document.getElementById('recordUploadBtn'),
    recordHint: document.getElementById('voiceFallbackHint'),
    recordInd: document.getElementById('recordIndicator'),
    recordTimer: document.getElementById('recordTimer'),
  };
}

function setRecordingUI(on, interimLine = '') {
  const { mic, status } = getEls();
  if (mic) {
    mic.classList.toggle('recording', on);
    const icon = mic.querySelector('svg.lucide, i[data-lucide]');
    if (on) {
      icon?.classList.remove('icon-white');
      icon?.classList.add('icon-recording');
    } else {
      icon?.classList.remove('icon-recording');
      icon?.classList.add('icon-white');
    }
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

export function refreshVoiceLangHint() {
  const { status } = getEls();
  if (!status || listening) return;
  if (!isVoiceSupported()) return;
  const labels = {
    en: 'English (India) recognition',
    ur: 'Urdu recognition',
    hi: 'Hindi recognition',
    ks: 'Kashmiri recognition',
  };
  const hint = labels[state.currentLang] || labels.en;
  status.textContent = `Tap the mic to dictate (${hint}).`;
}

function formatTimer(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function resetRecordUi() {
  const { recordBtn, recordInd, recordHint } = getEls();
  mediaRecorder = null;
  if (recordTimerId) clearInterval(recordTimerId);
  recordTimerId = null;
  if (recordBtn) {
    recordBtn.disabled = false;
    recordBtn.textContent = 'Record & Upload';
  }
  if (recordInd) recordInd.hidden = true;
  if (recordHint) recordHint.textContent = 'Records up to 60 seconds. Sent securely for transcription.';
}

async function uploadRecording(blob) {
  const { recordHint } = getEls();
  if (recordHint) recordHint.textContent = 'Uploading for transcription…';
  const url = `${API.baseUrl}/api/transcribe`;
  const fd = new FormData();
  fd.append('audio', blob, 'recording.webm');
  fd.append('language', groqLang());

  const resp = await fetch(url, { method: 'POST', body: fd });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data.error || resp.statusText || 'Transcription failed';
    throw new Error(msg);
  }
  const text = data.transcript || '';
  appendTranscript(text);
  if (recordHint) recordHint.textContent = 'Done — text added to your complaint.';
}

function startRecordingFallback() {
  const { recordBtn, recordInd, recordTimer, recordHint } = getEls();
  if (!navigator.mediaDevices?.getUserMedia) {
    if (recordHint) recordHint.textContent = 'Microphone not available in this browser.';
    return;
  }

  recordChunks = [];
  recordSeconds = 0;
  if (recordTimer) recordTimer.textContent = formatTimer(0);
  if (recordInd) recordInd.hidden = false;
  if (recordBtn) {
    recordBtn.disabled = false;
    recordBtn.textContent = 'Stop';
  }
  if (recordHint) recordHint.textContent = 'Recording… max 60 seconds.';

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) recordChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunks, { type: mime });
        recordChunks = [];
        resetRecordUi();
        uploadRecording(blob).catch((e) => {
          const hint = getEls().recordHint;
          if (hint) hint.textContent = e.message || 'Upload failed.';
        });
      };
      mediaRecorder.start(200);
      recordStart = Date.now();
      recordTimerId = setInterval(() => {
        recordSeconds = Math.floor((Date.now() - recordStart) / 1000);
        if (recordTimer) recordTimer.textContent = formatTimer(recordSeconds);
        if (recordSeconds >= 60 && mediaRecorder && mediaRecorder.state === 'recording') {
          clearInterval(recordTimerId);
          recordTimerId = null;
          mediaRecorder.stop();
        }
      }, 400);
    })
    .catch(() => {
      resetRecordUi();
      if (recordHint) recordHint.textContent = 'Microphone permission denied.';
    });
}

function toggleRecordingFallback() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  startRecordingFallback();
}

function showFallbackUI() {
  const { speechRow, fallback, mic } = getEls();
  if (speechRow) speechRow.hidden = true;
  if (fallback) fallback.hidden = false;
  if (mic) mic.disabled = true;
}

export function initVoice() {
  const { mic, status, fallback, recordBtn, speechRow } = getEls();

  if (!isVoiceSupported()) {
    if (status) {
      status.textContent =
        'Web Speech API not available. Use Record & Upload, or type your complaint.';
    }
    showFallbackUI();
    recordBtn?.addEventListener('click', () => toggleRecordingFallback());
    window.addEventListener('awaaz:lang', () => {
      /* groqLang uses state.currentLang */
    });
    return;
  }

  if (!mic) return;

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
