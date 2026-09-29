// All portfolio content lives in Firebase Firestore (always on, never paused). Edit it in the Firebase Console — no redeploy.
// Speed: 4 small parallel REST requests (no Firebase SDK), and the last response is cached in localStorage
// so repeat visits render instantly while fresh data loads in the background.
import { FIREBASE } from './config.js';
import { localize, tr, getLang } from './i18n.js';

const CACHE_KEY = 'pf-v2-firestore';
const base = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/`;

// Firestore REST returns typed values ({stringValue: ...}); turn them back into plain JSON.
function plain(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('mapValue' in v) return fields(v.mapValue.fields);
  return null;
}
function fields(f) {
  const o = {};
  for (const k in f || {}) o[k] = plain(f[k]);
  return o;
}

// A stalled request is abandoned after a few seconds and retried, so one slow response can't hold up the page.
// Slow mobile networks (in-app browsers like Instagram's) can take a while to reach Google: be patient, then retry.
const TIMEOUTS = [10000, 15000, 20000];
async function list(collection, tries = 3) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUTS[3 - tries] || 20000);
  try {
    // public-read rules: no API key needed for reads
    const r = await fetch(base() + collection + '?pageSize=300', { signal: ctl.signal });
    if (!r.ok) throw new Error(collection + ' → ' + r.status);
    const j = await r.json();
    return (j.documents || []).map(d => ({ id: d.name.split('/').pop(), ...fields(d.fields) }));
  } catch (e) {
    if (tries > 1) return list(collection, tries - 1);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRaw() {
  if (!FIREBASE.projectId) throw new Error('Firebase is not configured (v2/js/config.js)');
  const [site, projects, certifications, resume, story] = await Promise.all(['site', 'projects', 'certifications', 'resume', 'story'].map(list));
  return { site, projects, certifications, resume, story };
}

const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999);
// resume groups: 0 summary · 1 work · 2 education · 3 achievement · 4 organizational
const SECTION = { summary: 0, work: 1, job: 1, employment: 1, education: 2, achievement: 3, achievements: 3, award: 3, awards: 3, leadership: 4, experience: 4, organization: 4, organizational: 4, organisasi: 4 };
// Known categories first (they map onto the three Guild Isles in 3D); anything new is appended.
const CATEGORY_ORDER = ['kerja', 'internship', 'campus', 'organisasi'];
const CATEGORY_LABEL = { kerja: 'Work', internship: 'Internship', campus: 'Campus', organisasi: 'Organizational' };
const arr = v => Array.isArray(v) ? v : [];

// Text fields may be plain strings or { en, id } maps; everything except the story beats is resolved to one language here.
function normalize(src, lang = getLang()) {
  const raw = { ...localize({ ...src, story: [] }, lang), story: src.story || [] };
  const site = {};
  raw.site.forEach(d => { site[d.id] = d; });
  const profile = site.profile || {};

  const projects = [...raw.projects].sort(byOrder).map(x => {
    const tech = arr(x.skills).map(s => [s.name || '', s.icon || '']);
    const info = [];
    if (x.role) info.push([tr('Role'), x.role]);
    if (x.date) info.push([tr('Project Date'), String(x.date)]);
    if (x.teamSize) info.push([tr('Team Size'), tr(x.teamSize > 1 ? '{n} people' : '{n} person', { n: x.teamSize })]);
    arr(x.extraInfo).forEach(r => info.push([r.label, r.value]));
    const links = [];
    if (x.projectUrl) links.push([tr('View Project'), x.projectUrl]);
    if (x.repoUrl) links.push([tr('Source Code'), x.repoUrl]);
    arr(x.links).forEach(l => { if (!links.some(k => k[1] === l.url)) links.push([l.label, l.url]); });
    const gallery = [x.image, ...arr(x.gallery)].filter(Boolean).map((src, i) => [src, i ? x.title + ' · ' + (i + 1) : x.title]);
    return {
      key: x.id, title: x.title || '', category: x.category || '', img: x.image || '', desc: x.description || '',
      stack: tech.map(t => t[1]), tech: tech.filter(t => t[0]), role: x.role || '', info, links, gallery,
      competencies: arr(x.competencies), paras: arr(x.story).length ? x.story : (x.description ? [x.description] : []),
      listTitle: x.listTitle || '', list: arr(x.highlights),
      campaigns: arr(x.campaigns).map(k => ({ name: k.name, date: k.date, paras: arr(k.story), listTitle: k.listTitle, list: arr(k.highlights), video: k.video, gallery: arr(k.gallery).map(g => [g.src, g.caption]) }))
    };
  });
  const categories = [...new Set(projects.map(p => p.category))]
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99))
    .map(k => [k, CATEGORY_LABEL[k] ? tr(CATEGORY_LABEL[k]) : k.charAt(0).toUpperCase() + k.slice(1)]);

  const certifications = [...raw.certifications].sort(byOrder).map(x => ({
    img: x.image || '', title: x.title || '', issuer: [x.issuer, x.date].filter(Boolean).join(' · ')
  }));

  const resume = [[], [], [], [], []];
  [...raw.resume].sort(byOrder).forEach(x => {
    const g = SECTION[String(x.section || '').toLowerCase().trim()];
    if (g == null) return;
    resume[g].push({ id: x.id, year: x.period || '', title: x.title || '', inst: x.place || '', badge: x.badge || '', desc: x.description || '', highlights: arr(x.highlights), tags: arr(x.tags) });
  });

  const p = profile, stats = [], facts = [];
  if (p.experienceYears) stats.push([p.experienceYears + '+', tr(p.experienceYears > 1 ? 'Years experience' : 'Year experience')]);
  if (p.projectsCompleted) stats.push([p.projectsCompleted + '+', tr('Projects')]);
  if (p.gpa) stats.push([lang === 'id' ? String(p.gpa).replace('.', ',') : p.gpa, tr('GPA')]);
  if (p.birthday) facts.push([tr('Born'), p.birthday, 'calendar']);
  if (p.location) facts.push([tr('Location'), p.location, 'map-pin']);
  if (p.education) facts.push([tr('Education'), p.education, 'flag']);
  if (p.email) facts.push([tr('Email'), p.email, 'mail']);
  if (p.phone) facts.push([tr('Phone'), p.phone, 'phone']);
  return {
    profile: {
      ...p, cv: p.cvUrl || '', stats, facts,
      heroMeta: [p.education, p.location].filter(Boolean),
      socials: arr(p.socials).map(s => [s.label, s.handle, s.url, s.platform])
    },
    skills: arr((site.skills || {}).items).map(s => [s.name, s.percent, s.icon]),
    tools: arr((site.tools || {}).items).map(t => [t.name, t.icon]),
    traits: arr((site.traits || {}).items).map(t => [t.title, t.desc]),
    competencies: arr((site.competencies || {}).items).filter(Boolean),
    music: (site.music || {}).tracks || {},  // optional MP3 per island: shrine, camp, training, guild, vault, road, beacon, oracle (or `all`)
    projects, categories, certifications, resume,
    // story mode narration per chapter (doc id = chapter id)
    story: arr(raw.story).sort(byOrder).map(s => ({
      chapter: s.id,
      beats: arr(s.beats).length ? s.beats.map(b => ({ focus: b.focus || '', en: b.en || '', id: b.id || '', cues: arr(b.cues) })) : [{ focus: '', en: s.text_en || '', id: s.text_id || '' }]
    }))
  };
}

function readCache() {
  try { const s = localStorage.getItem(CACHE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function writeCache(raw) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(raw)); } catch (e) { /* storage full or blocked */ }
}

// Calls onData(data) immediately with cached data (if any), then again when fresh data differs.
let lastRaw = null;
// the same data in another language (after the visitor switches language), without refetching
export const relocalize = () => lastRaw ? normalize(lastRaw) : null;
// Backup copy of the content served with the site itself (same host, CDN-fast): shown when Firestore is slow or
// unreachable, then replaced by live data as soon as it arrives. Refresh it with v2/firebase/snapshot.mjs.
async function fetchSnapshot() {
  const r = await fetch(new URL('../data/snapshot.json', import.meta.url), { cache: 'no-cache' });
  if (!r.ok) throw new Error('snapshot → ' + r.status);
  return r.json();
}

// Shows content as soon as any source has it: local cache → site snapshot (if Firestore is slow) → live Firestore.
// If Firestore keeps failing it retries in the background; onError only fires when nothing at all could be shown.
export async function loadData(onData, onError) {
  let shown = null;
  const show = (raw, fromCache) => {
    if (shown && JSON.stringify(raw) === JSON.stringify(shown)) return;
    shown = raw; lastRaw = raw;
    onData(normalize(raw), fromCache);
  };
  const cached = readCache();
  if (cached) show(cached, true);
  // Firestore slow? put the site's own copy up first
  const slow = setTimeout(() => { if (!shown) fetchSnapshot().then(s => { if (!shown) show(s, true); }).catch(() => {}); }, 3500);
  for (let attempt = 0; ; attempt++) {
    try {
      const raw = await fetchRaw();
      clearTimeout(slow);
      writeCache(raw);
      show(raw, false);
      return;
    } catch (e) {
      console.error('Firestore load failed', e);
      if (!shown) {
        try { show(await fetchSnapshot(), true); } catch (e2) { onError(e); }
      }
      if (attempt >= 5) return;
      await new Promise(r => setTimeout(r, 8000 * (attempt + 1))); // keep trying quietly
    }
  }
}
