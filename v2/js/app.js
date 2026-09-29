import { loadData, relocalize } from './data.js';
import { tr, onLangChange } from './i18n.js';
import { initExperience, progress, setStoryTexts, setMusicTracks } from './experience.js';
import { initOracle, openOracle, closeOracle, setOraclePhoto, setOracleData } from './oracle.js';

const ROOT = '../'; // v2 lives one folder below the site root; DB paths are root-relative ("assets/...")
const DEV = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const CHAPTERS = [
  ['hero', 'Prologue', 'The Crystal Shrine', 'Home'], ['about', 'Chapter I', "The Adventurer's Camp", 'About'],
  ['skills', 'Chapter II', 'The Training Grounds', 'Skills'], ['portfolio', 'Chapter III', 'The Guild Isles', 'Portfolio'],
  ['certifications', 'Chapter IV', 'The Relic Vault', 'Certifications'], ['resume', 'Chapter V', 'The Long Road', 'Resume'],
  ['contact', 'Chapter VI', 'The Beacon', 'Contact']
];
const SHORT = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const HOLD = [0, 0.4, 0.5, 0.6, 0.86, 0.45, 0.4];
// the hero levels up chapter by chapter (the 3D character's outfit follows the same table)
export const LEVELS = [[1, 'The Dreamer Kid'], [4, 'Freshman Adventurer'], [6, 'Apprentice Coder'], [10, 'Guild Builder'], [13, 'Relic Seeker'], [17, 'Road Walker'], [20, 'Aspiring Game Master']];
const RES_GROUPS = [['Summary', 'Summary'], ['Work Experience', 'Work'], ['Education', 'Education'], ['Achievement', 'Awards'], ['Organizational Experience', 'Leadership']];

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isAbs = p => /^(https?:|data:|blob:|\/)/.test(p);
const url = p => !p ? '' : isAbs(p) ? p : ROOT + p;
const icon = p => !p ? '' : isAbs(p) || p.startsWith('assets/') ? url(p) : DEV + p;
const svg = (id, cls) => `<svg class="i${cls ? ' ' + cls : ''}"><use href="#${id}"/></svg>`;
const pad2 = n => String(n).padStart(2, '0');
const mqMobile = matchMedia('(max-width: 639px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Shared with the 3D world (world.js reads these every frame)
const shared = { jt: 0, isle: -1, cert: 0, hoverSkill: -1, flare: 0, motion: !reduceMotion, certs: [], skills: [] };

const S = { data: null, filter: 'all', page: 0, cert: 0, seen: {}, detail: null, dImg: 0, camp: 0, lb: null, resTab: 0, roleI: 0 };
let world = null;

/* ---------------- render ---------------- */

function renderStatic() {
  $('mapRows').innerHTML = CHAPTERS.map(([id, num, place, title], i) =>
    `<a href="#${id}" class="map-row" data-go="${id}"><span class="map-dia"><span>${SHORT[i]}</span></span><span class="map-txt"><b>${tr(title)}</b><small>${tr(num)} · ${tr(place)}</small></span><span class="map-here">${tr('You are here')}</span>${svg('i-chevron-right')}</a>`).join('');
  document.querySelectorAll('.rail-pt').forEach(a => a.remove());
  $('rail').insertAdjacentHTML('beforeend', CHAPTERS.map(([id, num, place, title]) =>
    `<a href="#${id}" class="rail-pt" data-go="${id}" title="${tr(num)} · ${tr(place)}" aria-label="${tr(num)} · ${tr(place)}"><span class="rail-lbl">${tr(title)}</span><i></i></a>`).join(''));
  $('year').textContent = new Date().getFullYear();
}

// brand glyphs for known platforms, a mail/link icon otherwise
const BRANDS = ['github', 'linkedin', 'instagram', 'facebook'];
const socialIcon = ic => BRANDS.includes(ic) ? svg('b-' + ic, 'i-b') : svg(ic === 'email' ? 'i-mail' : 'i-external-link');

function renderProfile(p) {
  const name = p.name || 'Doddy Suryadharma';
  const [first, ...rest] = name.split(' ');
  $('heroName').innerHTML = esc(first) + (rest.length ? '<br>' + esc(rest.join(' ')) : '');
  $('heroGreet').textContent = tr('Prologue') + ' · ' + (p.greeting || tr("Hello, I'm"));
  $('heroSub').textContent = p.headline || '';
  $('heroWork').textContent = p.portfolioButton || tr('View My Work');
  $('aboutContact').firstChild.textContent = p.contactButton || tr('Contact Me');
  $('heroMeta').innerHTML = (p.heroMeta || []).map(m => `<span>${esc(m)}</span>`).join('');
  if (p.roles && p.roles.length) $('heroRole').textContent = p.roles[S.roleI % p.roles.length];
  if (p.photo) $('aboutPhoto').src = url(p.photo);
  $('aboutName').textContent = name;
  $('aboutRole').textContent = p.headline || '';
  $('aboutStats').innerHTML = (p.stats || []).map(([v, k], i) => (i ? '<span class="stat-sep"></span>' : '') + `<div class="stat"><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join('');
  $('aboutText').innerHTML = (p.about || []).map(t => `<p>${esc(t)}</p>`).join('');
  $('aboutFacts').innerHTML = (p.facts || []).map(([k, v, ic]) => `<div class="glist-row"><span class="itile">${svg('i-' + ic)}</span><div class="kv"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div></div>`).join('');
  const phone = p.phone || '', email = p.email || '';
  $('contactRows').innerHTML = [[tr('Call'), phone, 'tel:' + phone.replace(/[^+\d]/g, ''), 'phone'], [tr('Email'), email, 'mailto:' + email, 'mail']]
    .filter(r => r[1]).map(([k, v, href, ic]) => `<a href="${esc(href)}" class="glist-row"><span class="itile">${svg('i-' + ic)}</span><div class="kv"><span class="kv-k">${k}</span><span class="kv-v">${esc(v).replace('@', '@<wbr>')}</span></div>${svg('i-chevron-right', 'chev')}</a>`).join('');
  const socials = p.socials || [];
  $('socials').innerHTML = socials.map(([label, handle, href, ic]) => `<a href="${esc(href)}" target="_blank" rel="noopener" class="social" aria-label="${esc(label)}"><span class="social-ico">${socialIcon(ic)}</span><span class="social-txt"><b>${esc(label)}</b><small>${esc(handle).replace('@', '@<wbr>')}</small></span></a>`).join('');
  $('footerSocial').innerHTML = socials.map(([label, , href, ic]) => `<a href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(label)}">${socialIcon(ic)}</a>`).join('');
  // CV may be a PDF in the repo or an external page (resume_link.file_path)
  document.querySelectorAll('[data-cv]').forEach(a => {
    if (!p.cv) return;
    a.href = url(p.cv);
    if (/\.pdf($|\?)/i.test(p.cv) && !isAbs(p.cv)) { a.setAttribute('download', ''); a.removeAttribute('target'); }
    else { a.removeAttribute('download'); a.target = '_blank'; a.rel = 'noopener'; }
  });
  if (p.cv) $('cvHint').textContent = tr(/\.pdf($|\?)/i.test(p.cv) ? 'PDF · View or save' : 'Online CV · Opens in a new tab');
}

function renderSkills(d) {
  const rank = pct => tr(pct >= 85 ? 'Expert' : pct >= 75 ? 'Advanced' : 'Proficient');
  $('skillGrid').innerHTML = d.skills.map(([name, pct, ic], i) =>
    `<div class="skill" data-skill="${i}"><div class="skill-top"><span class="app-ico"><img src="${esc(icon(ic))}" alt="" loading="lazy"></span><div class="skill-name"><b data-full="${esc(name)}" data-short="${esc(name.split(' / ')[0])}">${esc(name)}</b><small>${rank(pct)}</small></div><span class="skill-pct">${pct}</span></div><div class="bar"><div class="bar-fill" style="--pct:${pct}%"></div></div></div>`).join('');
  fitSkillNames();
  document.querySelector('.toolkit').hidden = !d.tools.length;
  $('traitsPanel').hidden = !d.traits.length;
  $('toolChips').innerHTML = d.tools.map(([name, ic]) => `<span class="chip"><span class="chip-ico"><img src="${esc(icon(ic))}" alt="" loading="lazy"></span>${esc(name)}</span>`).join('');
  $('compBox').hidden = !d.competencies.length;
  $('compChips').innerHTML = d.competencies.map(s => `<span class="chip chip-teal">${esc(s)}</span>`).join('');
  $('traits').innerHTML = d.traits.map(([title, desc], i) => `<div class="trait"><span class="trait-no">${pad2(i + 1)}</span><b>${esc(title)}</b><p>${esc(desc)}</p></div>`).join('');
  shared.skills = d.skills.map(s => s[1]);
  if (world) world.buildObelisks(shared.skills);
}
// "WordPress / CMS" → "WordPress" on phones
function fitSkillNames() {
  document.querySelectorAll('.skill-name b').forEach(b => { b.textContent = mqMobile.matches ? b.dataset.short : b.dataset.full; });
}

const catLabel = k => ((S.data && S.data.categories.find(c => c[0] === k)) || [k, 'Quest'])[1];

function renderFilters(d) {
  $('filters').innerHTML = [['all', tr('All')], ...d.categories].map(([k, label]) => `<button class="seg-btn" data-filter="${esc(k)}" aria-pressed="${k === S.filter}">${esc(label)}</button>`).join('');
}
function setFilter(k) {
  S.filter = k;
  S.page = 0;
  const ISLE = { internship: 0, campus: 1, organisasi: 2, kerja: 3 };
  shared.isle = k in ISLE ? ISLE[k] : S.data.categories.findIndex(c => c[0] === k);
  renderCards();
}

function questList() {
  const all = S.data ? S.data.projects : [];
  return all.filter(p => S.filter === 'all' || p.category === S.filter);
}

// 9 quests per page on desktop (3×3), 6 per page in the phone carousel
const pageSize = () => mqMobile.matches ? 6 : 9;

function renderCards() {
  const all = questList(), size = pageSize(), pages = Math.max(1, Math.ceil(all.length / size));
  S.page = Math.min(S.page, pages - 1);
  const start = S.page * size, L = all.slice(start, start + size);
  $('questCount').textContent = tr(all.length === 1 ? '{n} quest' : '{n} quests', { n: all.length });
  renderPager(pages);
  $('cards').innerHTML = L.map((p, i) =>
    `<a href="#quest" class="card" data-quest="${esc(p.key)}" style="animation-delay:${Math.min(i, 8) * 50}ms">
      <div class="card-img"><img src="${esc(url(p.img))}" alt="${esc(p.title)}" loading="lazy" decoding="async"><span class="card-cat">${esc(catLabel(p.category))}</span></div>
      <div class="card-body"><span class="label-cinzel">${tr('Quest {n}', { n: pad2(start + i + 1) })}</span><div class="card-title">${esc(p.title)}</div><div class="card-desc">${esc(p.desc)}</div>
        <div class="card-foot"><div class="card-stack">${p.stack.slice(0, 5).map(s => `<img src="${esc(icon(s))}" alt="" loading="lazy">`).join('')}</div><span class="card-cta">${tr('View quest')}<span>${svg('i-arrow-up-right')}</span></span></div></div></a>`).join('');
  document.querySelectorAll('#filters .seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === S.filter)));
}

function renderPager(pages) {
  const pager = $('pager');
  pager.hidden = pages < 2;
  if (pages < 2) { pager.innerHTML = ''; return; }
  const cur = S.page;
  pager.innerHTML = `<button class="round-btn round-44" data-page="${cur - 1}" aria-label="${tr('Previous page')}"${cur === 0 ? ' disabled' : ''}>${svg('i-arrow-left')}</button>
    <div class="pager-nums">${Array.from({ length: pages }, (_, k) => `<button class="pager-num${k === cur ? ' is-on' : ''}" data-page="${k}" aria-label="${tr('Page {n}', { n: k + 1 })}"${k === cur ? ' aria-current="page"' : ''}>${k + 1}</button>`).join('')}</div>
    <button class="round-btn round-44" data-page="${cur + 1}" aria-label="${tr('Next page')}"${cur === pages - 1 ? ' disabled' : ''}>${svg('i-arrow-right')}</button>
    <span class="pager-lbl">${tr('Page {n} of {total}', { n: cur + 1, total: pages })}</span>`;
}
function goPage(n) {
  S.page = n;
  renderCards();
  $('cards').scrollLeft = 0;
  // bring the first card of the new page into view, below the nav + sticky filter bar
  const top = $('cards').getBoundingClientRect().top + scrollY - 140;
  if (scrollY > top) scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
}

function certList() { return S.data ? S.data.certifications : []; }

function renderCerts() {
  const cl = certList(), n = Math.max(1, cl.length);
  $('certifications').style.setProperty('--n', n);
  $('certDots').innerHTML = cl.map((_, i) => `<button data-cert="${i}" aria-label="${tr('Go to certificate {n}', { n: i + 1 })}"></button>`).join('');
  shared.certs = cl.map(c => url(c.img));
  if (world) world.buildVault(shared.certs);
  updateCert();
}
function updateCert() {
  const cl = certList(), n = cl.length;
  if (!n) { $('certTitle').textContent = ''; $('certSub').textContent = ''; return; }
  const cc = S.cert % n, cur = cl[cc];
  $('certTitle').textContent = cur.title || tr('Certificate {n}', { n: pad2(cc + 1) });
  $('certSub').textContent = cur.issuer || tr('Relic {n} of {total}', { n: cc + 1, total: n });
  $('certView').href = url(cur.img);
  [...$('certDots').children].forEach((b, i) => b.classList.toggle('is-on', i === cc));
  shared.cert = cc;
}

function renderResume(d) {
  const item = x => `<div class="tl-item" data-rid="${esc(x.id)}">${x.year ? `<span class="tl-year">${esc(x.year)}</span>` : ''}<div class="tl-title">${esc(x.title)}</div>${x.inst ? `<div class="tl-inst">${esc(x.inst)}</div>` : ''}${x.badge ? `<span class="tl-badge">${esc(x.badge)}</span>` : ''}${x.desc ? `<div class="tl-desc">${esc(x.desc)}</div>` : ''}${x.highlights.length ? x.highlights.map(h => `<div class="bullet tl-desc">${esc(h)}</div>`).join('') : ''}${x.tags.length ? `<div class="tags">${x.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>`;
  const group = k => d.resume[k].length ? `<div class="res-group${groupShown(k) ? ' is-active' : ''}" data-group="${k}"><div class="res-group-h"><span class="caps">${tr(RES_GROUPS[k][0])}</span></div><div class="tl">${d.resume[k].map(item).join('')}</div></div>` : '';
  $('resCols').innerHTML = `<div class="res-col">${[0, 1].map(group).join('')}</div><div class="res-col">${[2, 3, 4].map(group).join('')}</div>`;
  $('resTabs').innerHTML = RES_GROUPS.map(([, tab], k) => d.resume[k].length && k !== 1 ? `<button class="seg-btn" data-restab="${k}" aria-pressed="${k === S.resTab}">${tr(tab)}</button>` : '').join('');
  $('resTabs').style.gridTemplateColumns = `repeat(${$('resTabs').children.length}, minmax(0,1fr))`;
}
// On phones one group shows at a time; Work Experience always sits under Summary.
const groupShown = k => k === S.resTab || (k === 1 && S.resTab === 0);
function setResTab(k) {
  S.resTab = k;
  document.querySelectorAll('.res-group').forEach(g => g.classList.toggle('is-active', groupShown(+g.dataset.group)));
  document.querySelectorAll('[data-restab]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.restab === k)));
}

function render(data) {
  const first = !S.data;
  S.data = data;
  if (S.resTab === 1 || !data.resume[S.resTab].length) S.resTab = Math.max(0, data.resume.findIndex((g, k) => g.length && k !== 1));
  renderProfile(data.profile);
  renderSkills(data);
  if (S.filter !== 'all' && !data.categories.some(c => c[0] === S.filter)) S.filter = 'all';
  renderFilters(data);
  renderCards();
  renderCerts();
  renderResume(data);
  document.body.classList.remove('is-loading');
  setStoryTexts(data.story);
  setMusicTracks(Object.fromEntries(Object.entries(data.music || {}).filter(([, v]) => v).map(([k, v]) => [k, url(v)])));
  setOraclePhoto(url(data.profile.photo));
  setOracleData(data);
  progress('data');
  if (first) startRoles();
  onScroll();
}

function renderError() {
  document.body.classList.remove('is-loading');
  progress('data');
  $('cards').innerHTML = `<p class="lead">${tr('The archive is resting — quests could not be loaded right now. Please refresh in a moment.')}</p>`;
}

let roleT;
function startRoles() {
  clearInterval(roleT);
  roleT = setInterval(() => {
    const roles = S.data.profile.roles || [];
    if (roles.length < 2) return;
    S.roleI = (S.roleI + 1) % roles.length;
    $('heroRole').textContent = roles[S.roleI];
  }, 2600);
}

/* ---------------- scroll journey ---------------- */

let tops = [], docH = 0, vh = innerHeight, certTop = 0, certSpan = 1;
function measure() {
  vh = innerHeight;
  const sy = scrollY;
  tops = CHAPTERS.map(([id]) => $(id).getBoundingClientRect().top + sy);
  docH = document.documentElement.scrollHeight - vh;
  certTop = tops[4];
  certSpan = Math.max(1, $('certifications').offsetHeight - vh);
}

let lastCi = -1, ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; handleScroll(); });
}
function handleScroll() {
  if (!tops.length) measure();
  const sy = scrollY, pos = sy + vh * 0.4, ease = x => x * x * (3 - 2 * x);
  let i = 0; while (i < tops.length - 1 && pos >= tops[i + 1]) i++;
  let f = 0;
  if (i === 0) f = ease(Math.min(1, Math.max(0, pos - vh * 0.4) / Math.max(1, tops[1] - vh * 0.4)));
  else if (i < tops.length - 1) { const raw = (pos - tops[i]) / Math.max(1, tops[i + 1] - tops[i]), h = HOLD[i]; f = ease(Math.min(1, Math.max(0, (raw - h) / (1 - h)))); }
  if (sy >= docH - 4) { i = tops.length - 1; f = 0; }
  const jt = i + f;
  shared.jt = jt;

  const n = certList().length;
  if (n && sy >= certTop - vh * 0.5 && sy <= certTop + certSpan) {
    const ci = Math.max(0, Math.min(n - 1, Math.floor((sy - certTop) / certSpan * n)));
    if (ci !== S.cert) { S.cert = ci; updateCert(); }
  }

  ['about', 'skills', 'portfolio', 'certifications', 'resume', 'contact'].forEach(id => {
    if (S.seen[id]) return;
    const off = id === 'skills' || id === 'resume' ? vh * 0.25 : 0;
    if ($(id).getBoundingClientRect().top + off < vh * 0.7) reveal(id);
  });
  if (!S.seen.traits && $('skills').getBoundingClientRect().bottom < vh * 1.3) reveal('traits');

  const prog = docH > 0 ? Math.min(1, sy / docH) : 0;
  $('progress').style.transform = `scaleX(${prog})`;
  $('railFill').style.height = Math.min(100, jt / (CHAPTERS.length - 1) * 100) + '%';
  const ci = Math.min(CHAPTERS.length - 1, Math.round(jt));
  $('mapProg').textContent = tr('Chapter {n} of {total} · {pct}% explored', { n: ci + 1, total: CHAPTERS.length, pct: Math.round(prog * 100) });
  // XP fills between level-ups (a level changes halfway between chapters)
  $('hudXp').style.width = Math.round(Math.min(1, Math.max(0, jt - ci + 0.5)) * 100) + '%';
  if (ci !== lastCi) {
    if (lastCi >= 0 && ci > lastCi) levelUp(ci);
    lastCi = ci;
    shared.level = ci;
    $('hudLv').textContent = LEVELS[ci][0];
    $('hudName').textContent = tr(LEVELS[ci][1]);
    $('chapNum').textContent = tr(CHAPTERS[ci][1]);
    $('chapName').textContent = tr(CHAPTERS[ci][2]);
    document.querySelectorAll('.map-row').forEach((r, k) => { r.classList.toggle('is-here', k === ci); r.classList.toggle('is-past', k < ci); });
  }
  document.querySelectorAll('.rail-pt').forEach((r, k) => { r.classList.toggle('is-here', k === ci); r.classList.toggle('is-past', k <= jt + 0.01); });
}
let lvT;
function levelUp(ci) {
  const [lv, name] = LEVELS[ci];
  $('lvupTxt').textContent = `Lv ${lv} · ${tr(name)}`;
  const el = $('lvup'), hud = $('hud');
  el.classList.remove('is-on'); hud.classList.remove('is-up');
  void el.offsetWidth; // restart the animation
  el.classList.add('is-on'); hud.classList.add('is-up');
  clearTimeout(lvT);
  lvT = setTimeout(() => { el.classList.remove('is-on'); hud.classList.remove('is-up'); }, 2200);
}
function reveal(id) {
  S.seen[id] = true;
  document.querySelectorAll(`[data-reveal="${id}"]`).forEach(el => el.classList.add('is-seen'));
}

function go(id) {
  setMenu(false);
  closeOracle(); // picking a chapter during an Oracle call ends the call and flies back to the page
  const el = $(id);
  if (!el) return;
  const top = id === 'hero' ? 0 : el.getBoundingClientRect().top + scrollY + (id === 'certifications' ? 0 : 40);
  scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
}
function goCert(i) {
  const n = certList().length;
  if (!n) return;
  measure();
  scrollTo({ top: certTop + (i + 0.5) / n * certSpan, behavior: reduceMotion ? 'auto' : 'smooth' });
}

function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  $('chapBtn').setAttribute('aria-expanded', String(open));
}

/* ---------------- quest detail ---------------- */

let lockCount = 0;
function lock(on) {
  lockCount = Math.max(0, lockCount + (on ? 1 : -1));
  document.documentElement.classList.toggle('lock', lockCount > 0);
}

function openDetail(key) {
  const wasOpen = !!S.detail;
  S.detail = key; S.dImg = 0; S.camp = 0;
  renderDetail();
  if (!wasOpen) { $('detail').classList.add('is-open'); lock(true); $('detailScroll').scrollTop = 0; $('detailBack').focus({ preventScroll: true }); }
}
function closeDetail() {
  if (!S.detail) return;
  S.detail = null;
  $('detail').classList.remove('is-open');
  lock(false);
}
function stepQuest(d) {
  const L = questList(), n = L.length;
  if (!n) return;
  const i = L.findIndex(p => p.key === S.detail);
  S.detail = L[(i + d + n) % n].key; S.dImg = 0; S.camp = 0;
  renderDetail();
  $('detailScroll').scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}
function detailGallery(p) { return p.gallery.length ? p.gallery : [[p.img, p.title]]; }

function renderDetail() {
  const L = questList(), di = L.findIndex(p => p.key === S.detail);
  if (di < 0) return;
  const p = L[di], n = L.length, no = pad2(di + 1), cat = esc(catLabel(p.category));
  const gal = detailGallery(p), gi = Math.min(S.dImg, gal.length - 1), [mainSrc, mainCap] = gal[gi];
  const info = [[tr('Category'), catLabel(p.category)], ...p.info];
  const prev = L[(di - 1 + n) % n], next = L[(di + 1) % n];
  $('detailCenter').innerHTML = `<span class="label-cinzel">${tr('Quest {n}', { n: no })}</span><i></i><span>${cat}</span>`;
  $('detailBody').innerHTML = `
    <div class="d-grid">
      <div class="d-gallery">
        <button class="d-main" data-lb="main"><img src="${esc(url(mainSrc))}" alt="${esc(mainCap)}"><span class="d-main-cap"><span>${esc(mainCap)}</span><span class="d-full">${svg('i-maximize-2')}${tr('View full')}</span></span></button>
        ${gal.length > 1 ? `<div class="d-thumbs">${gal.map(([src, cap], k) => `<button data-dimg="${k}" class="${k === gi ? 'is-on' : ''}" aria-label="${esc(cap)}"><img src="${esc(url(src))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div class="d-card d-info">
        <div class="d-titles"><span class="label-cinzel">${tr('Quest {n}', { n: no })} · ${cat}</span><h2 class="d-title">${esc(p.title)}</h2>${p.role ? `<span class="d-role">${esc(p.role)}</span>` : ''}</div>
        ${p.links.length ? `<div class="d-links">${p.links.map(([label, href]) => `<a class="d-link" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} ${svg('i-arrow-up-right')}</a>`).join('')}</div>` : ''}
        <div class="glist">${info.map(([k, v]) => `<div class="d-kv"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div>`).join('')}</div>
        ${p.tech.length ? `<div class="d-sub"><span class="caps">${esc(tr('Skills & Tools'))}</span><div class="chips">${p.tech.map(([name, ic]) => `<span class="chip"><span class="chip-ico"><img src="${esc(icon(ic))}" alt="" loading="lazy"></span>${esc(name)}</span>`).join('')}</div></div>` : ''}
        ${p.competencies.length ? `<div class="d-sub"><span class="caps">${tr('Competencies')}</span><div class="chips">${p.competencies.map(s => `<span class="chip chip-teal">${esc(s)}</span>`).join('')}</div></div>` : ''}
      </div>
    </div>
    <div class="d-grid">
      <div class="d-card"><span class="caps">${tr('About the quest')}</span>${(p.paras.length ? p.paras : [p.desc]).map(t => `<p>${esc(t)}</p>`).join('')}</div>
      ${p.list.length ? `<div class="d-card"><span class="caps">${esc(p.listTitle || tr('Highlights'))}</span>${p.list.map(li => `<div class="bullet">${esc(li)}</div>`).join('')}</div>` : ''}
    </div>
    ${p.campaigns.length ? `<div class="d-card camp" id="campaigns">${renderCampaign(p)}</div>` : ''}
    <div class="d-pn">
      <button class="d-card" data-step="-1">${roundArrow('left')}<span class="d-pn-txt"><span class="label-cinzel">${tr('Previous quest')}</span><b>${esc(prev.title)}</b></span></button>
      <button class="d-card" data-step="1"><span class="d-pn-txt"><span class="label-cinzel">${tr('Next quest')}</span><b>${esc(next.title)}</b></span>${roundArrow('right')}</button>
    </div>`;
}
const roundArrow = dir => `<span class="round-btn round-44">${svg('i-arrow-' + dir)}</span>`;

function renderCampaign(p) {
  const cs = p.campaigns, c = cs[Math.min(S.camp, cs.length - 1)];
  return `<div class="d-titles"><span class="label-cinzel">${tr('Side Quests')}</span><div class="h3">${esc(tr('Campaigns & events'))}</div></div>
    <div class="seg camp-tabs">${cs.map((x, k) => `<button class="seg-btn" data-camp="${k}" aria-pressed="${k === S.camp}">${esc(x.name)}</button>`).join('')}</div>
    <div class="camp-grid">
      <div class="camp-txt">
        <div class="d-titles" style="gap:6px"><span class="camp-date">${esc(c.date)}</span><div class="camp-name">${esc(c.name)}</div></div>
        ${(c.paras || []).map(t => `<p>${esc(t)}</p>`).join('')}
        ${(c.list || []).length ? `<div class="camp-list"><span class="caps">${esc(c.listTitle || tr('Highlights'))}</span>${c.list.map(li => `<div class="bullet">${esc(li)}</div>`).join('')}</div>` : ''}
      </div>
      <div class="camp-media">
        ${c.video ? `<div class="video"><iframe src="${esc(c.video)}" title="${esc(tr('{name} video', { name: c.name }))}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : ''}
        <div class="camp-gal">${(c.gallery || []).map(([src, cap], k) => `<button data-campimg="${k}"><img src="${esc(url(src))}" alt="${esc(cap)}" loading="lazy"><span>${esc(cap)}</span></button>`).join('')}</div>
      </div>
    </div>`;
}

/* ---------------- lightbox ---------------- */

function openLb(items, i) {
  const wasOpen = !!S.lb;
  S.lb = { items, i, zoom: false };
  renderLb();
  if (!wasOpen) { $('lb').classList.add('is-open'); lock(true); }
}
function closeLb() {
  if (!S.lb) return;
  S.lb = null;
  $('lb').classList.remove('is-open', 'is-zoom');
  lock(false);
}
function stepLb(d) {
  const lb = S.lb; if (!lb) return;
  const n = lb.items.length;
  lb.i = (lb.i + d + n) % n; lb.zoom = false;
  renderLb();
}
function renderLb() {
  const lb = S.lb, [src, cap] = lb.items[lb.i];
  $('lbImg').src = url(src) || BLANK;
  $('lbImg').alt = cap || '';
  $('lbCap').textContent = cap || '';
  $('lbCount').textContent = (lb.i + 1) + ' / ' + lb.items.length;
  $('lbOpen').href = url(src);
  $('lb').classList.toggle('is-single', lb.items.length < 2);
  setZoom(lb.zoom);
  $('lbThumbs').innerHTML = lb.items.length > 1 ? lb.items.map(([s], k) => `<button data-lbi="${k}" class="${k === lb.i ? 'is-on' : ''}" aria-label="${tr('Image {n}', { n: k + 1 })}"><img src="${esc(url(s))}" alt="" loading="lazy"></button>`).join('') : '';
}
function setZoom(on, ox, oy) {
  if (!S.lb) return;
  S.lb.zoom = on;
  $('lb').classList.toggle('is-zoom', on);
  $('lbImg').style.transformOrigin = on ? `${ox == null ? 50 : ox}% ${oy == null ? 50 : oy}%` : '50% 50%';
  $('lbZoom').querySelector('use').setAttribute('href', on ? '#i-zoom-out' : '#i-zoom-in');
  $('lbZoomLbl').textContent = tr(on ? 'Fit to screen' : 'Zoom 2×');
}
function openCertLb(i) {
  openLb(certList().map((c, k) => [c.img, c.title || tr('Certificate {n}', { n: pad2(k + 1) })]), i);
}

/* ---------------- events ---------------- */

function bind() {
  addEventListener('scroll', onScroll, { passive: true });
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { measure(); handleScroll(); }, 100); });
  mqMobile.addEventListener('change', () => { fitSkillNames(); if (S.data) renderCards(); });
  new ResizeObserver(() => { measure(); onScroll(); }).observe(document.querySelector('.main'));

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-go],[data-quest],[data-filter],[data-cert],[data-restab],[data-step],[data-dimg],[data-camp],[data-campimg],[data-lb],[data-lbi],[data-page]');
    if (!t) return;
    const ds = t.dataset;
    if (ds.page != null) { if (!t.disabled) goPage(+ds.page); }
    else if (ds.go) { e.preventDefault(); go(ds.go); }
    else if (ds.quest) { e.preventDefault(); openDetail(ds.quest); }
    else if (ds.filter) setFilter(ds.filter);
    else if (ds.cert) goCert(+ds.cert);
    else if (ds.restab) setResTab(+ds.restab);
    else if (ds.step) stepQuest(+ds.step);
    else if (ds.dimg) { S.dImg = +ds.dimg; renderDetail(); }
    else if (ds.camp) { S.camp = +ds.camp; $('campaigns').innerHTML = renderCampaign(questList().find(p => p.key === S.detail)); }
    else if (ds.campimg) { const p = questList().find(x => x.key === S.detail); openLb(p.campaigns[S.camp].gallery, +ds.campimg); }
    else if (ds.lb) { const p = questList().find(x => x.key === S.detail); openLb(detailGallery(p), Math.min(S.dImg, detailGallery(p).length - 1)); }
    else if (ds.lbi) { e.stopPropagation(); S.lb.i = +ds.lbi; S.lb.zoom = false; renderLb(); }
  });

  $('chapBtn').addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $('mapScrim').addEventListener('click', () => setMenu(false));
  $('mapClose').addEventListener('click', () => setMenu(false));

  // skills ↔ obelisks
  $('skillGrid').addEventListener('mouseover', e => { const s = e.target.closest('[data-skill]'); shared.hoverSkill = s ? +s.dataset.skill : -1; });
  $('skillGrid').addEventListener('mouseleave', () => { shared.hoverSkill = -1; });

  // card tilt (fine pointers only)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    $('cards').addEventListener('mousemove', e => {
      const el = e.target.closest('.card'); if (!el) return;
      const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      el.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(10px)`;
    });
    $('cards').addEventListener('mouseout', e => { const el = e.target.closest('.card'); if (el && !el.contains(e.relatedTarget)) el.style.transform = ''; });
  }

  // certificates
  $('certPrev').addEventListener('click', () => goCert(Math.max(0, S.cert - 1)));
  $('certNext').addEventListener('click', () => goCert(Math.min(certList().length - 1, S.cert + 1)));
  $('certHit').addEventListener('click', () => certList().length && openCertLb(S.cert));
  $('certView').addEventListener('click', e => { e.preventDefault(); if (certList().length) openCertLb(S.cert); });

  // detail
  $('detailBack').addEventListener('click', closeDetail);

  // lightbox
  $('lb').addEventListener('click', e => { if (e.target === $('lb') || e.target === $('lbStage')) closeLb(); });
  $('lbClose').addEventListener('click', closeLb);
  $('lbPrev').addEventListener('click', () => stepLb(-1));
  $('lbNext').addEventListener('click', () => stepLb(1));
  $('lbZoom').addEventListener('click', () => setZoom(!S.lb.zoom));
  $('lbImg').addEventListener('click', e => {
    const b = e.currentTarget.getBoundingClientRect();
    setZoom(!S.lb.zoom, (e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100);
  });

  addEventListener('keydown', e => {
    if (S.lb) { if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowRight') stepLb(1); else if (e.key === 'ArrowLeft') stepLb(-1); return; }
    if (document.body.classList.contains('menu-open') && e.key === 'Escape') { setMenu(false); return; }
    if (S.detail) { if (e.key === 'Escape') closeDetail(); else if (e.key === 'ArrowRight') stepQuest(1); else if (e.key === 'ArrowLeft') stepQuest(-1); }
  });

  // contact → mailto, flare the beacon first
  $('contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.currentTarget.elements, to = (S.data && S.data.profile.email) || 'suryadharma.dy@gmail.com';
    shared.flare = 1;
    const href = 'mailto:' + to + '?subject=' + encodeURIComponent(f.subject.value) + '&body=' + encodeURIComponent(tr('Name') + ': ' + f.name.value + '\nEmail: ' + f.email.value + '\n\n' + f.message.value);
    setTimeout(() => { location.href = href; }, 900);
  });
}

/* ---------------- 3D world (loaded after content, never blocks it) ---------------- */

function startWorld() {
  const host = $('scene');
  const ok = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  const skip = () => ['engine', 'world', 'frames'].forEach(progress);
  if (!ok) return skip();
  import('./world.js').then(m => {
    progress('engine');
    world = m.initWorld(host, shared);
    if (shared.certs.length) world.buildVault(shared.certs);
    if (shared.skills.length) world.buildObelisks(shared.skills);
    progress('world');
    // show the world after a few seconds whatever happens (a stalled GPU must never leave a blank background)
    setTimeout(() => { host.classList.add('is-ready'); progress('frames'); }, 6000);
    return world.warm();
  }).then(() => {
    // a few rendered frames means the first view is on screen
    let n = 0;
    const wait = () => { if (++n < 4) return requestAnimationFrame(wait); host.classList.add('is-ready'); progress('frames'); };
    requestAnimationFrame(wait);
  }).catch(e => { console.warn('3D world unavailable', e); skip(); });
}

document.body.classList.add('is-loading');
// coming back from a WebGL context reset: return to where the visitor was
try { const y = sessionStorage.getItem('pf-scroll'); if (y) { sessionStorage.removeItem('pf-scroll'); window.__resume = true; addEventListener('load', () => scrollTo(0, +y)); } } catch (e) { /* private mode */ }
initExperience({
  shared,
  levelOf: i => LEVELS[i],
  closeOverlays: () => { closeDetail(); closeLb(); setMenu(false); },
  setFilter: k => { if (S.data && (k === 'all' || S.data.categories.some(c => c[0] === k)) && S.filter !== k) setFilter(k); },
  setResTab: k => { if (S.data) setResTab(k); },
  goCertByTitle: q => { const n = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); const i = certList().findIndex(c => n(c.title + ' ' + c.issuer).includes(n(q))); if (i >= 0) goCert(i); },
  openOracle,
  onEnter: () => { $('oracleFab').hidden = false; }
});
initOracle({ shared });
onLangChange(() => {
  renderStatic();
  lastCi = -1; // refresh the HUD, chapter button and map in the new language
  const d = relocalize();
  if (d) render(d);
  if (S.detail) renderDetail();
  if (S.lb) renderLb();
});
renderStatic();
bind();
measure();
handleScroll();
loadData(render, renderError);
// the splash screen covers loading, so the 3D world starts right away
startWorld();
