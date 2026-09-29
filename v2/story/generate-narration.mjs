// Generates Story Mode narration with ElevenLabs v3 (expressive, understands [audio tags]).
// Reads the beats from Firestore (collection `story`), writes assets/audio/story/<lang>/<chapter>.{mp3,json}:
// the JSON holds caption sentences and when each beat starts, so the page moves in sync with the voice.
// Only chapters whose text changed are regenerated (re-running is free unless you edited the story).
//
// Usage (inside v2/story):  node generate-narration.mjs --key-file="C:\path\to\elevenlabs.txt" [--force] [--only=hero,about] [--lang=en]
//   or put ELEVENLABS_API_KEY=... in v2/story/.env
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const OUT = new URL('../../assets/audio/story/', import.meta.url);
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).replace(/^"|"$/g, '');
const force = process.argv.includes('--force');
const only = arg('only') ? arg('only').split(',') : null;
const langs = arg('lang') ? arg('lang').split(',') : ['en', 'id'];
const MODEL = 'eleven_v3';
// narrators: George (premade storyteller) in English, Putra (native Indonesian storyteller, added by create-agents.mjs)
const agents = existsSync(new URL('agents.json', here)) ? JSON.parse(readFileSync(new URL('agents.json', here), 'utf8')) : {};
const VOICE = { en: arg('voice-en') || 'JBFqnCBsd6RMkjVDRZzb', id: arg('voice-id') || (agents.voices && agents.voices.narratorId) || 'RWiGLY9uXI70QL540WNd' };

let KEY = process.env.ELEVENLABS_API_KEY;
if (arg('key-file')) { const t = readFileSync(arg('key-file'), 'utf8'); KEY = (t.match(/sk_[A-Za-z0-9]+/) || [t.trim()])[0]; }
if (!KEY && existsSync(new URL('.env', here))) KEY = (readFileSync(new URL('.env', here), 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/) || [])[1];
if (!KEY) { console.error('No ElevenLabs API key (use --key-file or v2/story/.env)'); process.exit(1); }

// ---- story beats from Firestore
const cfg = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const projectId = cfg.match(/projectId:\s*'([^']+)'/)[1], apiKey = cfg.match(/apiKey:\s*'([^']+)'/)[1];
const plain = v => !v ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'arrayValue' in v ? (v.arrayValue.values || []).map(plain) : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)])) : null;
const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/story?pageSize=50&key=${apiKey}`);
const chapters = ((await res.json()).documents || []).map(d => ({ chapter: d.name.split('/').pop(), beats: plain(d.fields.beats) || [] }));
if (!chapters.length) { console.error('No story documents in Firestore.'); process.exit(1); }

const strip = t => t.replace(/\[[^\]]*\]\s*/g, '').replace(/\s{2,}/g, ' ').trim();

// Caption sentences (audio tags removed) + beat start times, from the character alignment.
function timeline(text, beatStarts, al) {
  const ch = al.characters, st = al.character_start_times_seconds, en = al.character_end_times_seconds;
  const timeAt = i => st[Math.min(Math.max(0, i), st.length - 1)];
  const beats = beatStarts.map((b, k) => ({ focus: b.focus, start: +timeAt(b.at).toFixed(3), end: +(k + 1 < beatStarts.length ? timeAt(beatStarts[k + 1].at) : en[en.length - 1]).toFixed(3) }));
  const sentences = [];
  let buf = '', start = null, inTag = false;
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (c === '[') { inTag = true; continue; }
    if (inTag) { if (c === ']') inTag = false; continue; }
    if (start === null && c.trim()) start = st[i];
    buf += c;
    const end = /[.!?…]/.test(c) && (i + 1 >= ch.length || /\s/.test(ch[i + 1]));
    if (end || i === ch.length - 1) {
      const t = buf.replace(/\s{2,}/g, ' ').trim();
      if (t) sentences.push({ text: t, start: +(start ?? st[i]).toFixed(3), end: +en[i].toFixed(3) });
      buf = ''; start = null;
    }
  }
  // exact word start times (audio tags skipped) for word-level cues on the page
  const words = [];
  let w = '', wt = null, tag = false;
  for (let i = 0; i <= ch.length; i++) {
    const c = ch[i];
    if (c === '[') { tag = true; continue; }
    if (tag) { if (c === ']') tag = false; continue; }
    if (c === undefined || /\s/.test(c)) { if (w) words.push({ w, t: +wt.toFixed(3) }); w = ''; wt = null; continue; }
    if (wt === null) wt = st[i];
    w += c;
  }
  return { beats, words, sentences: sentences.length ? sentences : [{ text: strip(text), start: 0, end: en[en.length - 1] }] };
}

let used = 0, made = 0, kept = 0;
for (const c of chapters) {
  if (only && !only.includes(c.chapter)) continue;
  for (const lang of langs) {
    const parts = c.beats.map(b => (b[lang] || '').trim()).filter(Boolean);
    if (!parts.length) continue;
    // one continuous take per chapter keeps the storytelling flowing; remember where each beat starts
    let text = '', beatStarts = [];
    c.beats.forEach(b => { const t = (b[lang] || '').trim(); if (!t) return; if (text) text += ' '; beatStarts.push({ focus: b.focus, at: text.length }); text += t; });
    const dir = new URL(`${lang}/`, OUT), json = new URL(`${c.chapter}.json`, dir);
    if (!force && existsSync(json)) {
      const prev = JSON.parse(readFileSync(json, 'utf8'));
      if (prev.source === text && prev.voice === VOICE[lang] && prev.model === MODEL) { kept++; continue; }
    }
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE[lang]}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, language_code: lang, voice_settings: { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true } })
    });
    if (!r.ok) { console.error(`✗ ${lang}/${c.chapter}: ${r.status} ${(await r.text()).slice(0, 300)}`); process.exit(1); }
    const j = await r.json();
    const tl = timeline(text, beatStarts, j.alignment || j.normalized_alignment);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL(`${c.chapter}.mp3`, dir), Buffer.from(j.audio_base64, 'base64'));
    writeFileSync(json, JSON.stringify({ source: text, text: strip(text), voice: VOICE[lang], model: MODEL, ...tl }, null, 1) + '\n');
    used += text.length; made++;
    console.log(`✓ ${lang}/${c.chapter}  ${tl.sentences.at(-1).end.toFixed(1)}s  (${text.length} chars, ${tl.beats.length} beats)`);
  }
}
console.log(`\nDone: ${made} generated, ${kept} unchanged. ~${used} ElevenLabs credits used.`);
