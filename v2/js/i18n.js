// Site language (English / Bahasa Indonesia) for the whole page: UI text, content from Firestore and narration.
// UI strings are keyed by their English text; content fields in Firestore can be plain strings or { en, id } maps.
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
};

let lang = store.get('pf-lang') === 'id' ? 'id' : 'en';
const listeners = [];
export const getLang = () => lang;
export function onLangChange(fn) { listeners.push(fn); }
export function setLang(l) {
  if (l !== 'en' && l !== 'id') return;
  if (l === lang) return;
  lang = l;
  store.set('pf-lang', l);
  applyI18n();
  listeners.forEach(fn => fn(l));
}

const ID = {
  // head
  'Doddy Suryadharma — Portfolio': 'Doddy Suryadharma — Portofolio',
  // splash
  'Welcome to': 'Selamat datang di',
  'The first world': 'Dunia pertamadan ',
  'Summoning the world…': 'Memanggil dunia…',
  'Gathering the chronicles…': 'Mengumpulkan kisah-kisah…',
  'Inking the runes…': 'Menulis rune…',
  'Raising the floating isles…': 'Mengangkat pulau-pulau melayang…',
  'Lighting the crystals…': 'Menyalakan kristal…',
  'The world awaits': 'Dunia sudah menanti',
  'Loading': 'Memuat',
  'Begin the Story': 'Mulai Cerita',
  'A narrated journey · about 3 minutes': 'Perjalanan dengan narasi · sekitar 3 menit',
  'Explore on my own': 'Jelajahi sendiri',
  'Wander the isles at your own pace': 'Susuri pulau-pulau sesukamu',
  'Language': 'Bahasa',
  'Best with sound on': 'Paling seru dengan suara',
  'Best experienced on a desktop — the 3D world opens up on a bigger screen.': 'Paling seru dibuka di desktop — dunia 3D-nya terasa lebih luas di layar besar.',
  // cinematic
  'Level 1 · The beginning of a dream': 'Level 1 · Awal sebuah mimpi',
  'The Tale of Doddy Suryadharma': 'Kisah Doddy Suryadharma',
  // nav
  'Doddy Suryadharma — back to the start': 'Doddy Suryadharma — kembali ke awal',
  'Level': 'Level',
  'Open journey map': 'Buka peta perjalanan',
  'Turn music on': 'Nyalakan musik',
  'Turn music off': 'Matikan musik',
  'Switch to Bahasa Indonesia': 'Ganti ke English',
  'Download CV': 'Unduh CV',
  'Journey Map': 'Peta Perjalanan',
  'Close': 'Tutup',
  'You are here': 'Kamu di sini',
  'Chapter {n} of {total} · {pct}% explored': 'Bab {n} dari {total} · {pct}% dijelajahi',
  'Level up!': 'Naik level!',
  // chapters
  'Prologue': 'Prolog', 'Chapter I': 'Bab I', 'Chapter II': 'Bab II', 'Chapter III': 'Bab III', 'Chapter IV': 'Bab IV', 'Chapter V': 'Bab V', 'Chapter VI': 'Bab VI',
  'The Crystal Shrine': 'Kuil Kristal', "The Adventurer's Camp": 'Markas Sang Petualang', 'The Training Grounds': 'Arena Latihan',
  'The Guild Isles': 'Kepulauan Guild', 'The Relic Vault': 'Ruang Relik', 'The Long Road': 'Jalan Panjang', 'The Beacon': 'Mercusuar',
  'Home': 'Beranda', 'About': 'Tentang', 'Skills': 'Keahlian', 'Portfolio': 'Portofolio', 'Certifications': 'Sertifikasi', 'Resume': 'Resume', 'Contact': 'Kontak',
  // levels
  'The Dreamer Kid': 'Si Bocah Pemimpi', 'Freshman Adventurer': 'Petualang Mahasiswa Baru', 'Apprentice Coder': 'Coder Pemula',
  'Guild Builder': 'Pembangun Guild', 'Relic Seeker': 'Pemburu Relik', 'Road Walker': 'Pengembara Jalan', 'Aspiring Game Master': 'Calon Game Master',
  'Game Master · The Oracle': 'Game Master · Sang Oracle',
  // hero / about
  "Hello, I'm": 'Halo, saya',
  'View My Work': 'Lihat Karya Saya',
  'The Adventurer': 'Sang Petualang',
  'About Me': 'Tentang Saya',
  'Contact Me': 'Hubungi Saya',
  'View Resume': 'Lihat Resume',
  'Years experience': 'Tahun pengalaman', 'Year experience': 'Tahun pengalaman', 'Projects': 'Proyek', 'GPA': 'IPK',
  'Born': 'Lahir', 'Location': 'Lokasi', 'Education': 'Pendidikan', 'Email': 'Email', 'Phone': 'Telepon', 'Call': 'Telepon',
  // skills
  'Programming languages, frameworks & software. Each obelisk above rises to my proficiency — hover a skill to light its stone.':
    'Bahasa pemrograman, framework & software. Setiap obelisk di atas setinggi kemahiran saya — arahkan kursor ke sebuah skill untuk menyalakan batunya.',
  'Also in the toolkit': 'Juga di perlengkapan',
  'Core competencies': 'Kompetensi inti',
  'Passive Traits': 'Sifat Pasif',
  'What I bring to the party': 'Yang saya bawa ke dalam tim',
  'Expert': 'Ahli', 'Advanced': 'Mahir', 'Proficient': 'Cakap',
  // portfolio
  'Four isles, four kinds of quests. Pick a guild to fly there — tap any quest to open its full log.':
    'Empat pulau, empat jenis quest. Pilih guild untuk terbang ke sana — ketuk quest mana pun untuk membuka catatan lengkapnya.',
  'Filter quests': 'Saring quest',
  'Quest pages': 'Halaman quest',
  'Swipe to browse all quests': 'Geser untuk melihat semua quest',
  'All': 'Semua', 'Work': 'Kerja', 'Internship': 'Internship', 'Campus': 'Kampus', 'Organizational': 'Organisasi',
  '{n} quest': '{n} quest', '{n} quests': '{n} quest',
  'Quest {n}': 'Quest {n}',
  'View quest': 'Lihat quest',
  'Previous page': 'Halaman sebelumnya', 'Next page': 'Halaman berikutnya', 'Page {n}': 'Halaman {n}', 'Page {n} of {total}': 'Halaman {n} dari {total}',
  'The archive is resting — quests could not be loaded right now. Please refresh in a moment.':
    'Arsip sedang beristirahat — quest belum bisa dimuat. Coba muat ulang sebentar lagi.',
  // certifications
  'View certificate': 'Lihat sertifikat',
  'View': 'Lihat',
  'Previous certificate': 'Sertifikat sebelumnya', 'Next certificate': 'Sertifikat berikutnya',
  'Go to certificate {n}': 'Ke sertifikat {n}',
  'Certificate {n}': 'Sertifikat {n}',
  'Relic {n} of {total}': 'Relik {n} dari {total}',
  'Scroll to turn the vault · Tap a relic to view it in full': 'Scroll untuk memutar ruang relik · Ketuk relik untuk melihatnya penuh',
  'Scroll or tap a relic': 'Scroll atau ketuk relik',
  // resume
  "Every lantern on the road is a milestone — education, achievements and the teams I've led.":
    'Setiap lentera di jalan ini adalah pencapaian — pendidikan, prestasi, dan tim yang pernah saya pimpin.',
  'Download Resume': 'Unduh Resume',
  'View or save': 'Lihat atau simpan',
  'PDF · View or save': 'PDF · Lihat atau simpan',
  'Online CV · Opens in a new tab': 'CV online · Terbuka di tab baru',
  'Summary': 'Ringkasan', 'Work Experience': 'Pengalaman Kerja', 'Achievement': 'Prestasi', 'Awards': 'Prestasi',
  'Organizational Experience': 'Pengalaman Organisasi', 'Leadership': 'Organisasi',
  // contact
  "Light the beacon — send a message and I'll answer the call.": 'Nyalakan mercusuar — kirim pesan dan saya akan menjawab panggilannya.',
  'Ask my AI Oracle': 'Tanya AI Oracle saya',
  'Talk or type — it knows my work and experience': 'Bicara atau ketik — ia tahu karya dan pengalaman saya',
  'Your name': 'Nama kamu', 'Your email': 'Email kamu', 'Subject': 'Subjek', 'Message': 'Pesan',
  'Light the Beacon': 'Nyalakan Mercusuar',
  'Find me elsewhere': 'Temukan saya di tempat lain',
  'The journey continues.': 'Perjalanan berlanjut.',
  'Name': 'Nama',
  // story bar
  'Story mode': 'Mode cerita',
  'Pause story': 'Jeda cerita', 'Resume story': 'Lanjutkan cerita',
  'Next chapter': 'Bab berikutnya',
  'Narration language': 'Bahasa narasi',
  'Exit story': 'Keluar cerita',
  // oracle
  'Ask me': 'Tanya aku',
  "Ask Doddy's AI Oracle": 'Tanya AI Oracle Doddy',
  "The Oracle's Isle": 'Pulau Sang Oracle',
  'An AI trained on my portfolio — answers can be imperfect. Voice uses your microphone.':
    'AI yang dilatih dari portofolio saya — jawabannya bisa kurang tepat. Mode suara memakai mikrofonmu.',
  'Your question': 'Pertanyaanmu',
  'Send': 'Kirim',
  // detail
  'Quest detail': 'Detail quest',
  'Quest Log': 'Catatan Quest',
  'Previous quest': 'Quest sebelumnya', 'Next quest': 'Quest berikutnya',
  'Category': 'Kategori', 'Role': 'Peran', 'Project Date': 'Tanggal Proyek', 'Team Size': 'Jumlah Tim',
  '{n} person': '{n} orang', '{n} people': '{n} orang',
  'View Project': 'Lihat Proyek', 'Source Code': 'Kode Sumber',
  'View full': 'Lihat penuh',
  'Skills & Tools': 'Skill & Tools',
  'Competencies': 'Kompetensi',
  'About the quest': 'Tentang quest ini',
  'Highlights': 'Sorotan',
  'Side Quests': 'Side Quest',
  'Campaigns & events': 'Kampanye & acara',
  '{name} video': 'Video {name}',
  // lightbox
  'Image viewer': 'Penampil gambar',
  'Zoom': 'Perbesar', 'Zoom 2×': 'Perbesar 2×', 'Fit to screen': 'Pas layar',
  'Open original': 'Buka asli',
  'Previous': 'Sebelumnya', 'Next': 'Berikutnya',
  'Image {n}': 'Gambar {n}'
};

