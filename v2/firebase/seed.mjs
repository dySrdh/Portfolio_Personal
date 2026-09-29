// Import seed-data.json into Firestore.
// Usage (inside v2/firebase):  npm install  →  node seed.mjs path/to/service-account.json [--overwrite] [--only=site,projects]
// Without --overwrite existing documents are left untouched. With --only, other collections are skipped.
// With --overwrite, documents that are not in seed-data.json are deleted from the seeded collections.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const keyPath = process.argv[2];
const overwrite = process.argv.includes('--overwrite');
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).split(',') : null;
if (!keyPath) { console.error('Usage: node seed.mjs <service-account.json> [--overwrite] [--only=site,projects]'); process.exit(1); }

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();
const seed = JSON.parse(readFileSync(new URL('./seed-data.json', import.meta.url), 'utf8'));
const want = c => !only || only.includes(c);

let written = 0, skipped = 0, deleted = 0;
async function put(collection, id, data) {
  const ref = db.collection(collection).doc(id);
  if (!overwrite && (await ref.get()).exists) { skipped++; return; }
  await ref.set(data);
  written++;
}

if (want('site')) {
  for (const [id, data] of Object.entries(seed.site)) await put('site', id, data);
  if (overwrite) {
    for (const d of (await db.collection('site').get()).docs) if (!(d.id in seed.site)) { await d.ref.delete(); deleted++; }
  }
}
// cv: the data behind the online CV (cv-doddy-suryadharma.vercel.app), moved from Supabase
for (const col of ['projects', 'certifications', 'resume', 'story', 'cv']) {
  if (!want(col) || !seed[col]) continue;
  for (const { id, ...data } of seed[col]) await put(col, id, data);
  if (overwrite) {
    const ids = new Set(seed[col].map(d => d.id));
    for (const d of (await db.collection(col).get()).docs) if (!ids.has(d.id)) { await d.ref.delete(); deleted++; }
  }
}
console.log(`Done: ${written} written, ${skipped} already existed, ${deleted} removed.`);
