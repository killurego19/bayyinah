// api/ask.js  —  Runs on Vercel as a serverless function.
//
// The browser calls /api/ask. This function:
//   1) Checks a short-term CACHE — identical recent questions are served free (no API call).
//   2) Calls GEMINI (primary, generous daily volume).
//   3) If Gemini is rate-limited / fails, automatically FALLS BACK to GROQ (free, fast).
//
// Your secret keys live only here as environment variables — never sent to the browser.
//
// Required env var:  GEMINI_API_KEY
// Optional env var:  GROQ_API_KEY   (enables the fallback; get a free key at console.groq.com)

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL   = "llama-3.3-70b-versatile"; // free fallback; far stronger multilingual/Tamil than 8b

// ---- simple in-memory cache (per warm serverless instance) ----
// Keyed by the exact request. Lives ~30 min. Repeated popular questions cost 0 API calls.
const CACHE = globalThis.__bayyinah_cache || (globalThis.__bayyinah_cache = new Map());
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;
function cacheKey(system, messages, maxTokens){
  return JSON.stringify({ s: system, m: messages, t: maxTokens });
}
function cacheGet(k){
  const e = CACHE.get(k);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL_MS){ CACHE.delete(k); return null; }
  return e.text;
}
function cacheSet(k, text){
  if (CACHE.size >= CACHE_MAX){ const first = CACHE.keys().next().value; CACHE.delete(first); }
  CACHE.set(k, { text, t: Date.now() });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY; // optional

  if (!geminiKey && !groqKey) {
    res.status(500).json({ error: "Server is missing both GEMINI_API_KEY and GROQ_API_KEY. Add at least one in Vercel project settings." });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { messages = [], system = "", maxTokens = 1000 } = payload;

    // 1) CACHE CHECK
    const ck = cacheKey(system, messages, maxTokens);
    const cached = cacheGet(ck);
    if (cached) { res.status(200).json({ text: cached, cached: true }); return; }

    // ---- Gemini call ----
    async function callGemini(){
      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content || "") }]
      }));
      const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 } };
      if (system) body.system_instruction = { parts: [{ text: system }] };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;
      const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await resp.json().catch(() => ({}));
      const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
      return { ok: resp.ok, status: resp.status, text };
    }

    // ---- Groq call (OpenAI-compatible) ----
    async function callGroq(){
      const oaMessages = [];
      if (system) oaMessages.push({ role: "system", content: system });
      for (const m of messages) oaMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") });
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages: oaMessages, max_tokens: maxTokens, temperature: 0.4 })
      });
      const json = await resp.json().catch(() => ({}));
      const text = json?.choices?.[0]?.message?.content || "";
      return { ok: resp.ok, status: resp.status, text };
    }

    let result = null;

    // 2) PRIMARY: Gemini (if key present)
    if (geminiKey) {
      result = await callGemini();
      // one quick retry on transient rate limit before falling back
      if (!result.ok && result.status === 429) {
        await new Promise(r => setTimeout(r, 1500));
        result = await callGemini();
      }
    }

    // 3) FALLBACK: Groq (if Gemini missing, failed, or returned empty) and a Groq key exists
    if ((!result || !result.ok || !result.text) && groqKey) {
      const g = await callGroq();
      if (g.ok && g.text) result = g;
      else if (!result) result = g; // keep error info if both failed
    }

    if (!result || !result.ok) {
      const status = result?.status || 500;
      if (status === 429) {
        res.status(429).json({ error: "Busy right now (free usage limit reached for the moment). Please wait a minute and try again." });
      } else {
        res.status(status).json({ error: "AI service error (" + status + "). Please try again shortly." });
      }
      return;
    }

    if (!result.text) { res.status(200).json({ text: "", note: "No text returned (possibly filtered)." }); return; }

    // store in cache for repeated questions
    cacheSet(ck, result.text);
    res.status(200).json({ text: result.text });

  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown server error" });
  }
}
