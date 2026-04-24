/**
 * Server-side Gemini generateContent call (API key never sent to browser).
 */

import crypto from 'crypto';
import {
  addDailyEstimatedTokens,
  getAnalysisCache,
  getDailyEstimatedTokens,
  purgeExpiredAnalysisCache,
  putAnalysisCache,
  trimAnalysisCache,
} from '../db/ai-control.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const MAX_TOKENS = parseInt(process.env.GEMINI_MAX_TOKENS || '2048', 10);
const MAX_RETRIES = Math.max(0, parseInt(process.env.GEMINI_MAX_RETRIES || '2', 10));
const LETTER_STYLE = (process.env.GEMINI_LETTER_STYLE || 'compact').toLowerCase();
const CACHE_MAX_ITEMS = Math.max(0, parseInt(process.env.ANALYZE_CACHE_MAX_ITEMS || '300', 10));
const CACHE_TTL_MS = Math.max(0, parseInt(process.env.ANALYZE_CACHE_TTL_MS || String(24 * 60 * 60 * 1000), 10));
const DAILY_AI_TOKEN_BUDGET = Math.max(0, parseInt(process.env.DAILY_AI_TOKEN_BUDGET || '0', 10));
const ENABLE_GROQ_FALLBACK = process.env.ENABLE_GROQ_FALLBACK !== '0';
const analysisCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(text) {
  const englishLen = LETTER_STYLE === 'detailed' ? '130-170 words' : '90-120 words';
  const urduLen = LETTER_STYLE === 'detailed' ? '90-130 words' : '60-90 words';
  return `You are Awaaz AI, a civic complaint assistant for rural India. Analyze the following complaint and respond ONLY with a JSON object (no markdown, no extra text).
Complaint: ${JSON.stringify(text)}
Keep output concise and practical. Do not add any keys besides those requested.
Respond with valid JSON only, using exactly these keys (double-quoted strings):
{
  "issue_type": "short category",
  "department": "exact Indian govt department (include district/city if inferable)",
  "severity": "low|medium|high|critical",
  "submit_to": "specific portal or office",
  "english_letter": "${englishLen} formal complaint letter starting with 'To, The [Authority],'. Keep legal references minimal (max 1-2).",
  "urdu_letter": "${urduLen} Urdu formal complaint letter with similar meaning",
  "summary": "single English sentence, max 22 words"
}`;
}