// tr('Page {n} of {total}', { n: 2, total: 3 })
export function tr(s, vars) {
  let r = lang === 'id' && ID[s] != null ? ID[s] : s;
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return r;
}

// Content from Firestore: { en, id } → the current language (falls back to the other one); anything else is returned as is.
export const isLoc = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every(k => k === 'en' || k === 'id');
export function localize(v, l = lang) {
  if (Array.isArray(v)) return v.map(x => localize(x, l));
  if (isLoc(v)) return v[l] != null && v[l] !== '' ? v[l] : (v.en != null ? v.en : v.id);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = localize(v[k], l); return o; }
  return v;
}

// Static markup: data-i18n translates the element's text, data-i18n-attr="aria-label,placeholder" translates attributes.
// The English original is remembered on first run so switching back and forth always works.
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.dataset.i18n === '') el.dataset.i18n = el.textContent.trim();
    el.textContent = tr(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nSrc = el.dataset.i18nSrc || JSON.stringify(Object.fromEntries(el.dataset.i18nAttr.split(',').map(a => [a, el.getAttribute(a) || ''])));
    const src = JSON.parse(el.dataset.i18nSrc);
    for (const a in src) el.setAttribute(a, tr(src[a]));
  });
  document.title = tr('Doddy Suryadharma — Portfolio');
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  const lb = document.getElementById('langBtn');
  if (lb) { lb.querySelector('b').textContent = lang === 'id' ? 'ID' : 'EN'; lb.setAttribute('aria-label', lang === 'id' ? 'Ganti ke English' : 'Switch to Bahasa Indonesia'); }
}
