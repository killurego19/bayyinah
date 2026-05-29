// api/ask.js  —  Runs on Vercel as a serverless function.
// The browser calls /api/ask. This function adds your SECRET Gemini key
// (read from an environment variable) and forwards the request to Google.
// The key is NEVER sent to the browser, so it stays private.

// You can change the model here. Free-tier options:
//   "gemini-2.5-flash"       -> better answers, ~250 requests/day
//   "gemini-2.5-flash-lite"  -> highest free volume, ~1000 requests/day
const MODEL = "gemini-2.5-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Server is missing GEMINI_API_KEY. Add it in Vercel project settings." });
    return;
  }

  try {
    // Vercel parses JSON bodies automatically; fall back just in case.
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { messages = [], system = "", maxTokens = 1000 } = payload;

    // Convert the simple {role, content} messages into Gemini's format.
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }]
    }));

    const body = {
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 }
    };
    if (system) body.system_instruction = { parts: [{ text: system }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ("Gemini error " + r.status);
      res.status(r.status).json({ error: msg });
      return;
    }

    const cand = (data.candidates && data.candidates[0]) || null;
    const text = cand && cand.content && cand.content.parts
      ? cand.content.parts.map(p => p.text || "").join("")
      : "";

    if (!text) {
      // Usually means a safety filter blocked it, or empty output.
      res.status(200).json({ text: "", note: "No text returned (possibly filtered)." });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown server error" });
  }
}
