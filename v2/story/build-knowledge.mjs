// Builds knowledge-base.md for the ElevenLabs agent from the live Firestore data.
// Re-run after changing your portfolio data, then re-upload the file in ElevenLabs → Agent → Knowledge base.
// Usage (inside v2/story):  node build-knowledge.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const cfg = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const projectId = cfg.match(/projectId:\s*'([^']+)'/)[1], apiKey = cfg.match(/apiKey:\s*'([^']+)'/)[1];

const plain = v => !v ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue
  : 'booleanValue' in v ? v.booleanValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(plain) : 'mapValue' in v ? fields(v.mapValue.fields) : null;
const fields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, plain(v)]));
async function list(c) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${c}?pageSize=300&key=${apiKey}`);
  return ((await r.json()).documents || []).map(d => ({ id: d.name.split('/').pop(), ...fields(d.fields) }));
}
const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999);
// content fields can be { en, id }; the knowledge base is written in English (the agents answer in either language)
const isLoc = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every(k => k === 'en' || k === 'id');
const en = v => Array.isArray(v) ? v.map(en) : isLoc(v) ? (v.en ?? v.id) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, en(x)])) : v;
const [site, projects, certs, resume] = (await Promise.all(['site', 'projects', 'certifications', 'resume'].map(list))).map(en);
const S = Object.fromEntries(site.map(d => [d.id, d]));
const p = S.profile || {};
const lines = [];
const h = (t, lvl = 2) => lines.push('', '#'.repeat(lvl) + ' ' + t, '');
const li = t => t && lines.push('- ' + t);

lines.push(`# ${p.name} — portfolio knowledge base`, '', `This document describes ${p.name}. Use it to answer questions about his work, projects, skills, education and experience.`);
h('Profile');
li(`Headline: ${p.headline || ''}`);
li(`Roles: ${(p.roles || []).join(', ')}`);
li(`Location: ${p.location || ''}`);
li(`Born: ${p.birthday || ''} (age: count from today's date — e.g. 23 in late 2026)`);
li(`Education: ${p.education || ''}${p.gpa ? ` (GPA ${p.gpa})` : ''}`);
li(`Experience: ${p.experienceYears || 0}+ years professional; ${p.projectsCompleted || 0}+ projects completed`);
h('About');
(p.about || []).forEach(t => lines.push(t, ''));

const sec = s => resume.filter(r => r.section === s).sort(byOrder);
const item = r => {
  lines.push(`### ${r.title}${r.place ? ` — ${r.place}` : ''}`);
  if (r.period || r.badge) lines.push(`${[r.period, r.badge].filter(Boolean).join(' · ')}`);
  if (r.description) lines.push('', r.description);
  (r.highlights || []).forEach(li);
  if ((r.tags || []).length) lines.push('', 'Skills: ' + r.tags.join(', '));
  lines.push('');
};
h('Current role'); sec('summary').forEach(item);
h('Work experience'); sec('work').forEach(item);
h('Education'); sec('education').forEach(item);
if (sec('achievement').length) { h('Achievements'); sec('achievement').forEach(item); }
h('Leadership & organizational experience'); sec('leadership').forEach(item);

h('Technical skills');
((S.skills || {}).items || []).forEach(s => li(`${s.name} — ${s.percent}% proficiency${s.category ? ` (${s.category})` : ''}`));
if ((S.tools || {}).items) li('Also uses: ' + S.tools.items.map(t => t.name).join(', '));
if ((S.competencies || {}).items) { h('Core competencies'); li(S.competencies.items.join(', ')); }
if ((S.traits || {}).items) { h('Soft skills'); S.traits.items.forEach(t => li(`${t.title}: ${t.desc}`)); }

h('Projects');
projects.sort(byOrder).forEach(x => {
  lines.push(`### ${x.title}`, `Category: ${x.category}${x.role ? ` · Role: ${x.role}` : ''}${x.date ? ` · ${x.date}` : ''}${x.teamSize ? ` · Team of ${x.teamSize}` : ''}`, '', x.description || '');
  (x.story || []).forEach(t => lines.push('', t));
  if ((x.highlights || []).length) { lines.push('', x.listTitle || 'Highlights:'); x.highlights.forEach(li); }
  const tech = (x.skills || []).map(s => s.name).filter(Boolean);
  if (tech.length) lines.push('', 'Technologies / skills: ' + tech.join(', '));
  (x.campaigns || []).forEach(c => { lines.push('', `Event: ${c.name}${c.date ? ` (${c.date})` : ''}`); (c.story || []).forEach(t => lines.push(t)); });
  lines.push('');
});

h('Certifications');
certs.sort(byOrder).forEach(c => li(`${c.title} — ${c.issuer}${c.date ? `, ${c.date}` : ''}`));

h('Contact');
li(`Email: ${p.email || ''}`);
li(`Phone: ${p.phone || ''}`);
(p.socials || []).forEach(s => li(`${s.label}: ${s.url}`));
if (p.cvUrl) li(`CV: ${p.cvUrl}`);

const out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
writeFileSync(new URL('knowledge-base.md', import.meta.url), out);
console.log(`knowledge-base.md written (${out.length} chars)`);