function normalizeInput(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cacheKeyFor(text) {
  return crypto.createHash('sha256').update(normalizeInput(text)).digest('hex');
}

function estimateTokens(inputText, outputObj) {
  const inChars = String(inputText || '').length;
  const outChars = JSON.stringify(outputObj || {}).length;
  return Math.ceil((inChars + outChars) / 4);
}

function enforceDailyBudgetOrThrow() {
  if (DAILY_AI_TOKEN_BUDGET <= 0) return;
  const used = getDailyEstimatedTokens();
  if (used >= DAILY_AI_TOKEN_BUDGET) {
    throw new Error('Daily AI budget reached. Please try again tomorrow.');
  }
}

function getCachedAnalysis(text) {
  const key = cacheKeyFor(text);
  const persisted = getAnalysisCache(key);
  if (persisted) {
    return persisted;
  }
  const hit = analysisCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    analysisCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedAnalysis(text, value, provider = 'gemini') {
  if (CACHE_MAX_ITEMS <= 0 || CACHE_TTL_MS <= 0 || !value) return;
  const key = cacheKeyFor(text);
  putAnalysisCache({
    cacheKey: key,
    inputHash: key,
    response: value,
    provider,
    ttlMs: CACHE_TTL_MS,
  });
  trimAnalysisCache(CACHE_MAX_ITEMS);
  if (analysisCache.size >= CACHE_MAX_ITEMS) {
    const oldest = analysisCache.keys().next().value;
    if (oldest) analysisCache.delete(oldest);
  }
  analysisCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function extractText(data) {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.map((p) => p.text || '').join('');
}

function parseModelJson(raw) {
  const clean = raw.replace(/```json|```/gi, '').replace(/^\uFEFF/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Gemini can occasionally wrap JSON with explanatory text.
    // Find balanced JSON segments and parse the first valid one.
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    const stack = [];
    const closingToOpening = { '}': '{', ']': '[' };

    for (let i = 0; i < clean.length; i += 1) {
      const ch = clean[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{' || ch === '[') {
        if (depth === 0) start = i;
        stack.push(ch);
        depth += 1;
        continue;
      }
      if (ch === '}' || ch === ']') {
        if (depth === 0) continue;
        const expected = closingToOpening[ch];
        const top = stack[stack.length - 1];
        if (top !== expected) {
          stack.length = 0;
          depth = 0;
          start = -1;
          continue;
        }
        stack.pop();
        depth -= 1;
        if (depth === 0 && start >= 0) {
          const candidate = clean.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) {
              const firstObject = parsed.find((item) => item && typeof item === 'object' && !Array.isArray(item));
              if (firstObject) return firstObject;
            } else if (parsed && typeof parsed === 'object') {
              return parsed;
            }
          } catch {
            // keep scanning in case there is another valid object later
          }
        }
      }
    }

    throw new Error(`Model did not return valid JSON. Preview: ${clean.slice(0, 220)}`);
  }
}

function sanitizeAnalysisFields(parsed) {
  const o = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    issue_type: String(o.issue_type || '').slice(0, 120),
    department: String(o.department || '').slice(0, 200),
    severity: String(o.severity || 'medium').toLowerCase().slice(0, 20),
    submit_to: String(o.submit_to || '').slice(0, 220),
    english_letter: String(o.english_letter || '').slice(0, 3000),
    urdu_letter: String(o.urdu_letter || '').slice(0, 2500),
    summary: String(o.summary || '').slice(0, 240),
  };
}

async function runGroqAnalysis(text) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq fallback is not configured');
  }
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildPrompt(text) }],
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || data?.message || resp.statusText || 'Groq request failed';
    throw new Error(`Groq fallback failed: ${msg}`);
  }
  const raw = data?.choices?.[0]?.message?.content || '';
  if (!String(raw).trim()) {
    throw new Error('Groq fallback returned empty response');
  }
  return sanitizeAnalysisFields(parseModelJson(String(raw)));
}

/**
 * @param {string} text - complaint body
 * @returns {Promise<object>} Parsed analysis fields (issue_type, department, ...)
 */
export async function runGeminiAnalysis(text) {
  purgeExpiredAnalysisCache();
  const cached = getCachedAnalysis(text);
  if (cached) return cached;
  enforceDailyBudgetOrThrow();

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    if (ENABLE_GROQ_FALLBACK && process.env.GROQ_API_KEY) {
      const groqOnly = await runGroqAnalysis(text);
      setCachedAnalysis(text, groqOnly, 'groq');
      addDailyEstimatedTokens(estimateTokens(text, groqOnly));
      return groqOnly;
    }
    throw new Error('Server misconfiguration: GEMINI_API_KEY is not set');
  }

  const model = DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  let lastRetryableError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(text) }],
          },
        ],
        generationConfig: {
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg =
        data?.error?.message || data?.error?.status || resp.statusText || 'Gemini request failed';
      const retryable = resp.status === 429 || resp.status === 500 || resp.status === 503;
      if (retryable && attempt < MAX_RETRIES) {
        lastRetryableError = new Error(`Gemini temporarily overloaded: ${msg}`);
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (retryable) {
        lastRetryableError = new Error(`Gemini temporarily overloaded: ${msg}`);
        break;
      }
      throw new Error(msg);
    }

    const raw = extractText(data);
    if (!raw.trim()) {
      throw new Error('Empty response from Gemini');
    }

    const out = sanitizeAnalysisFields(parseModelJson(raw));
    setCachedAnalysis(text, out, 'gemini');
    addDailyEstimatedTokens(estimateTokens(text, out));
    return out;
  }
  if (ENABLE_GROQ_FALLBACK && process.env.GROQ_API_KEY) {
    const fallback = await runGroqAnalysis(text);
    setCachedAnalysis(text, fallback, 'groq');
    addDailyEstimatedTokens(estimateTokens(text, fallback));
    return fallback;
  }
  if (lastRetryableError) {
    throw lastRetryableError;
  }
  throw new Error('Gemini request failed after retries and fallback unavailable');
}
