// api/ask.js  —  Runs on Vercel as a serverless function.
//
// The browser calls /api/ask. This function tries three AI providers in order
// until one answers, and TIME-BOXES each call so a slow/hanging provider can
// never stall the request (that was the old "spinner forever" bug):
//
//   1) CACHE — identical recent questions are served free (no API call).
//   2) GEMINI   (primary, generous free volume)
//   3) GROQ     (free fallback, fast)
//   4) NVIDIA   (free fallback via build.nvidia.com)
//
// Your secret keys live only here as environment variables — never sent to the browser.
//
// Env vars (Vercel → Project → Settings → Environment Variables):
//   GEMINI_API_KEY   primary   — free at https://aistudio.google.com/apikey
//   GROQ_API_KEY     optional  — free at https://console.groq.com/keys
//   NVIDIA_API_KEY   optional  — free at https://build.nvidia.com  (key starts with "nvapi-")
// At least one of the three must be set.

// Each provider tries its models in order; a "model not found / decommissioned"
// error moves to the next model, any other error moves to the next provider.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash"];
const GROQ_MODELS   = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const NVIDIA_MODELS = ["meta/llama-3.3-70b-instruct", "meta/llama-3.1-8b-instruct"];

const PROVIDER_TIMEOUT_MS = 13000; // hard cap per upstream call (so a stalled provider can't hang the request)

// allow enough wall-clock for the fallback chain (Vercel kills at 10s by default)
export const config = { maxDuration: 60 };

// ---- simple in-memory cache (per warm serverless instance) ----
const CACHE = globalThis.__bayyinah_cache || (globalThis.__bayyinah_cache = new Map());
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;
function cacheKey(system, messages, maxTokens){ return JSON.stringify({ s: system, m: messages, t: maxTokens }); }
function cacheGet(k){ const e = CACHE.get(k); if (!e) return null; if (Date.now() - e.t > CACHE_TTL_MS){ CACHE.delete(k); return null; } return e.text; }
function cacheSet(k, text){ if (CACHE.size >= CACHE_MAX){ const first = CACHE.keys().next().value; CACHE.delete(first); } CACHE.set(k, { text, t: Date.now() }); }

// fetch with a hard timeout so a stalled provider cannot hang the function
async function fetchT(url, opts, ms){
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

const modelMiss = (msg) => /model|not found|decommission|does not exist|unknown|unsupported|no longer/i.test(msg || "");

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  if (!geminiKey && !groqKey && !nvidiaKey) {
    res.status(500).json({ error: "Server is missing all AI keys. Add GEMINI_API_KEY, GROQ_API_KEY, or NVIDIA_API_KEY in Vercel project settings." });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { messages = [], system = "", maxTokens = 1000 } = payload;

    // 1) CACHE
    const ck = cacheKey(system, messages, maxTokens);
    const cached = cacheGet(ck);
    if (cached) { res.status(200).json({ text: cached, cached: true }); return; }

    // ---- Gemini ----
    async function callGemini(){
      const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "") }] }));
      const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 } };
      if (system) body.system_instruction = { parts: [{ text: system }] };
      let last = { ok: false, status: 0, text: "", err: "" };
      for (const model of GEMINI_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const resp = await fetchT(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, PROVIDER_TIMEOUT_MS);
          const json = await resp.json().catch(() => ({}));
          const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
          if (resp.ok && text) return { ok: true, status: resp.status, text };
          last = { ok: false, status: resp.status, text: "", err: json?.error?.message || "" };
          if (!modelMiss(last.err)) break; // real error (quota/auth) -> stop Gemini
        } catch (e) { last = { ok: false, status: 0, text: "", err: String(e) }; }
      }
      return last;
    }

    // ---- OpenAI-compatible providers (Groq + NVIDIA) ----
    async function callOpenAICompat(endpoint, key, models){
      const oa = [];
      if (system) oa.push({ role: "system", content: system });
      for (const m of messages) oa.push({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") });
      let last = { ok: false, status: 0, text: "", err: "" };
      for (const model of models) {
        try {
          const resp = await fetchT(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
            body: JSON.stringify({ model, messages: oa, max_tokens: maxTokens, temperature: 0.4 })
          }, PROVIDER_TIMEOUT_MS);
          const json = await resp.json().catch(() => ({}));
          const text = json?.choices?.[0]?.message?.content || "";
          if (resp.ok && text) return { ok: true, status: resp.status, text };
          last = { ok: false, status: resp.status, text: "", err: json?.error?.message || "" };
          if (!modelMiss(last.err)) break;
        } catch (e) { last = { ok: false, status: 0, text: "", err: String(e) }; }
      }
      return last;
    }

    let result = null;

    // 2) Gemini
    if (geminiKey) {
      result = await callGemini();
      if (!result.ok && result.status === 429) { await new Promise(r => setTimeout(r, 1200)); result = await callGemini(); }
    }
    // 3) Groq
    if ((!result || !result.ok || !result.text) && groqKey) {
      const g = await callOpenAICompat("https://api.groq.com/openai/v1/chat/completions", groqKey, GROQ_MODELS);
      if (g.ok && g.text) result = g; else if (!result || result.status !== 429) result = g;
    }
    // 4) NVIDIA
    if ((!result || !result.ok || !result.text) && nvidiaKey) {
      const n = await callOpenAICompat("https://integrate.api.nvidia.com/v1/chat/completions", nvidiaKey, NVIDIA_MODELS);
      if (n.ok && n.text) result = n; else if (!result) result = n;
    }

    if (!result || !result.ok) {
      const status = result?.status || 502;
      if (status === 429) res.status(429).json({ error: "Busy right now (free usage limit reached for the moment). Please wait a minute and try again." });
      else res.status(status && status >= 400 ? status : 502).json({ error: "AI service error" + (status ? " (" + status + ")" : "") + ". Please try again shortly." });
      return;
    }

    if (!result.text) { res.status(200).json({ text: "", note: "No text returned (possibly filtered)." }); return; }

    cacheSet(ck, result.text);
    res.status(200).json({ text: result.text });

  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown server error" });
  }
}
