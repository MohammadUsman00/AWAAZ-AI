/**
 * Server-side Gemini generateContent call (API key never sent to browser).
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MAX_TOKENS = parseInt(process.env.GEMINI_MAX_TOKENS || '2048', 10);

function buildPrompt(text) {
  return `You are Awaaz AI, a civic complaint assistant for rural India. Analyze the following complaint and respond ONLY with a JSON object (no markdown, no extra text).
Complaint: ${JSON.stringify(text)}
Respond with valid JSON only, using exactly these keys (double-quoted strings):
{
  "issue_type": "short category",
  "department": "exact Indian govt dept with district",
  "severity": "low|medium|high|critical",
  "submit_to": "specific portal or office",
  "english_letter": "150-200 word formal complaint letter starting with 'To, The [Authority],' citing issue + relevant Indian laws/RTI",
  "urdu_letter": "100-150 word Urdu formal letter",
  "summary": "one line English summary"
}`;
}

function extractText(data) {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.map((p) => p.text || '').join('');
}

function parseModelJson(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Model did not return valid JSON');
    return JSON.parse(m[0]);
  }
}

/**
 * @param {string} text - complaint body
 * @returns {Promise<object>} Parsed analysis fields (issue_type, department, ...)
 */
export async function runGeminiAnalysis(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Server misconfiguration: GEMINI_API_KEY is not set');
  }

  const model = DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

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
      },
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const msg =
      data?.error?.message || data?.error?.status || resp.statusText || 'Gemini request failed';
    throw new Error(msg);
  }

  const raw = extractText(data);
  if (!raw.trim()) {
    throw new Error('Empty response from Gemini');
  }

  return parseModelJson(raw);
}
