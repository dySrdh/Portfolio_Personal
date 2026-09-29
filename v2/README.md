# Portfolio v2 — Fantasy Journey

Desain kedua, terpisah dari desain lama (`/index.html` tidak diubah). Buka di `/v2/`.

## Data: Firebase Firestore (online 24 jam, tidak pernah di-pause)

Semua konten diambil dari Firestore. Edit di Firebase Console → Firestore Database, refresh halaman, selesai — tanpa deploy.
Gambar ada di repo (`assets/media/`, `assets/img/`), di-host bersama situs.

| Collection | Isi |
|---|---|
| `site/profile` | Nama, sapaan, `roles` (teks berganti di hero), `headline`, foto, bio (`about`), data diri, angka statistik, teks tombol, `cvUrl`, `socials` |
| `site/skills` | `items`: skill (`name`, `percent`, `icon`) — satu obelisk 3D per skill |
| `site/traits` | `items`: soft skill (`title`, `desc`) di "What I bring to the party" |
| `site/music` | Opsional. `tracks`: URL MP3 per pulau — `shrine`, `camp`, `training`, `guild`, `vault`, `road`, `beacon`, `oracle` (atau `all` untuk satu lagu). Pulau tanpa MP3 memakai musik generatif bawaan |
| `site/tools` | Opsional. Kalau dibuat (`items`: `name`, `icon`), bagian "Also in the toolkit" muncul |
| `projects` | Kartu + detail quest. `order` = urutan. `category` baru otomatis jadi tombol filter. Opsional: `story`, `highlights`, `extraInfo`, `links`, `competencies`, `campaigns` |
| `certifications` | Ring sertifikat. `order`, `title`, `issuer`, `date`, `image` |
| `resume` | Timeline. `section`: `summary` · `work` · `education` · `achievement` · `leadership`. Field: `period`, `title`, `place`, `badge`, `description`, `highlights`, `tags`, `order` |

Path gambar boleh relatif ke root repo (`assets/media/...`) atau URL lengkap.

## Setup sekali (±10 menit)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Analytics boleh dimatikan).
2. **Build → Firestore Database → Create database** → pilih lokasi `asia-southeast2` (Jakarta) → *production mode*.
3. Tab **Rules** → tempel isi `firebase/firestore.rules` → **Publish** (publik hanya bisa baca).
4. **Project settings → General → Your apps → Web (`</>`)** → daftarkan app → salin `projectId` dan `apiKey` ke `js/config.js`.
5. **Project settings → Service accounts → Generate new private key** → simpan file JSON-nya (JANGAN di-commit).
6. Import data awal:
   ```
   cd v2/firebase
   npm install
   node seed.mjs "C:\path\ke\service-account.json"
   ```
   Aman dijalankan ulang: dokumen yang sudah ada tidak ditimpa (kecuali pakai `--overwrite`).

`firebase/seed-data.json` hanya dipakai untuk import awal ini — situs tidak membacanya.

## Kecepatan

- 4 request kecil paralel ke Firestore REST, tanpa Firebase SDK
- Respons terakhir di-cache di browser: kunjungan berikutnya tampil instan, data diperbarui di background
- Gambar sudah dikompres (20 MB → 4 MB) dan pakai `loading="lazy"`
- Scene 3D dimuat setelah konten tampil, otomatis turun ke detail rendah di perangkat lambat

## File

- `index.html` — struktur halaman + ikon SVG
- `css/fantasy.css` — semua style
- `js/config.js` — ID project Firebase
- `js/data.js` — ambil & rapikan data Firestore
- `js/app.js` — render, scroll, menu, detail quest, lightbox
- `js/world.js` — dunia 3D
- `firebase/` — rules + script import data awal
