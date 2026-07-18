// api/tts.js — Google Translate TTS proxy (Vercel serverless).
// Same behavior as godalone.in's tts-proxy.php: /api/tts?tl=ta&q=text → audio/mpeg

export default async function handler(req, res) {
  const q = String(req.query.q || "");
  const tl = String(req.query.tl || "ta").replace(/[^a-zA-Z-]/g, "");
  if (!q) { res.status(400).send("Missing text"); return; }

  const text = q.slice(0, 400); // Google TTS practical limit
  const url =
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${tl}&client=gtx&q=${encodeURIComponent(text)}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://translate.google.com/",
      },
    });
    if (!r.ok) { res.status(502).send("TTS unavailable"); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100) { res.status(502).send("TTS unavailable"); return; }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).send("TTS unavailable");
  }
}
