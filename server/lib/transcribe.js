/**
 * Groq Whisper transcription (free tier)
 */

export async function transcribeAudio(buffer, mimeType, language) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    const err = new Error('Voice transcription not configured');
    err.code = 'NO_GROQ';
    throw err;
  }

  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  const ext = mimeType?.includes('mp4') ? 'm4a' : mimeType?.includes('wav') ? 'wav' : 'webm';
  form.append('file', blob, `audio.${ext}`);
  form.append('model', 'whisper-large-v3');
  if (language && typeof language === 'string' && language.length >= 2) {
    form.append('language', language.slice(0, 8));
  }

  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: form,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || data?.message || resp.statusText || 'Transcription failed';
    throw new Error(msg);
  }

  const transcript = typeof data.text === 'string' ? data.text : '';
  return transcript;
}
