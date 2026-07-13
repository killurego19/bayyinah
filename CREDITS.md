# Data Credits & Licenses

## Word-by-word, root, and per-word data

The word-by-word Arabic text, transliteration, English glosses, and root words
(`wbw/*.json`, `roots.json`) are derived from the **WikiSubmission Quran API**
dataset — <https://github.com/WikiSubmission/wikisubmission-api-quran> — used
under the MIT License. Bayyinah bundles a re-sliced, compacted derivative.

Original license reproduced below as required by the MIT License:

```
Copyright (c) 2025 WikiSubmission

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.```

## Arabic font — Uthmanic Hafs (Madinah Mushaf script)

Quranic Arabic is rendered with the **KFGQPC Uthmanic Hafs** font
(`fonts/uthmanic-hafs.woff2`, standard-Unicode build), produced by the
**King Fahd Glorious Qur'an Printing Complex** and freely distributed for the
purpose of displaying the Qur'an. The unmodified font is self-hosted so it always
loads (including offline in the installed PWA). Standard-Unicode build via
<https://github.com/thetruetruth/quran-data-kfgqpc>.

## Audio recitation

Arabic verse audio is streamed on demand from **everyayah.com** (a free public
Quran audio host), keyed by sura:ayah. Reciters: Mishary Alafasy, Abdul Basit,
Al-Husary, Al-Minshawi, Al-Sudais. Audio is not bundled or redistributed.
