// Saves a copy of the live Firestore content to v2/data/snapshot.json. The site shows it only when Firestore
// is slow or unreachable (e.g. a weak connection inside the Instagram / TikTok in-app browser), then switches to
// live data. Vercel re-runs it on every deploy (vercel.json buildCommand); locally: node v2/data/snapshot.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const cfg = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const projectId = cfg.match(/projectId:\s*'([^']+)'/)[1];

const plain = v => !v ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue
  : 'booleanValue' in v ? v.booleanValue : 'timestampValue' in v ? v.timestampValue : 'nullValue' in v ? null
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(plain) : 'mapValue' in v ? fields(v.mapValue.fields) : null;
const fields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, plain(v)]));

const out = {};
for (const c of ['site', 'projects', 'certifications', 'resume', 'story']) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${c}?pageSize=300`);
  if (!r.ok) throw new Error(`${c} → ${r.status}`);
  out[c] = ((await r.json()).documents || []).map(d => ({ id: d.name.split('/').pop(), ...fields(d.fields) }));
}
mkdirSync(new URL('./', import.meta.url), { recursive: true });
const file = new URL('./snapshot.json', import.meta.url);
writeFileSync(file, JSON.stringify(out));
console.log('snapshot.json written:', Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', '), `(${Math.round(JSON.stringify(out).length / 1024)} KB)`);
