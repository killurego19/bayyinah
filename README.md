# Bayyinah — Free Setup Guide

A bilingual (English + Tamil) Quran study assistant built on the Rashad Khalifa
translation. It runs **completely free**: free AI (Google Gemini) + free hosting
(Vercel). No credit card required.

## What's in this folder
```
bayyinah/
├── index.html        ← the whole app + the full Quran text embedded
├── api/
│   └── ask.js        ← tiny backend that hides your AI key
├── package.json
└── README.md         ← this file
```

You do NOT edit any code to get started. You only do two things:
1. Get a free Gemini key.
2. Upload this folder to Vercel and paste the key in.

---

## STEP 1 — Get a free Gemini API key (2 minutes)
1. Go to  https://aistudio.google.com/apikey
2. Sign in with any Google account.
3. Click **"Create API key"**. (No credit card.)
4. Copy the key (a long string starting with `AIza...`). Keep it private.

## STEP 2 — Make a free GitHub account + upload this folder
(You can skip GitHub and drag-drop instead — see "Alternative" below.)
1. Create an account at  https://github.com  (free).
2. Click **New repository**, name it `bayyinah`, keep it Public or Private, Create.
3. On the repo page click **"Add file" → "Upload files"**.
4. Drag in `index.html`, `package.json`, the `README.md`, AND the `api` folder
   (keep the folder structure — `api/ask.js` must stay inside an `api` folder).
5. Click **Commit changes**.

## STEP 3 — Deploy on Vercel (free)
1. Go to  https://vercel.com  and **Sign up with GitHub** (free, no card).
2. Click **"Add New… → Project"**.
3. Find your `bayyinah` repo and click **Import**.
4. Before deploying, open **Environment Variables** and add:
       Name:  GEMINI_API_KEY
       Value: (paste your AIza... key here)
5. Click **Deploy**. Wait ~1 minute.
6. You get a public link like `https://bayyinah-xxxx.vercel.app` — open it. Done!

### Alternative without GitHub (drag-and-drop)
1. Install Node.js (https://nodejs.org), then in a terminal run: `npm i -g vercel`
2. In this folder run `vercel` and follow the prompts.
3. Add the key with: `vercel env add GEMINI_API_KEY`  (paste the key, choose all environments)
4. Run `vercel --prod` to publish.

---

## Free usage limits
- Gemini free tier: roughly 250 questions/day on `gemini-2.5-flash`.
- Need more? Open `api/ask.js` and change MODEL to `"gemini-2.5-flash-lite"`
  (~1000/day, slightly simpler answers).
- Vercel free tier: 100 GB bandwidth/month — far more than a small app needs.

## Privacy note
On Gemini's FREE tier, Google may use prompts to improve their models. The Quran
text and these questions aren't sensitive, so this is usually fine. To stop it,
upgrade to a paid Gemini tier later (still very cheap).

## Troubleshooting
- "Server is missing GEMINI_API_KEY" → you forgot Step 3.4, or typo'd the name.
  It must be exactly `GEMINI_API_KEY`. Re-add it, then redeploy.
- "API 429" → you hit the daily free limit; wait, or switch to flash-lite.
- Answers in wrong language → use the English/தமிழ் toggle (top right).
