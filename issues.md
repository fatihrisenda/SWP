# ISSUES — Migrasi StudyWork Planner: Android WebView APK → Web App / PWA

> **Penulis:** Senior Developer  **Untuk:** Developer magang (junior)
> **Dokumen acuan wajib dibaca:** `SPESIFIKASI KEBUTUHAN PERANGKAT LUNAK-StudyWorkPlanner.pdf` (SKPL-001-SWP-2025) dan kode lama di `app/src/main/assets/www/` (`app.js`, `app.css`, `index.html`).
> **Status dokumen:** Rencana kerja. **Belum ada kode baru yang dikerjakan.** Kerjakan **berurutan sesuai nomor issue dan kolom `Depends`**. Jangan loncat.

---

## DAFTAR ISI

0. [Cara membaca dokumen & aturan kerja](#0-cara-membaca-dokumen--aturan-kerja)
1. [Kondisi aplikasi saat ini (hasil telaah)](#1-kondisi-aplikasi-saat-ini-hasil-telaah)
2. [Keputusan teknologi + argumentasi](#2-keputusan-teknologi--argumentasi)
3. [Arsitektur target](#3-arsitektur-target)
4. [Keputusan atas ambiguitas / kontradiksi SKPL (D-xx)](#4-keputusan-atas-ambiguitas--kontradiksi-skpl-d-xx)
5. [Model data](#5-model-data)
6. [Kontrak API](#6-kontrak-api)
7. [DAFTAR ISSUE (001–072)](#7-daftar-issue)
8. [Matriks keterlacakan FR / NFR / UI → Issue](#8-matriks-keterlacakan)
9. [Checklist keamanan (wajib centang sebelum rilis)](#9-checklist-keamanan)
10. [Checklist tampilan / UX / aksesibilitas](#10-checklist-tampilan--ux--aksesibilitas)
11. [Checklist PWA (bisa di-install)](#11-checklist-pwa)
12. [Rencana pengujian & UAT](#12-rencana-pengujian--uat)
13. [Di luar lingkup (backlog) & pertanyaan terbuka untuk Product Owner](#13-di-luar-lingkup--pertanyaan-terbuka)
14. [Final review sebelum go-live](#14-final-review-sebelum-go-live)

---

## 0. Cara membaca dokumen & aturan kerja

### 0.1 Legenda
| Label | Arti |
|---|---|
| **P0** | Wajib, memblokir rilis. |
| **P1** | Wajib untuk rilis 1.0, tapi tidak memblokir issue lain. |
| **P2** | Sebaiknya ada (peningkatan / di luar SKPL). Kerjakan jika P0 & P1 selesai. |
| **S / M / L** | Estimasi: S < ½ hari, M ½–1½ hari, L 2–4 hari (untuk junior, sudah termasuk belajar & test). |
| **Depends** | Issue yang HARUS selesai (merged) sebelum issue ini dimulai. |
| **FR/NFR/UI** | Kode kebutuhan dari SKPL yang dipenuhi issue tersebut. |

### 0.2 Alur kerja per issue (wajib)
1. Ambil 1 issue → buat branch `feat/NNN-judul-singkat` (atau `fix/…`, `chore/…`).
2. Baca bagian **Konteks**, **Langkah**, **Acceptance Criteria (AC)**. Kalau ada yang tidak jelas → **tanya dulu**, jangan menebak.
3. Tulis **test dulu / bersamaan** dengan kode (bukan belakangan).
4. Jalankan `npm run verify` (lint + typecheck + test + build) sampai hijau.
5. Buka Pull Request kecil (1 issue = 1 PR). Isi template PR (lampirkan screenshot 360 px & 1280 px untuk perubahan UI).
6. Centang AC satu per satu di deskripsi PR. Senior melakukan review. **Jangan merge sendiri.**

### 0.3 Aturan commit (ikuti persis)
- Subjek ≤ 50 karakter, **kapital di awal**, **imperatif** (`Add login endpoint`, bukan `Added…`), **tanpa titik** di akhir.
- Body hanya jika benar-benar perlu, dibungkus 72 kolom, jangan mengulang subjek.
- Satu commit = satu perubahan logis. Jangan commit file hasil build, `.env`, atau kunci.

### 0.4 Definition of Done (berlaku untuk SEMUA issue)
- [ ] `npm run verify` hijau (lint, typecheck, unit/integration test, build).
- [ ] Tidak ada `any` baru, tidak ada `// @ts-ignore`/`eslint-disable` tanpa komentar alasan.
- [ ] Semua teks UI lewat i18n (`t('…')`), **tidak ada string hard-coded** di komponen.
- [ ] Semua input dari luar divalidasi Zod di server (jangan percaya validasi front-end).
- [ ] Tidak ada secret / password / token di kode, log, atau commit.
- [ ] UI dicek di lebar 360 px, 768 px, 1280 px; keyboard-only bisa dipakai; tidak ada error di console.
- [ ] Test baru untuk logika baru (lihat target cakupan di Issue 061).
- [ ] Dokumentasi ikut diperbarui jika kontrak API / env / perintah berubah.

### 0.5 DILARANG KERAS (akan ditolak saat review)
| Dilarang | Kenapa / gantinya |
|---|---|
| Menyimpan token/sesi/password di `localStorage`/`sessionStorage` | Rentan dicuri XSS. Pakai cookie `HttpOnly`. |
| `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` | XSS. React sudah meng-escape otomatis. |
| Menggabung string untuk SQL (`` `... ${x}` ``) | SQL injection. Pakai Prisma / parameter. |
| Meng-hash password di browser lalu mengirim hash | Hash menjadi "password baru"; tidak menambah keamanan. Kirim lewat HTTPS, hash di **server** (D-02). |
| Kredensial default (`admin123`, `studywork123`) di kode/README/seed | Admin pertama dibuat dari env var (Issue 008). |
| `cors({ origin: '*' })` atau `credentials: true` + origin dinamis tanpa whitelist | Pakai satu origin (reverse proxy) — tidak perlu CORS di produksi. |
| `alert()`, `confirm()`, `prompt()` | Pakai komponen Dialog (Issue 040) — aksesibel dan bisa ditest. |
| `<meta viewport … maximum-scale=1 / user-scalable=no>` | Melanggar aksesibilitas (kode lama melakukannya — **jangan disalin**). |
| `setTimeout`/`setInterval` di browser sebagai "scheduler reminder" | Reminder harus dijalankan **server** + Web Push (Issue 029–032). |
| Query tanpa filter `userId` untuk data milik mahasiswa | IDOR / kebocoran data antar user (Issue 013). |
| Menyalin mentah `app.js` lama ke proyek baru | Logika lama boleh **dipelajari dan di-port** dengan rapi (TypeScript, pure function, test), bukan disalin. |
| Menaikkan versi dependency mayor / menambah dependency baru tanpa izin senior | Jaga lingkup, ukuran bundle, dan kompatibilitas browser (D-16). |

---

## 1. Kondisi aplikasi saat ini (hasil telaah)

### 1.1 Isi repositori sekarang
```
swp/
├─ README.md                    ← mendokumentasikan APK; berisi akun demo & password keystore (TIDAK BOLEH dibawa ke versi baru)
├─ build.sh                     ← build APK tanpa Gradle; password keystore ditulis telanjang
├─ keystore/studywork-release.jks   ← kunci penandatangan APK (rahasia!)
├─ StudyWorkPlanner.apk.idsig   ← artefak build
├─ tools/ (proguard.pro, zipalign.py)
├─ app/src/main/
│   ├─ AndroidManifest.xml      ← minSdk 26, targetSdk 34, allowBackup=true, orientation dikunci portrait
│   ├─ java/.../MainActivity.java       ← WebView + JS bridge (AndroidBridge)
│   ├─ java/.../ReminderScheduler.java  ← AlarmManager + notifikasi native (FR-05)
│   ├─ java/.../ReminderReceiver.java, BootReceiver.java
│   ├─ res/…                    ← ikon adaptif, tema, string
│   └─ assets/www/              ← **UI & seluruh logika bisnis (1.474 baris JS) — INI yang harus di-port**
│        ├─ index.html, app.css (250 baris), app.js, bcrypt.min.js
└─ SPESIFIKASI KEBUTUHAN PERANGKAT LUNAK-StudyWorkPlanner.pdf
```

### 1.2 Cara kerja aplikasi lama
- **Seluruh database ada di `localStorage` perangkat** (`swp_db_v1`): `users`, `categories`, `tasks`, `moods`, `sessions`. Tidak ada server. Tidak ada sinkronisasi antar perangkat.
- Auth dilakukan di browser (bcrypt.js client-side, cost 8), token sesi disimpan di `localStorage`/`sessionStorage`.
- Router berbasis hash (`#/dashboard`), render dengan `innerHTML` + template string, state global satu objek `ui`.
- Reminder = **native Android** (`AlarmManager` lewat `window.AndroidBridge`). Di web murni, bridge ini **tidak ada** → harus diganti Web Push (server-side).
- Logika inti (sudah benar & teruji secara fungsional, perlu di-port ke TypeScript): `priority()`, `urgency()`, `checkConflicts()`, `suggestSlot()`, `recommend()`, `reminderAt()`, `analytics()`.
- Bahasa: Indonesia (default) + Inggris (`EN` dictionary). Kunci terjemahan = teks Indonesia (rapuh) → di versi baru pakai key semantik.

### 1.3 Temuan masalah (harus DIPERBAIKI, bukan dibawa ke versi baru)

| # | Temuan di kode lama | Risiko | Diselesaikan di |
|---|---|---|---|
| T-01 | **Seluruh data semua user (termasuk hash password semua user & admin) disimpan di `localStorage`** satu browser. | Kebocoran data total; bypass auth lewat DevTools. | Issue 007, 010–013 (server + DB) |
| T-02 | Akun SuperAdmin default `admin@studywork.id / admin123` dibuat otomatis (`ensureSeed`) dan dicetak di halaman login + README. | Takeover admin di produksi. | Issue 008, 041 |
| T-03 | Token sesi di `localStorage` (`swp_token`), tanpa httpOnly. | Dicuri via XSS. | Issue 011–012 |
| T-04 | bcrypt di browser (`dcodeIO.bcrypt`, cost 8). | Hash tidak melindungi apa pun di sisi klien; cost rendah. | Issue 010 (Argon2id server) |
| T-05 | Password minimal **6** karakter; SKPL UISW02 menyebut **8** di satu tempat. | Password lemah. | D-01, Issue 010 |
| T-06 | Warna kategori disisipkan ke atribut `style=""` hanya dengan `esc()`; tidak ada validasi format warna. | Injeksi CSS/atribut. | Issue 021 (regex `#RRGGBB`) |
| T-07 | `maximum-scale=1` pada `<meta viewport>`. | Pengguna tidak bisa zoom (aksesibilitas). | Issue 052 |
| T-08 | `allowBackup="true"`, `setAllowFileAccess(true)`, JS bridge ke WebView. | Data bisa di-backup/diekstrak; permukaan serangan WebView. | Hilang bersama APK (Issue 072) |
| T-09 | Password keystore (`studywork123`) ditulis di `build.sh` & README; keystore ada di folder proyek. | Kunci rilis bocor. | Issue 001, 072 |
| T-10 | Tidak ada pemisahan data antar user selain filter `userId` di JS klien. | IDOR trivial. | Issue 013, 058 |
| T-11 | `capacity()` merujuk `me.capacity` yang tidak pernah diisi (selalu fallback 8). | Fitur "kapasitas harian" tidak bisa diatur. | D-12, Issue 007, 050 |
| T-12 | Mood disimpan setiap klik (spam entri). | Data mood kotor. | Issue 026 (dedupe) |
| T-13 | Hitung waktu memakai zona waktu perangkat; routine "19:00" tidak punya zona. Di server (reminder) ini akan salah. | Reminder jam salah. | D-20, Issue 016 |
| T-14 | Hash ID reminder (`numId`) bisa bertabrakan. | Reminder tertimpa. | Hilang (reminder punya UUID di DB) |
| T-15 | Status "Selesai" pada tugas Routine membatalkan reminder selamanya (ambigu). | Perilaku membingungkan. | D-11, Pertanyaan P-03 |
| T-16 | Dashboard "4 tugas terdekat" menyembunyikan tugas yang terlambat > 1 jam. | Tugas paling mendesak justru hilang. | D-29 |

### 1.4 Yang SUDAH baik dan harus dipertahankan perilakunya
- Rumus prioritas & ambang label (TOP ≥ 36, HIGH ≥ 24, MEDIUM ≥ 12, LOW < 12), urgency di-*clamp* 1–10.
- Dialog konflik dengan 4 opsi (jadwal saran, atur ulang, hapus tugas prioritas rendah, tetap simpan).
- Draf form tugas otomatis tersimpan (NFR-03.2).
- Tri-state status (belum → sedang → selesai → belum).
- Empty state yang ramah + tombol data contoh.
- Desain token warna di `app.css` (`--primary:#2563EB`, `--primary-d:#1D4ED8`, dsb.) → dipakai ulang di Tailwind config (Issue 035).

---

## 2. Keputusan teknologi + argumentasi

> Prinsip: **ikuti SKPL** (React 18+, Tailwind 3+, Lucide, Node + Express, PostgreSQL/MySQL, JWT, bcrypt/argon2, REST+JSON) kecuali ada alasan keamanan/teknis yang kuat — dan alasan itu ditulis di sini.

### 2.1 Ringkasan stack

| Lapisan | Pilihan | Catatan versi |
|---|---|---|
| Bahasa | **TypeScript (strict)** di seluruh kode | TS 5.x |
| Frontend | **React 18 + Vite**, **Tailwind CSS 3.4** (⚠ bukan v4), **Lucide React** | SKPL 4.3.3 |
| Routing / data | React Router (data router, mode browser-history), **TanStack Query**, React Hook Form + Zod | |
| UI primitif | Radix UI (Dialog, DropdownMenu, Toast) — headless, tanpa menyuntik `<style>` (kompatibel CSP ketat) | aksesibel (fokus, ARIA) |
| Tanggal/zona waktu | **Luxon** | IANA timezone |
| i18n | **i18next + react-i18next** | id (default), en |
| PWA | **vite-plugin-pwa** (Workbox, strategi `injectManifest`), Web App Manifest | |
| Backend | **Node.js LTS (≥ 22) + Express 5 + TypeScript** | SKPL minta Node 16+; Node 16 sudah EOL → dilarang |
| Validasi | **Zod** (skema dipakai bersama FE & BE) | |
| ORM / migrasi | **Prisma** + SQL migrasi manual untuk constraint khusus | |
| **DBMS** | **PostgreSQL 16+** | lihat 2.3 |
| Auth | **Argon2id** (`argon2`) + **JWT (`jose`) di cookie HttpOnly** + tabel `sessions` | lihat 2.4 |
| Push | **Web Push (VAPID)** lewat `web-push` | tanpa Firebase |
| Keamanan HTTP | `helmet`, `express-rate-limit`, CSP ketat, cek `Origin` | |
| Log | `pino` (JSON) | |
| Test | **Vitest**, Testing Library, **Supertest**, **Playwright**, `axe-core`, Lighthouse CI | |
| Deploy | **Docker Compose** + **Caddy** (HTTPS otomatis) di VPS Ubuntu 22.04/24.04 LTS | SKPL 2.4/4.2: Linux, 2 vCPU/4 GB |
| CI | GitHub Actions | |

### 2.2 Kenapa TypeScript (dan bukan bahasa lain)?
1. **SKPL sudah menetapkan ekosistem JavaScript** (React, Node.js, Express). Mengganti ke PHP/Laravel, Python/Django/FastAPI, Go, atau Java menyalahi dokumen yang disetujui.
2. **Satu bahasa di FE dan BE → kode domain dipakai bersama.** Rumus prioritas, deteksi konflik, dan rekomendasi (SKPL 4.5.2) dipakai di **dua tempat**: server (sumber kebenaran, reminder, rekomendasi) dan browser (preview prioritas live di form UISW09). Dengan paket `packages/shared` kita menulisnya **sekali**, menghilangkan risiko dua implementasi berbeda hasil.
3. **Logika lama sudah JavaScript** → porting ke TypeScript hampir 1:1, risiko regresi rendah.
4. **Bug waktu/prioritas paling sering muncul karena tipe longgar** (ms vs jam, string vs number, `null`). TypeScript strict + Zod menangkapnya saat compile.
5. Junior mendapat autocomplete & refactor aman; satu toolchain (npm) untuk semuanya.

**Ditolak:** Next.js/SSR (aplikasi di balik login, tidak butuh SEO; SKPL minta API Express terpisah); Flutter/React Native (pengguna minta web-based); Firebase/Supabase penuh (mengunci vendor, SKPL minta API sendiri + password hashing Argon2/bcrypt di server kita).

### 2.3 Kenapa PostgreSQL (bukan MySQL / NoSQL / SQLite)?
SKPL 4.3.3 mengizinkan **PostgreSQL atau MySQL** (4.2 menyebut MySQL sebagai contoh spesifikasi server). Kita pilih **PostgreSQL 16+** karena kebutuhan proyek ini:

| Kebutuhan proyek | Keunggulan PostgreSQL |
|---|---|
| Waktu adalah inti aplikasi (deadline, reminder, zona waktu) | Tipe **`timestamptz`** native — disimpan UTC, konversi aman. MySQL `DATETIME` tidak sadar zona; `TIMESTAMP` terbatas sampai 2038. |
| Aturan data per tipe tugas (Fixed-time/Deadline/Routine) | **CHECK constraint** kaya + **partial unique index** (mis. "hanya 1 reminder PENDING per tugas") + **unique index fungsional** `lower(name)`. Integritas dijaga DB, bukan hanya kode. |
| Hari rutin (Senin–Minggu) | Tipe **array** (`smallint[]`) — tidak perlu tabel pivot. |
| Scheduler reminder tanpa infrastruktur tambahan | `SELECT … FOR UPDATE SKIP LOCKED` untuk antrean di tabel → **tidak butuh Redis/RabbitMQ**. |
| Migrasi aman (NFR-07.1: update tanpa menghapus data) | **DDL transaksional**: migrasi gagal = otomatis rollback. Di MySQL DDL melakukan implicit commit → migrasi gagal bisa meninggalkan skema setengah jadi. |
| Reliabilitas & backup (NFR-03: data tidak boleh hilang) | `pg_dump`, WAL/PITR, replikasi bawaan; banyak penyedia terkelola (Neon, Supabase, RDS, Railway, dsb.) kalau nanti pindah ke cloud (SKPL 2.6). |
| Konsistensi | Perilaku standar SQL yang ketat (tidak diam-diam memotong data seperti mode longgar MySQL lama). |

**Ditolak:**
- **MySQL**: tetap valid & diizinkan SKPL, tapi kelemahan di atas (timestamptz, partial index, DDL transaksional) bernilai nyata bagi proyek ini. Kalau tim memaksa MySQL, issue 007 & 029 harus dirombak (tidak ada partial index → logika "1 reminder aktif" pindah ke kode).
- **MongoDB**: data kita sangat relasional (user → kategori → tugas → reminder) dengan foreign key & agregasi; tidak ada alasan memakai dokumen.
- **SQLite**: tidak cocok untuk server multi-user & backup online; hanya boleh untuk eksperimen lokal (tidak dipakai di proyek ini).
- **Redis**: tidak dipakai di fase 1 (sesi di PostgreSQL, rate-limit di memori untuk 1 instance). Tambahkan hanya jika nanti scale-out.

### 2.4 Kenapa Argon2id + JWT di cookie HttpOnly + tabel sesi?
- **SKPL 3.1 FR-09.3 / NFR-04.1** mengizinkan bcrypt **atau** argon2. Kita pilih **Argon2id** (rekomendasi pertama OWASP; tahan GPU/ASIC). Parameter minimal OWASP: `m=19456 KiB, t=2, p=1`.
- **SKPL 4.4** menyebut token JWT "dikirim melalui HTTP Header". Cookie `Cookie:` **adalah** HTTP header. Kita menaruh JWT di cookie **`HttpOnly; Secure; SameSite=Lax`** — JavaScript tidak bisa membacanya, sehingga XSS tidak bisa mencuri sesi (inilah kelemahan terbesar kode lama T-03). Menyimpan JWT di `localStorage` + header `Authorization` memang umum tetapi lebih rentan.
- JWT **stateful**: payload berisi `sid` (ID sesi); server tetap memeriksa tabel `sessions` pada tiap request. Hasilnya: bisa **logout sungguhan** (FR-09.9), bisa **revoke** saat ganti password/ubah role/hapus user, dan cocok dengan entitas **Session** di Class Diagram SKPL (`sessionId, userId, token, expireAt`).
- Konsekuensi: butuh perlindungan CSRF → `SameSite=Lax` + verifikasi header `Origin` + hanya menerima `application/json` (Issue 009).

### 2.5 Kenapa Web Push (VAPID), bukan Firebase Cloud Messaging?
- SKPL 2.4 menyebut FCM sebagai **opsional**. Web Push standar (VAPID) didukung Chrome, Edge, Firefox, dan Safari 16.4+ (iOS hanya untuk web app yang sudah di-install ke Home Screen).
- Tanpa akun/SDK Firebase → satu dependency & satu vendor lebih sedikit, tidak ada data pengguna keluar ke pihak ketiga selain layanan push browser.
- Library `web-push` (server) + Push API di Service Worker (client) cukup.

### 2.6 Kenapa Tailwind **3.4** dan bukan Tailwind 4?
SKPL: *"Tailwind CSS 3+"* dan browser minimum Chrome/Edge 90, Firefox 88. Tailwind 4 mensyaratkan browser jauh lebih baru (Chrome ≥ 111, Safari ≥ 16.4, Firefox ≥ 128) sehingga akan **memecahkan** persyaratan NFR-05.2. **Kunci versi di `^3.4`.**

### 2.7 Kenapa PWA (dan bukan WebView/Capacitor/Flutter)?
Permintaan: "bisa diakses di browser desktop & mobile, **bisa di-install** menjadi aplikasi tapi basisnya tetap web". Itu definisi **Progressive Web App**: satu codebase, satu deploy, update langsung tanpa toko aplikasi, bisa di-install dari Chrome/Edge/Safari/Samsung Internet. Kebutuhan native lama (AlarmManager) digantikan Web Push + Service Worker. Jika kelak butuh masuk Play Store → bisa dibungkus **TWA/Bubblewrap** tanpa mengubah web app (di luar lingkup sekarang, Bagian 13).

### 2.8 Kenapa Docker Compose + Caddy di VPS?
- SKPL 2.4/4.2: server Linux (Ubuntu), 2 vCPU / 4 GB RAM / SSD. (Catatan: **Ubuntu 20.04 sudah melewati akhir standard support** — pakai 22.04/24.04 LTS; "20.04+" di SKPL terpenuhi.)
- **Satu origin** (`https://domain` menyajikan file statis web + proxy `/api` ke Express) → tidak perlu CORS, cookie `SameSite` sederhana, CSP mudah.
- Caddy mengurus sertifikat HTTPS Let's Encrypt otomatis (NFR-04.2) + header keamanan.
- Developer memakai Windows + Docker Desktop → PostgreSQL dev via Docker, perilaku sama dengan produksi.

---

## 3. Arsitektur target

```mermaid
flowchart TD
    subgraph Client["Perangkat Pengguna (Browser / PWA terpasang)"]
        UI["React SPA (Vite build)"]
        SW["Service Worker - precache shell, push, notificationclick"]
    end
    subgraph Server["VPS (Docker Compose)"]
        CADDY["Caddy - HTTPS, header keamanan, static files"]
        API["API Express 5 - REST /api/v1"]
        WORKER["Worker reminder - poll tabel reminders"]
        DB[("PostgreSQL 16")]
    end
    PUSH["Layanan Push browser - (FCM/Mozilla/APNs via Web Push)"]

    UI -->|"fetch JSON + cookie HttpOnly"| CADDY
    CADDY -->|"/api/*"| API
    CADDY -->|"/*"| UI
    API --> DB
    WORKER --> DB
    WORKER -->|"Web Push VAPID"| PUSH
    PUSH --> SW
    SW -->|"showNotification"| UI
```

### 3.1 Struktur folder target (monorepo npm workspaces)
```
swp/
├─ apps/
│  ├─ api/                      # Express 5 + Prisma
│  │  ├─ prisma/ (schema.prisma, migrations/, seed.ts)
│  │  └─ src/
│  │     ├─ config/ (env.ts)           ├─ middleware/ (auth, rbac, security, error, rateLimit)
│  │     ├─ modules/ auth/ users/ categories/ tasks/ moods/ recommendations/
│  │     │            dashboard/ reminders/ push/ admin/        # tiap modul: routes.ts, service.ts, repo.ts, *.test.ts
│  │     ├─ worker/ (index.ts)         ├─ lib/ (logger, argon, jwt, errors)
│  │     └─ app.ts, server.ts
│  └─ web/                      # Vite + React PWA
│     ├─ public/ (icons/, favicon, robots.txt)
│     └─ src/
│        ├─ app/ (router.tsx, providers.tsx)     ├─ components/ (ui/, layout/, tasks/, ...)
│        ├─ features/ auth/ dashboard/ tasks/ categories/ ai/ admin/ settings/
│        ├─ lib/ (api.ts, queryClient.ts, pwa/)   ├─ i18n/ (id.json, en.json)
│        └─ sw.ts (service worker custom), main.tsx
├─ packages/
│  └─ shared/                   # dipakai FE + BE
│     └─ src/ schemas/ (zod), domain/ (priority, conflict, recommend, reminder, time), constants.ts, types.ts
├─ legacy/android-app/          # arsip kode lama (Issue 002) — JANGAN dihapus sebelum UAT lulus
├─ docker/ (api.Dockerfile, web.Dockerfile, Caddyfile)
├─ docker-compose.yml, docker-compose.prod.yml
├─ .github/workflows/ci.yml, PULL_REQUEST_TEMPLATE.md
├─ docs/ (SKPL pdf, adr/, runbook.md, api.md)
├─ issues.md   .env.example   .gitignore   .nvmrc   package.json
```

### 3.2 Alur penting

**Login & sesi**
```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    participant D as PostgreSQL
    B->>A: POST /api/v1/auth/login (email, password, remember)
    A->>D: SELECT user WHERE email=lower(email)
    A->>A: argon2.verify (dummy verify bila user tidak ada)
    A->>D: INSERT session (id, userId, expiresAt)
    A-->>B: 200 user + Set-Cookie session=JWT(sid) HttpOnly Secure SameSite=Lax
    B->>A: GET /api/v1/auth/me (cookie otomatis)
    A->>D: cek sessions.id=sid belum revoked & belum expired
    A-->>B: 200 user
```

**Reminder**
```mermaid
sequenceDiagram
    participant U as Mahasiswa
    participant A as API
    participant D as PostgreSQL
    participant W as Worker
    participant P as Push Service
    participant S as Service Worker
    U->>A: POST /tasks (deadline)
    A->>D: INSERT task + INSERT reminder(PENDING, remindAt = deadline-24h)  (1 transaksi)
    loop tiap 30 detik
        W->>D: SELECT reminders PENDING dan sudah jatuh tempo FOR UPDATE SKIP LOCKED
        W->>P: Web Push (payload terenkripsi) ke tiap subscription user
        W->>D: UPDATE reminder SENT (routine: buat reminder berikutnya)
    end
    P->>S: push event
    S->>U: showNotification lalu klik membuka tugas terkait
```

---

## 4. Keputusan atas ambiguitas / kontradiksi SKPL (D-xx)

Saat menelaah SKPL ditemukan hal yang bertentangan atau tidak ditulis. **Berikut keputusan senior (final kecuali Product Owner menolak).** Setiap issue merujuk kode D-xx. Daftar pertanyaan yang perlu dikonfirmasi PO ada di Bagian 13.

| Kode | Masalah di SKPL / kode lama | Keputusan |
|---|---|---|
| **D-01** | Panjang password: FR-09.2, UC Register & placeholder login menulis **6**, UISW02 menulis **8**. | **Minimal 8, maksimal 128** karakter. Pesan: "Password minimal 8 karakter". Placeholder login mengikuti mockup: "Masukkan password". *(Keamanan > kelonggaran.)* |
| **D-02** | SKPL 4.4: "password tidak dikirim … plain text, melainkan di-hash". | Diartikan: password **dikirim lewat HTTPS (TLS)** lalu **di-hash Argon2id di server**. Hash di klien ditolak (tidak menambah keamanan). |
| **D-03** | SKPL 4.4: JWT di "HTTP Header". | JWT di **cookie HttpOnly** (header `Cookie`) + tabel `sessions`. Lihat 2.4. |
| **D-04** | Role: hanya **Mahasiswa** & **SuperAdmin**. Mockup UISW08 menunjukkan akun admin hanya punya menu **Admin Panel**. Kode lama memberi admin semua menu. | Hanya 2 role. **SuperAdmin hanya melihat Admin Panel** (+ Pengaturan, Keluar). Endpoint tugas/kategori/mood/rekomendasi → **403 untuk SuperAdmin**. SuperAdmin **tidak bisa membaca isi tugas/mood mahasiswa** (privasi). Setelah login → `/admin`. |
| **D-05** | Register publik. | Register publik **selalu** membuat role `MAHASISWA` (role tidak boleh dikirim klien — cegah mass-assignment). |
| **D-06** | 4.1.3 menyebut radio "Critical/High/Medium/Low" untuk kepentingan; UISW09 & UC memakai dropdown 1–5; rumus butuh angka. | Kepentingan & kesulitan = **angka 1–5** yang dipilih lewat **dropdown berlabel** (sesuai UISW09 & mockup: "3 - Sedang", "3 - Cukup Penting"). Kepentingan: 1 Tidak Penting … 5 Critical. Kesulitan: 1 Sangat Mudah … 5 Sangat Sulit. |
| **D-07** | FR-01.4 "checkbox selesai" (biner) vs UISW04/05 "klik 3 kali: belum → sedang → selesai → belum". | **Tri-state** (`TODO`, `IN_PROGRESS`, `DONE`) sesuai UISW04/05 & kode lama. |
| **D-08** | Definisi kartu analytics ambigu ("Total Tugas = jumlah tugas aktif" vs "keseluruhan"). | **Total Tugas** = semua tugas milik user (aktif+selesai). **Selesai** = status DONE. **Total Waktu** = jumlah durasi estimasi tugas **belum selesai**. **Prioritas Tinggi** = tugas belum selesai berlabel TOP atau HIGH. (Sama seperti kode lama.) Tampilan "x/y selesai" pada halaman daftar boleh dipakai sesuai mockup. |
| **D-09** | Kategori wajib di form (UISW09) tapi hapus kategori yang dipakai tidak didefinisikan. FR-07.4: "kategori **tidak terpakai** bisa dihapus". | Kategori **wajib** di tugas. Tipe kategori (Kuliah/Pribadi) menentukan tugas tampil di halaman Kuliah atau Pribadi. **Hapus kategori yang masih dipakai → ditolak (409)** dengan jumlah tugas; UI menawarkan "Pindahkan tugas ke kategori lain lalu hapus". Mengubah tipe kategori memindahkan tugas-tugasnya ke halaman lain (konfirmasi dulu). FK DB `ON DELETE RESTRICT`. Nama unik per user + tipe (case-insensitive). |
| **D-10** | Daftar kategori default tidak ditulis; mockup UISW07 menunjukkan contoh. | Saat register dibuat: **Kuliah** — Quiz, Assessment, Tugas Harian, Praktikum, Presentasi, UTS/UAS. **Pribadi** — Olahraga, Pekerjaan, Pribadi, Belanja, Sosial. (Warna dari palet.) |
| **D-11** | Aturan reminder tidak rinci ("1 hari sebelum deadline/jam mulai"). | **Deadline & Fixed-time:** 24 jam sebelum acara; jika sisa < 24 jam, 1 jam sebelum; jika sisa < 1 jam → tidak ada push (banner di dashboard menutupi). **Routine:** 30 menit sebelum **setiap** kemunculan; setelah terkirim, worker menjadwalkan kemunculan berikutnya. Maksimal **1 push per jadwal** (tidak ada spam — SKPL 2.5: *no dark patterns*). Status DONE / hapus → semua reminder dibatalkan (FR-05.3, 05.5). Ubah waktu → jadwal dihitung ulang (FR-05.4). |
| **D-12** | "Kapasitas harian" tidak didefinisikan. | Default **8 jam/hari**, disimpan per user (`daily_capacity_hours`), bisa diubah di Pengaturan (Issue 050). |
| **D-13** | "Mood < 2" (UC) vs "mood level 1" (FR-08.1). Setara: hanya level 1. | Level **1** → kartu self-care penuh. Level **2** → tip ringan (Pomodoro) seperti kode lama (tambahan kecil). Level ≥ 3 → tidak ada. Mood boleh diinput lebih dari sekali per hari; yang dipakai = **entri terbaru hari ini**. |
| **D-14** | Mockup memuat menu sidebar **"Timeline"**, tidak ada di FR/UC mana pun. | **Tidak dibuat** di rilis 1.0 (Pertanyaan P-01). Jangan menambah menu kosong. |
| **D-15** | SKPL 4.5.1 "Face Emotion Detection (opsional, TensorFlow.js)". SKPL 2.5: AI itu *optional enhancement*. | **Tidak dibuat** (privasi kamera, bobot model, risiko NFR-01.2). "AI" = **mesin rule-based** (FR-06.5). Arsitektur memakai antarmuka `RecommendationProvider` agar nanti bisa ditambah provider lain. |
| **D-16** | Browser: tabel 4.3.2 (Chrome/Edge ≥ 90, Firefox ≥ 88) vs NFR-05.2 ("versi 2 tahun terakhir"); iOS 12+ (4.3.1) tapi tidak menyebut Safari. | **Batas bawah build** = Chrome/Edge 90, Firefox 88. **Prioritas pengujian** = 2 tahun terakhir. Tambah **Safari iOS/iPadOS ≥ 16.4** & **Samsung Internet** sebagai target (wajib karena pengguna mobile 60%+ dan install ke Home Screen iOS). Pustaka harus **diverifikasi** jalan di batas bawah (Issue 064); bila tidak, polyfill/turunkan versi. |
| **D-17** | SKPL 2.5: tidak mendukung offline; tapi 2.6 menyarankan "local caching". | **Tidak ada penulisan offline.** PWA tetap bisa di-install dan membuka *shell* tanpa jaringan dengan banner "Anda sedang offline"; aksi simpan ditolak dengan pesan jelas dan draf form tidak hilang. Cache baca (opsional) = P2 (Issue 057). |
| **D-18** | iOS 12+ vs Web Push butuh iOS 16.4+ (hanya app yang di-install). | iOS < 16.4: aplikasi tetap bisa dipakai sebagai situs biasa **tanpa push**; fallback = banner "N tugas jatuh tempo ≤ 24 jam" di dashboard. Dokumentasikan di halaman Pengaturan. |
| **D-19** | SKPL 2.6: "user akan allow notification" & 2.5: no dark patterns. | Izin notifikasi **hanya diminta setelah klik tombol** "Aktifkan notifikasi" (bukan saat halaman dibuka). Jika ditolak, tampilkan cara mengaktifkan kembali; jangan menagih berulang. |
| **D-20** | Zona waktu tidak dibahas; routine "Senin 19:00" butuh zona. | Semua waktu disimpan **UTC (`timestamptz`)**. User punya `timezone` IANA (default `Asia/Jakarta`, otomatis dideteksi browser saat register, bisa diubah). Routine disimpan sebagai `hari + menit-sejak-tengah-malam` dan diekspansi di zona user (Luxon). Semua fungsi domain menerima `now` & `timezone` sebagai parameter (bisa dites deterministik). |
| **D-21** | Hapus user: "semua data terkait (tugas, mood, kategori)". | Cascade juga: reminder, sesi, langganan push. |
| **D-22** | Class diagram: `Tugas.priorityScore` tersimpan. Priority bergantung waktu sekarang. | **Dihitung saat dibaca** (server menyertakan `priority:{score,label,urgency}` pada respons). Tidak disimpan (angka cepat basi). Memenuhi FR-02.5/02.6 secara otomatis. |
| **D-23** | Email unik. | Disimpan **trim + lowercase**; indeks unik. Validasi format RFC-praktis (Zod `.email()`), maks 254. |
| **D-24** | "Maksimal 3 klik ke fitur mana pun" (2.5). | Divalidasi di tabel Issue 062 (E2E menghitung klik). |
| **D-25** | Bahasa: Indonesia default, Inggris opsional. | i18next; pilihan tersimpan di profil user (`locale`) dan `localStorage` (halaman publik). |
| **D-26** | Mockup login ada ikon mata (lihat/sembunyi password); teks: "Masuk ke akun Anda", placeholder "Masukkan password". | Ikuti mockup, termasuk toggle lihat/sembunyi password yang aksesibel. |
| **D-27** | SKPL tidak memberi ambang label. | Pakai ambang kode lama: **TOP ≥ 36, HIGH ≥ 24, MEDIUM ≥ 12, LOW < 12** (skor maks 60). Warna: TOP merah tua, HIGH merah, MEDIUM kuning, LOW hijau (SKPL 4.1.1: merah/kuning/hijau). Label teks selalu ditampilkan (jangan hanya warna). |
| **D-28** | Tugas Routine perlu durasi untuk konflik/beban; SKPL hanya "hari rutin + jam mulai". | Tambahan field **"Durasi per sesi"** (default 1 jam, min 0.25) — sama seperti kode lama. |
| **D-29** | "4 tugas deadline paling dekat" — apakah termasuk yang terlambat? | **Termasuk.** Urut menaik berdasarkan waktu acara: Fixed-time = mulai (yang sudah selesai berlangsung dikecualikan), Deadline = deadline (yang lewat tetap tampil dengan label "Terlambat" merah), Routine = kemunculan berikutnya. Hanya tugas belum DONE. |
| **D-30** | Filter "waktu" (Hari ini / Minggu ini / Bulan ini). | Tugas yang **waktu acaranya** berada dalam rentang [awal hari ini, akhir periode). Deadline yang sudah lewat tapi belum selesai ikut tampil di semua rentang. |
| **D-31** | Tanggal di masa lalu. | Diizinkan (mencatat tugas terlambat) dengan peringatan non-blokir di form. Hanya `end > start` dan `durasi ≥ 0.5 jam` (deadline) yang menjadi error. |
| **D-32** | Batas panjang field tidak ditulis (kecuali nama kategori 50). | Judul 1–100, deskripsi ≤ 1000, nama user 3–100, nama kategori 1–50. |
| **D-33** | Hapus tugas: Golden Rule "semua aksi dapat di-undo (hapus dikonfirmasi)". | Cukup **dialog konfirmasi** (wajib). *Undo toast* = P2 (tidak dikerjakan sekarang). |
| **D-34** | Dashboard desktop memakai sidebar kiri (mockup) dan 4 kartu sejajar; teks SKPL "Grid 2×2". | **Mobile: grid 2×2. Desktop (≥ 1024 px): 4 kolom sejajar + sidebar kiri tetap** (SKPL 4.1.1 "sidebar selalu di kiri"). |
| **D-35** | Form tugas: mockup = modal di desktop; kode lama = halaman penuh di mobile. | Satu komponen: **halaman penuh di < 768 px, modal di ≥ 768 px**, berbasis rute (`/tugas/baru`, `/tugas/:id/edit`) sehingga tombol Back berfungsi dan bisa di-deep-link. |
| **D-36** | Input tanggal: `datetime-local` tidak didukung Firefox desktop < 93 (batas bawah kita 88). | Komponen `DateTimeField` = **dua input** `type=date` + `type=time` yang digabung dalam kode. |

---

## 5. Model data

### 5.1 Diagram relasi
```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ CATEGORIES : owns
    USERS ||--o{ TASKS : owns
    USERS ||--o{ MOOD_ENTRIES : logs
    USERS ||--o{ PUSH_SUBSCRIPTIONS : registers
    USERS ||--o{ REMINDERS : receives
    CATEGORIES ||--o{ TASKS : classifies
    TASKS ||--o{ REMINDERS : schedules
    USERS ||--o{ AUDIT_LOGS : "acts / is target"
```

### 5.2 Skema Prisma (acuan — salin ke `apps/api/prisma/schema.prisma` pada Issue 007)
```prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role           { MAHASISWA SUPERADMIN }
enum CategoryType   { KULIAH PRIBADI }
enum TaskType       { FIXED_TIME DEADLINE ROUTINE }
enum TaskStatus     { TODO IN_PROGRESS DONE }
enum ReminderStatus { PENDING SENT CANCELLED FAILED EXPIRED }

model User {
  id                 String   @id @default(uuid()) @db.Uuid
  name               String   @db.VarChar(100)
  email              String   @unique @db.VarChar(254)      // selalu lowercase (D-23)
  passwordHash       String   @map("password_hash")
  role               Role     @default(MAHASISWA)
  timezone           String   @default("Asia/Jakarta") @db.VarChar(64)   // IANA (D-20)
  locale             String   @default("id") @db.VarChar(5)              // 'id' | 'en'
  dailyCapacityHours Decimal  @default(8) @map("daily_capacity_hours") @db.Decimal(4, 1)  // D-12
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  sessions      Session[]
  categories    Category[]
  tasks         Task[]
  moods         MoodEntry[]
  pushSubs      PushSubscription[]
  reminders     Reminder[]
  @@map("users")
}

model Session {                       // = entitas Session di class diagram SKPL
  id         String    @id @default(uuid()) @db.Uuid     // = "sid" di JWT
  userId     String    @map("user_id") @db.Uuid
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz(3)
  revokedAt  DateTime? @map("revoked_at") @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  lastSeenAt DateTime  @default(now()) @map("last_seen_at") @db.Timestamptz(3)
  userAgent  String?   @map("user_agent") @db.VarChar(255)
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}

model Category {
  id        String       @id @default(uuid()) @db.Uuid
  userId    String       @map("user_id") @db.Uuid
  name      String       @db.VarChar(50)
  color     String       @db.Char(7)                    // '#RRGGBB' (CHECK di migrasi)
  type      CategoryType
  createdAt DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks     Task[]
  @@index([userId, type])
  @@map("categories")
  // unique (user_id, type, lower(name)) → ditambahkan lewat SQL migrasi
}

model Task {
  id                  String     @id @default(uuid()) @db.Uuid
  userId              String     @map("user_id") @db.Uuid
  categoryId          String     @map("category_id") @db.Uuid
  title               String     @db.VarChar(100)
  description         String?    @db.VarChar(1000)
  type                TaskType
  status              TaskStatus @default(TODO)
  importance          Int        @db.SmallInt               // 1..5
  difficulty          Int        @db.SmallInt               // 1..5
  // FIXED_TIME
  startAt             DateTime?  @map("start_at")    @db.Timestamptz(3)
  endAt               DateTime?  @map("end_at")      @db.Timestamptz(3)
  // DEADLINE
  deadlineAt          DateTime?  @map("deadline_at") @db.Timestamptz(3)
  // DEADLINE & ROUTINE (menit, integer — hindari float)
  durationMinutes     Int?       @map("duration_minutes")
  // ROUTINE
  routineDays         Int[]      @map("routine_days") @db.SmallInt   // ISO: 1=Senin … 7=Minggu
  routineStartMinute  Int?       @map("routine_start_minute") @db.SmallInt  // 0..1439, jam lokal user
  doneAt              DateTime?  @map("done_at") @db.Timestamptz(3)
  createdAt           DateTime   @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt           DateTime   @updatedAt @map("updated_at") @db.Timestamptz(3)

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  category  Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)   // D-09
  reminders Reminder[]
  @@index([userId, status])
  @@index([userId, deadlineAt])
  @@index([userId, startAt])
  @@index([userId, categoryId])
  @@map("tasks")
}

model Reminder {
  id        String         @id @default(uuid()) @db.Uuid
  taskId    String         @map("task_id") @db.Uuid
  userId    String         @map("user_id") @db.Uuid
  remindAt  DateTime       @map("remind_at") @db.Timestamptz(3)
  eventAt   DateTime       @map("event_at")  @db.Timestamptz(3)   // waktu acara yang diingatkan
  status    ReminderStatus @default(PENDING)
  attempts  Int            @default(0)
  sentAt    DateTime?      @map("sent_at") @db.Timestamptz(3)
  lastError String?        @map("last_error") @db.VarChar(255)
  createdAt DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  task      Task           @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("reminders")
  // index parsial (status='PENDING') + unique parsial (task_id) WHERE PENDING → SQL migrasi
}

model PushSubscription {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @map("user_id") @db.Uuid
  endpoint      String    @unique
  p256dh        String
  auth          String
  userAgent     String?   @map("user_agent") @db.VarChar(255)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  lastSuccessAt DateTime? @map("last_success_at") @db.Timestamptz(3)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("push_subscriptions")
}

model MoodEntry {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  level     Int      @db.SmallInt          // 1..5 (CHECK)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt(sort: Desc)])
  @@map("mood_entries")
}

model AuditLog {                     // jejak aksi SuperAdmin (keamanan)
  id           String   @id @default(uuid()) @db.Uuid
  actorId      String?  @map("actor_id") @db.Uuid
  targetUserId String?  @map("target_user_id") @db.Uuid
  action       String   @db.VarChar(50)      // USER_CREATE | USER_UPDATE | USER_DELETE | LOGIN_FAIL …
  meta         Json?
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  @@index([createdAt])
  @@map("audit_logs")
}
```
> Catatan: `AuditLog` sengaja **tanpa foreign key** agar log tidak ikut hilang saat user dihapus.

### 5.3 SQL tambahan wajib di migrasi (Issue 007 — tulis manual di file `migration.sql`)
```sql
-- email harus lowercase
ALTER TABLE users ADD CONSTRAINT users_email_lower CHECK (email = lower(email));
ALTER TABLE users ADD CONSTRAINT users_role_locale CHECK (locale IN ('id','en'));
ALTER TABLE users ADD CONSTRAINT users_capacity CHECK (daily_capacity_hours BETWEEN 1 AND 24);

-- kategori: warna valid & nama unik per user+tipe (case-insensitive)
ALTER TABLE categories ADD CONSTRAINT categories_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
CREATE UNIQUE INDEX categories_user_type_name_uq ON categories (user_id, type, lower(name));

-- skala 1..5
ALTER TABLE tasks ADD CONSTRAINT tasks_scale CHECK (importance BETWEEN 1 AND 5 AND difficulty BETWEEN 1 AND 5);
ALTER TABLE mood_entries ADD CONSTRAINT mood_level CHECK (level BETWEEN 1 AND 5);

-- aturan per tipe tugas
ALTER TABLE tasks ADD CONSTRAINT tasks_by_type CHECK (
  (type = 'FIXED_TIME' AND start_at IS NOT NULL AND end_at IS NOT NULL AND end_at > start_at
       AND deadline_at IS NULL AND duration_minutes IS NULL AND cardinality(routine_days) = 0 AND routine_start_minute IS NULL)
  OR
  (type = 'DEADLINE' AND deadline_at IS NOT NULL AND duration_minutes >= 30
       AND start_at IS NULL AND end_at IS NULL AND cardinality(routine_days) = 0 AND routine_start_minute IS NULL)
  OR
  (type = 'ROUTINE' AND cardinality(routine_days) BETWEEN 1 AND 7 AND routine_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
       AND routine_start_minute BETWEEN 0 AND 1439 AND duration_minutes >= 15
       AND start_at IS NULL AND end_at IS NULL AND deadline_at IS NULL)
);

-- reminder: antrean efisien & hanya 1 PENDING per tugas
CREATE INDEX reminders_due_idx ON reminders (remind_at) WHERE status = 'PENDING';
CREATE UNIQUE INDEX reminders_one_pending_per_task ON reminders (task_id) WHERE status = 'PENDING';
```

---

## 6. Kontrak API

Semua endpoint di bawah prefix **`/api/v1`**. Format **JSON**. Waktu = **ISO 8601 UTC** (`2026-10-05T09:00:00.000Z`). ID = UUID.
Auth = cookie `HttpOnly` (kecuali endpoint publik). Semua `POST/PATCH/DELETE` wajib header `Content-Type: application/json` dan `Origin` yang valid.

### 6.1 Format error (seragam)
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Data tidak valid", "fields": { "email": "Format email tidak valid" } } }
```
| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod gagal (isi `fields`) |
| 401 | `UNAUTHENTICATED` | tidak ada / sesi kedaluwarsa / revoked |
| 401 | `INVALID_CREDENTIALS` | login gagal — pesan **selalu sama**: "Email atau password tidak valid" |
| 403 | `FORBIDDEN` | role tidak berhak / Origin salah |
| 404 | `NOT_FOUND` | juga dipakai bila resource milik user lain (jangan bocorkan keberadaan) |
| 409 | `EMAIL_TAKEN`, `CATEGORY_IN_USE`, `LAST_SUPERADMIN`, `NAME_TAKEN` | konflik |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | bukan JSON |
| 429 | `RATE_LIMITED` | terlalu banyak percobaan (+ header `Retry-After`) |
| 500 | `INTERNAL` | pesan generik; detail hanya di log |

### 6.2 Daftar endpoint
| Method & Path | Role | Keterangan | FR |
|---|---|---|---|
| `GET /healthz` · `GET /readyz` | publik | liveness / cek DB | NFR-06.1 |
| `POST /auth/register` | publik | `{name,email,password,confirmPassword,timezone?}` → 201 `{user}` + cookie | FR-09.1–09.3 |
| `POST /auth/login` | publik | `{email,password,remember}` → 200 `{user}` + cookie | FR-09.4–09.7 |
| `POST /auth/logout` | login | revoke sesi + hapus cookie → 204 | FR-09.8–09.9 |
| `GET /auth/me` | login | `{user}` — cek sesi aktif | FR-09.10–09.11 |
| `PATCH /me` | login | `{name?,locale?,timezone?,dailyCapacityHours?}` | D-12, D-25 |
| `GET /categories` | MHS | semua kategori milik user | FR-07.5 |
| `POST /categories` | MHS | `{name,color,type}` | FR-07.2 |
| `PATCH /categories/:id` | MHS | | FR-07.3 |
| `DELETE /categories/:id?reassignTo=<id>` | MHS | 409 bila dipakai & tanpa `reassignTo` | FR-07.4 |
| `GET /tasks` | MHS | query: `scope=kuliah\|pribadi`, `status=active\|done\|all`, `priority=TOP\|HIGH\|MEDIUM\|LOW`, `type`, `categoryId`, `time=today\|week\|month`, `q`, `sort=priority\|deadline\|newest`, `limit`(≤500), `offset` | FR-01.6, 02.3–02.4 |
| `POST /tasks` | MHS | body diskriminasi `type` (6.3) → 201 | FR-01.1, 01.2 |
| `GET /tasks/:id` | MHS | termasuk info reminder berikutnya | |
| `PATCH /tasks/:id` | MHS | edit | FR-01.3 |
| `PATCH /tasks/:id/status` | MHS | `{status}` | FR-01.4 |
| `DELETE /tasks/:id` | MHS | 204 | FR-01.5 |
| `POST /tasks/conflicts` | MHS | dry-run `{candidate, excludeTaskId?}` → `{collisions,buffers,overload,suggestedSlot,lowPriorityCandidate}` | FR-04.1–04.6 |
| `GET /tasks/analytics?scope=` | MHS | kartu analytics (per halaman) | FR-01.7 |
| `GET /dashboard` | MHS | `{analytics, nearest[4], dueWithin24h, mood}` — **satu panggilan** | FR-10.1–10.4 |
| `GET /moods/today` · `GET /moods?limit=7` · `POST /moods {level}` | MHS | | FR-03.1–03.3 |
| `GET /recommendations?mood=1..5` | MHS | `{energy, items[], postpone[], selfCare?, tip?}` | FR-06.1–06.5, 08.1 |
| `GET /push/public-key` | login | VAPID public key | FR-05.2 |
| `POST /push/subscriptions` · `DELETE /push/subscriptions` | login | simpan / hapus langganan perangkat ini | FR-05.2 |
| `POST /push/test` | login | kirim notifikasi uji ke perangkat user sendiri (rate-limit ketat) | QA |
| `POST /me/password` | login | *(P2, Issue 050)* `{currentPassword,newPassword}`; mencabut sesi lain | — |
| `GET /me/export` · `DELETE /me` | MHS | *(P2, Issue 060)* ekspor data / hapus akun sendiri | — |
| `POST /tasks/sample` | MHS | *(P2, Issue 051)* buat 8 tugas contoh bila user punya 0 tugas | — |
| `GET /admin/stats` · `GET /admin/users?limit&offset&q` | SUPERADMIN | | FR-11.1 |
| `POST /admin/users` · `PATCH /admin/users/:id` · `DELETE /admin/users/:id` | SUPERADMIN | | FR-11.2–11.4 |

### 6.3 Bentuk body tugas (Zod `discriminatedUnion('type')`)
```jsonc
// DEADLINE
{ "type":"DEADLINE", "title":"Laporan Praktikum Jarkom", "description":"", "categoryId":"…uuid",
  "importance":4, "difficulty":3, "deadlineAt":"2026-10-08T13:00:00.000Z", "durationHours":3 }
// FIXED_TIME
{ "type":"FIXED_TIME", "title":"Quiz Matdis", "categoryId":"…", "importance":4, "difficulty":4,
  "startAt":"2026-10-07T02:00:00.000Z", "endAt":"2026-10-07T03:30:00.000Z" }
// ROUTINE  (jam lokal user, hari ISO 1=Senin..7=Minggu)
{ "type":"ROUTINE", "title":"Review Strategi Algoritma", "categoryId":"…", "importance":3, "difficulty":2,
  "routineDays":[1,3,5], "routineStartTime":"19:30", "durationHours":1 }
```
Respons tugas selalu memuat: `id,title,description,type,status,category{id,name,color,type},importance,difficulty,<field waktu>,durationHours,nextEventAt,priority{score,label,urgency},reminderAt,createdAt,updatedAt`.

---
## 7. DAFTAR ISSUE

Ringkasan fase (urutan pengerjaan):

```mermaid
flowchart LR
    E0["E0 Persiapan - 001-005"] --> E1["E1 Fondasi backend - 006-009"]
    E1 --> E2["E2 Auth - 010-014"]
    E0 --> E3["E3 Domain shared - 015-020"]
    E2 --> E4["E4-E9 API fitur - 021-033"]
    E3 --> E4
    E0 --> E10["E10 Fondasi FE - 034-040"]
    E4 --> E11["E11 Halaman FE - 041-051"]
    E10 --> E11
    E11 --> E12["E12 PWA - 052-057"]
    E12 --> E13["E13 Security/Privacy - 058-060"]
    E13 --> E14["E14 QA - 061-065"]
    E14 --> E15["E15 DevOps - 066-071"]
    E15 --> E16["E16 Pensiun legacy - 072"]
```
> E3 (domain) dan E10 (fondasi FE) bisa dikerjakan paralel dengan E1–E2 oleh orang berbeda. FE halaman (E11) boleh mulai memakai API **mock** (MSW) sambil menunggu API selesai — tapi kontrak di Bagian 6 tidak boleh diubah sepihak.

---

# E0 — PERSIAPAN REPOSITORI & TOOLING

### ISSUE-001 — Inisialisasi Git, `.gitignore`, dan amankan rahasia lama
`P0 · S · Depends: —` · Menutup temuan T-09

**Konteks.** Folder proyek saat ini **bukan repositori git**. Di dalamnya ada `keystore/studywork-release.jks`, password keystore di `build.sh` dan `README.md`, serta `.apk.idsig`. Kita tidak boleh meng-commit semua itu ke repo mana pun.

**Langkah.**
1. Salin seluruh folder `swp` ke tempat backup **di luar** repo (mis. `D:\backup\swp-legacy-YYYYMMDD`) sebelum mengubah apa pun.
2. `git init -b main`.
3. Buat `.gitignore` berisi minimal: `node_modules/`, `dist/`, `build/`, `coverage/`, `playwright-report/`, `.env`, `.env.*` (kecuali `.env.example`), `*.jks`, `*.keystore`, `*.apk`, `*.aab`, `*.idsig`, `*.log`, `.DS_Store`, `Thumbs.db`, `.vscode/` (kecuali `extensions.json`), `pgdata/`, `*.pem`, `*.key`.
4. **Pindahkan `keystore/` ke luar repo** (simpan di password manager/penyimpanan terenkripsi). Jangan di-commit. Karena password-nya pernah tertulis di `build.sh`/README, anggap kunci itu **tidak rahasia lagi** (lihat Issue 072).
5. Buat commit pertama **hanya** berisi kode lama yang aman: `app/`, `tools/`, `build.sh`, PDF SKPL, `issues.md`. **Hapus baris password** dari `build.sh` & `README.md` sebelum commit (ganti dengan `# lihat secret manager`).
6. Pasang `gitleaks` (pre-commit hook, Issue 003) untuk mencegah rahasia ikut ter-commit.

**AC.**
- [ ] `git status` bersih; `git ls-files` tidak memuat `.jks`, `.apk`, `.idsig`, `.env`.
- [ ] `git log -p` tidak memuat string `studywork123` / `admin123` (cek dengan `git grep`).
- [ ] Backup folder asli ada di luar repo (bukti: tuliskan path di deskripsi PR, **tanpa** mengunggah isinya).

---

### ISSUE-002 — Arsipkan kode Android lama ke `legacy/`
`P0 · S · Depends: 001`

**Konteks.** Kode lama adalah **referensi perilaku** (rumus, teks, alur). Jangan dihapus sampai UAT lulus (Issue 072), tapi harus keluar dari jalur kerja.

**Langkah.**
1. `git mv app legacy/android-app/app`, `git mv tools legacy/android-app/tools`, `git mv build.sh legacy/android-app/build.sh`, `git mv README.md legacy/android-app/README.md`.
2. Pindahkan PDF SKPL ke `docs/SKPL-001-SWP-2025.pdf` (ganti nama tanpa spasi).
3. Buat `README.md` baru di root (kerangka saja dulu; diisi lengkap di Issue 071).
4. Tambahkan `legacy/android-app/README.md` bagian atas: "ARSIP — tidak dipakai lagi; hanya referensi."
5. Tambahkan folder `legacy/` ke ignore ESLint/Prettier/TypeScript supaya tidak ikut di-lint/build.

**AC.**
- [ ] Root hanya berisi folder target (Bagian 3.1) + `legacy/` + `docs/` + `issues.md`.
- [ ] `legacy/android-app/app/src/main/assets/www/app.js` masih bisa dibuka sebagai referensi.

---

### ISSUE-003 — Monorepo npm workspaces + tooling kualitas kode
`P0 · M · Depends: 002`

**Langkah.**
1. Pasang Node LTS (≥ 22) via nvm-windows; buat `.nvmrc` berisi versi major, dan `"engines": {"node": ">=22"}` di `package.json` root.
2. `package.json` root: `"private": true`, `"workspaces": ["apps/*","packages/*"]`.
3. Buat paket kosong: `apps/api`, `apps/web`, `packages/shared` (masing-masing `package.json`, `tsconfig.json` yang `extends` ke `tsconfig.base.json`).
4. `tsconfig.base.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"exactOptionalPropertyTypes": false`, `"target": "ES2022"`, `"moduleResolution": "Bundler"` (web) / `NodeNext` (api).
5. ESLint (flat config) + `typescript-eslint` (strict, type-checked) + `eslint-plugin-react-hooks` + `eslint-plugin-jsx-a11y` + `eslint-plugin-compat` (cek API browser vs target D-16) + `eslint-plugin-security` (api). Prettier + `.editorconfig` (LF, UTF-8, 2 spasi).
6. Husky + lint-staged: pre-commit menjalankan `eslint --fix`, `prettier --write` pada file yang berubah, dan **gitleaks**. `commit-msg` hook memeriksa subjek ≤ 50 karakter.
7. Script root: `lint`, `typecheck`, `test`, `build`, `verify` (= semuanya berurutan), `dev` (jalankan api + web paralel dengan `concurrently`).
8. Vitest dikonfigurasi di tiap paket; paket `shared` wajib punya test (Issue 020).
9. `PULL_REQUEST_TEMPLATE.md` dengan checklist DoD (Bagian 0.4) dan kolom "Screenshot 360 px / 1280 px".

**AC.**
- [ ] `npm ci && npm run verify` hijau di mesin bersih (tanpa error walau belum ada fitur).
- [ ] Commit dengan subjek > 50 karakter ditolak hook; commit yang berisi `AKIA…`/private key palsu ditolak gitleaks (uji dengan string dummy).
- [ ] `packages/shared` bisa di-import dari `apps/api` dan `apps/web` (`import { x } from '@swp/shared'`).

---

### ISSUE-004 — Docker Compose untuk PostgreSQL dev + `.env.example`
`P0 · S · Depends: 003`

**Langkah.**
1. `docker-compose.yml` (dev): service `db` = `postgres:16-alpine`, volume bernama `pgdata`, port **127.0.0.1:5432:5432** (bind ke localhost saja), env `POSTGRES_USER/PASSWORD/DB` dari `.env`, `healthcheck: pg_isready`. Buat DB kedua `swp_test` untuk test (skrip init).
2. `.env.example` (isi **nilai contoh/aman**, bukan rahasia asli):
```
NODE_ENV=development
PORT=3000
APP_ORIGIN=http://localhost:5173
TRUST_PROXY=0
DATABASE_URL=postgresql://swp:swp_dev_password@localhost:5432/swp?schema=public
JWT_SECRET=GANTI_DENGAN_HASIL_openssl_rand_-base64_48
SESSION_COOKIE_NAME=swp_session
SESSION_TTL_DEFAULT_HOURS=12
SESSION_TTL_REMEMBER_DAYS=30
ARGON2_MEMORY_KIB=19456
ARGON2_TIME_COST=2
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@contoh.id
REMINDER_POLL_SECONDS=30
RUN_WORKER=false
SEED_ADMIN_NAME=Super Admin
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
LOG_LEVEL=debug
```
3. Dokumentasikan cara membuat rahasia: `openssl rand -base64 48` (JWT) dan `npx web-push generate-vapid-keys` (VAPID).

**AC.**
- [ ] `docker compose up -d db` lalu `psql` bisa connect; port **tidak** terbuka ke jaringan LAN (cek dengan `netstat`).
- [ ] `.env` ada di `.gitignore`; hanya `.env.example` yang ter-commit.

---

### ISSUE-005 — CI GitHub Actions
`P1 · S · Depends: 003, 004`

**Langkah.** Workflow `ci.yml` pada tiap PR & push `main`:
1. Job `verify`: `actions/setup-node` (versi dari `.nvmrc`), cache npm, `npm ci`, `npm run lint`, `typecheck`, `test`, `build`. Service container `postgres:16` untuk test integrasi.
2. Job `security`: `npm audit --omit=dev --audit-level=high` (gagal bila ada high/critical), `gitleaks/gitleaks-action`, CodeQL (JavaScript/TypeScript).
3. Job `e2e` (setelah Issue 062 ada): Playwright smoke.
4. Aktifkan Dependabot (`.github/dependabot.yml`, mingguan, grup minor/patch).
5. Branch protection `main`: wajib CI hijau + 1 review; larang push langsung & force-push.

**AC.** PR contoh dengan test yang sengaja gagal → CI merah dan merge terblokir.

---

# E1 — FONDASI BACKEND

### ISSUE-006 — Scaffold API Express 5
`P0 · M · Depends: 003, 004`

**Langkah.**
1. Dependensi: `express@5`, `zod`, `pino`, `pino-http`, `dotenv` (atau `--env-file`), `cookie-parser`, `@swp/shared`; dev: `tsx`, `vitest`, `supertest`.
2. `src/config/env.ts`: parse `process.env` dengan Zod; **aplikasi crash saat start bila env salah** (mis. `JWT_SECRET` < 32 karakter, `APP_ORIGIN` bukan URL, `NODE_ENV=production` tapi `APP_ORIGIN` bukan `https://`). Ekspor objek `env` bertipe.
3. `src/app.ts` mengekspor `createApp()` (tanpa `listen`) agar mudah dites dengan Supertest; `server.ts` yang `listen` + graceful shutdown (`SIGTERM`: stop terima koneksi, tutup Prisma).
4. `lib/logger.ts` (pino) dengan **redaksi**: `req.headers.cookie`, `req.headers.authorization`, `*.password`, `*.passwordHash`, `*.token`.
5. `lib/errors.ts`: kelas `AppError(code, status, message, fields?)`; **error handler terpusat** yang mengubah `ZodError`, `AppError`, dan error tak dikenal ke format Bagian 6.1. Error tak dikenal → 500 pesan generik + log lengkap (tanpa bocorkan stack ke klien).
6. Route `GET /api/v1/healthz` (selalu 200) dan `/readyz` (cek `SELECT 1`).
7. Middleware `asyncHandler` **tidak perlu** (Express 5 menangkap promise rejection), tapi tetap tulis test untuk memastikan.
8. Semua route di bawah `/api/v1`; route tak dikenal → 404 JSON (bukan HTML).
9. Matikan header `X-Powered-By`.

**AC.**
- [ ] `npm run dev -w apps/api` hidup; `curl /api/v1/healthz` → `{"status":"ok"}`.
- [ ] Menjalankan dengan `JWT_SECRET=abc` → proses berhenti dengan pesan jelas.
- [ ] Test: route tidak ada → 404 JSON; error dilempar → 500 tanpa stack; log tidak memuat cookie.

---

### ISSUE-007 — Skema database Prisma + migrasi awal + constraint
`P0 · M · Depends: 004, 006` · FR-09, NFR-03, NFR-07.1

**Langkah.**
1. Salin skema Bagian 5.2 ke `apps/api/prisma/schema.prisma`.
2. `npx prisma migrate dev --name init --create-only`, lalu **tambahkan SQL Bagian 5.3** ke akhir file migrasi, baru jalankan `migrate dev`.
3. Buat `lib/prisma.ts` (singleton) + fungsi helper transaksi.
4. Test integrasi (Vitest + DB `swp_test`): coba insert yang **harus ditolak DB**: email huruf besar; `end_at <= start_at`; `importance=6`; warna `red`; dua kategori sama nama beda kapitalisasi; dua reminder PENDING untuk tugas yang sama; hapus kategori yang dipakai tugas.
5. Tulis `docs/adr/0001-database.md` (ringkas: kenapa PostgreSQL — salin poin 2.3).

**AC.**
- [ ] `npx prisma migrate reset` dari nol berhasil; `migrate deploy` idempoten.
- [ ] Semua test constraint di langkah 4 lulus (setiap pelanggaran menghasilkan error DB).
- [ ] Skema cocok dengan Class Diagram SKPL (User/Mahasiswa/SuperAdmin→`role`, Session, Tugas, Reminder, Kategori). Tuliskan pemetaan nama (`Tugas`→`Task`, dst.) di ADR.

---

### ISSUE-008 — Seed: SuperAdmin pertama dari env + data dev
`P0 · S · Depends: 007` · Menutup T-02

**Langkah.**
1. `prisma/seed.ts`: bila tidak ada user `SUPERADMIN`, buat dari `SEED_ADMIN_EMAIL/PASSWORD/NAME`. Jika env kosong: **di production → error & berhenti**; di development → cetak petunjuk (jangan membuat akun default).
2. Password seed lewat fungsi hash yang sama dengan register (Issue 010) dan lolos kebijakan password (≥ 8).
3. Skrip terpisah `seed:dev` untuk dev saja: 1 mahasiswa + kategori default + 8 tugas contoh (adaptasi `seedSample()` lama; tanggal relatif terhadap hari ini) + 1 user "perf" dengan 150 tugas (untuk NFR-01.3, Issue 063). Skrip ini **menolak jalan** bila `NODE_ENV=production`.
4. Seeding idempoten (aman dijalankan berulang).

**AC.**
- [ ] `grep -r "admin123"` di repo (di luar `legacy/`) → kosong.
- [ ] Menjalankan seed 2× tidak membuat admin ganda.
- [ ] `NODE_ENV=production` + env admin kosong → exit code ≠ 0.

---

### ISSUE-009 — Middleware keamanan baseline
`P0 · M · Depends: 006` · NFR-04, Bagian 9

**Langkah.** Pasang (urutan penting) di `createApp()`:
1. `app.set('trust proxy', env.TRUST_PROXY)` (produksi di belakang Caddy = `1`) supaya IP klien benar untuk rate-limit.
2. `helmet()` dengan konfigurasi: `contentSecurityPolicy` ketat untuk API (`default-src 'none'; frame-ancestors 'none'`), `hsts` aktif di production, `referrerPolicy: 'strict-origin-when-cross-origin'`, `crossOriginResourcePolicy: 'same-origin'`.
3. `express.json({ limit: '100kb', strict: true })` — body lebih besar → 413. **Tolak** body non-JSON pada method mutasi: middleware `requireJson` → 415.
4. **Cek Origin (anti-CSRF):** untuk method `POST/PUT/PATCH/DELETE`, bila header `Origin` ada dan ≠ `env.APP_ORIGIN` → 403. Bila `Origin` tidak ada, periksa `Sec-Fetch-Site`: nilai selain `same-origin`/`none` → 403.
5. `express-rate-limit`: global 300 req/menit/IP; header `RateLimit-*` standar; respons 429 mengikuti format error. (Limiter khusus auth di Issue 014.)
6. `cookie-parser` (tanpa secret; JWT sudah bertanda tangan).
7. Tanpa CORS di produksi. Di dev, Vite proxy `/api` → `localhost:3000` (Issue 034), jadi **tidak perlu CORS sama sekali**.
8. Header `Cache-Control: no-store` untuk semua respons `/api` yang terautentikasi.

**AC.** Test Supertest:
- [ ] `POST` dengan `Origin: https://evil.example` → 403.
- [ ] `POST` dengan `Content-Type: application/x-www-form-urlencoded` → 415.
- [ ] Body 200 KB → 413.
- [ ] Respons memuat `X-Content-Type-Options: nosniff`, tidak memuat `X-Powered-By`.
- [ ] 301 request cepat ke `/healthz` dari IP sama → request ke-301 mendapat 429.

---

# E2 — AUTENTIKASI (FR-09)

### ISSUE-010 — Register (UC #8)
`P0 · M · Depends: 007, 009` · FR-09.1, 09.2, 09.3, 09.6, 09.7 · UISW02 · D-01, D-02, D-05, D-10, D-20, D-23

**Langkah.**
1. Skema Zod bersama di `packages/shared/schemas/auth.ts`: `name` (trim, 3–100), `email` (trim → lowercase, format valid, ≤ 254), `password` (8–128), `confirmPassword` (harus sama; `.refine`), `timezone` opsional (harus valid IANA: cek `Intl.supportedValuesOf('timeZone')` atau coba `new Intl.DateTimeFormat(undefined,{timeZone})`). Skema `.strict()` — **kunci `role` dari klien harus ditolak/diabaikan**.
2. `lib/password.ts`: `hashPassword()` memakai `argon2.hash(pw, { type: argon2.argon2id, memoryCost: env.ARGON2_MEMORY_KIB, timeCost: env.ARGON2_TIME_COST, parallelism: 1 })`; `verifyPassword()`; `needsRehash()` untuk upgrade parameter di masa depan. Tolak password yang sama dengan email/nama (case-insensitive) dan (P2) ada di daftar 1000 password umum.
3. `POST /auth/register`: validasi → cek email unik (tangani juga *race*: tangkap error unique violation → 409 `EMAIL_TAKEN`, pesan "Email sudah terdaftar") → dalam **satu transaksi**: buat user `MAHASISWA`, buat 11 kategori default (D-10), buat sesi → set cookie (Issue 011/012 menyediakan helper `issueSession`) → 201 `{ user }` (tanpa `passwordHash`).
4. Respons user hanya berisi: `id,name,email,role,timezone,locale,dailyCapacityHours,createdAt`.
5. Rate-limit khusus (Issue 014): 5 register/jam/IP.

**AC.**
- [ ] Email `Budi@Mail.com` dan `budi@mail.com` dianggap sama (409 untuk yang kedua).
- [ ] Mengirim `{"role":"SUPERADMIN"}` tidak menghasilkan admin.
- [ ] Password < 8 → 400 dengan `fields.password`; konfirmasi tidak sama → `fields.confirmPassword`.
- [ ] Di DB, kolom `password_hash` berawalan `$argon2id$`; tidak ada plain text di log (cek log test).
- [ ] Setelah register: cookie ter-set, `GET /auth/me` → 200, kategori default ada 11.
- [ ] 2 request register bersamaan dengan email sama → tepat satu sukses.

---

### ISSUE-011 — Login + sesi (UC #9)
`P0 · L · Depends: 010` · FR-09.4–09.7, 09.10, 09.11 · UISW01 · D-03

**Langkah.**
1. `lib/jwt.ts` dengan `jose`: tanda tangan **HS256**, secret dari env, klaim `sub` (userId), `sid` (sessionId), `iat`, `exp`. Verifikasi wajib menetapkan `algorithms: ['HS256']` (cegah `alg=none`).
2. `issueSession(res, user, remember)`: buat baris `sessions` (expires = 30 hari jika `remember`, 12 jam jika tidak). Cookie:
   - nama: `env.SESSION_COOKIE_NAME` (produksi: `__Host-swp_session`),
   - `httpOnly: true`, `secure: NODE_ENV==='production'`, `sameSite: 'lax'`, `path: '/'`, **tanpa `domain`**,
   - jika `remember` → `maxAge` = 30 hari; jika tidak → **session cookie** (tanpa maxAge, hilang saat browser ditutup) *dan* kedaluwarsa absolut 12 jam di DB.
3. `POST /auth/login`: normalisasi email → cari user → **selalu** jalankan verifikasi hash (bila user tidak ada, verifikasi terhadap hash dummy konstan) supaya waktu respons tidak membocorkan keberadaan akun → jika gagal: 401 `INVALID_CREDENTIALS`, pesan persis **"Email atau password tidak valid"** (FR-09.5) — sama untuk email tak terdaftar & password salah.
4. Login sukses: **buat sesi baru** (anti session-fixation); jika `needsRehash` → hash ulang & simpan; catat `AuditLog` hanya untuk kegagalan beruntun (opsional) — jangan log password/email mentah di log aplikasi.
5. Respons 200 `{ user }`; frontend yang mengarahkan (MHS → `/`, SUPERADMIN → `/admin`).

**AC.**
- [ ] Cookie memiliki flag `HttpOnly`, `SameSite=Lax`, (prod) `Secure` + prefix `__Host-` (cek `Set-Cookie` di test).
- [ ] Respons login salah identik (body & status) untuk email tak ada vs password salah; selisih waktu rata-rata kedua kasus < 50 ms (uji di test dengan 20 sampel — toleransi longgar).
- [ ] Token JWT dengan `alg: none` atau secret salah → 401.
- [ ] `remember=false` → tidak ada `Max-Age`/`Expires` di cookie; `remember=true` → 30 hari.

---

### ISSUE-012 — Middleware sesi, `/auth/me`, logout, pembersihan
`P0 · M · Depends: 011` · FR-09.8–09.11

**Langkah.**
1. `middleware/auth.ts` (`requireAuth`): ambil cookie → verifikasi JWT → `sessions` harus ada, `revokedAt IS NULL`, `expiresAt > now()` → muat user → `req.user`. Gagal apa pun → 401 `UNAUTHENTICATED` + hapus cookie. Update `lastSeenAt` paling sering sekali per 5 menit (hindari tulis DB tiap request).
2. `GET /auth/me` → `{ user }` (dipakai front-end untuk FR-09.11 "cek sesi otomatis saat membuka aplikasi").
3. `POST /auth/logout`: set `revokedAt=now()` pada sesi saat ini, hapus cookie (`Max-Age=0`, atribut sama) → 204. Idempoten.
4. Fungsi `revokeAllSessions(userId)` — dipakai saat password diganti, role diubah, user dihapus (Issue 033).
5. Job pembersihan: hapus `sessions` yang `expiresAt < now() - 7 hari` (jalan di worker, Issue 031).
6. `PATCH /me` (nama, locale, timezone, kapasitas harian — validasi Zod; kapasitas 1–24).

**AC.**
- [ ] Setelah logout, memakai kembali cookie lama → 401 (revocation berfungsi walau JWT belum expired).
- [ ] Sesi kedaluwarsa di DB → 401 walau JWT masih valid.
- [ ] Endpoint tanpa cookie → 401 format error standar.

---

### ISSUE-013 — RBAC & isolasi data (anti-IDOR)
`P0 · M · Depends: 012` · Menutup T-10 · D-04

**Langkah.**
1. `requireRole('MAHASISWA' | 'SUPERADMIN')` — role dibaca dari **DB** (user yang dimuat di `requireAuth`), **bukan** dari klaim JWT.
2. Router mahasiswa (`/categories`, `/tasks`, `/dashboard`, `/moods`, `/recommendations`) → `requireRole('MAHASISWA')`; router `/admin` → `requireRole('SUPERADMIN')`. SuperAdmin ke endpoint mahasiswa → 403.
3. **Aturan repo:** setiap fungsi repository untuk data milik user menerima `userId` sebagai **argumen pertama wajib** dan menyertakannya di `WHERE` (`findFirst({ where: { id, userId } })`, `updateMany/deleteMany` dengan `userId`). Larang `findUnique({ where: { id } })` untuk resource milik user. Tambahkan aturan ESLint kustom/komentar review + test.
4. Resource milik user lain → **404** (bukan 403) agar keberadaannya tidak bocor.
5. Setiap `categoryId` yang dikirim di body tugas harus diverifikasi milik user yang sama (kesalahan klasik IDOR lewat relasi).
6. Buat helper test `twoUsers()` yang membuat user A & B; tulis test lintas-user untuk **setiap** endpoint (tugas, kategori, mood, push, reminder) — dijalankan juga di Issue 058.

**AC.**
- [ ] User A tidak bisa GET/PATCH/DELETE tugas/kategori milik B (semua → 404).
- [ ] User A tidak bisa membuat tugas dengan `categoryId` milik B (→ 400/404).
- [ ] SuperAdmin memanggil `GET /tasks` → 403; mahasiswa memanggil `/admin/users` → 403.

---

### ISSUE-014 — Throttling login/register & anti-enumerasi
`P0 · S · Depends: 011, 009` · NFR-04

**Langkah.**
1. Limiter login: **kunci = IP + email ter-normalisasi**, 5 gagal / 15 menit → 429 dengan `Retry-After` (kunci per-email-tanpa-IP dihindari agar penyerang tidak bisa mengunci akun korban). Tambah limiter IP saja: 30 percobaan/15 menit.
2. Limiter register: 5/jam/IP. Limiter `push/test`: 5/menit/user.
3. Store: memori (cukup untuk 1 instance). Catat di ADR bahwa scale-out butuh store bersama (Redis/PG).
4. Pesan register "Email sudah terdaftar" membocorkan keberadaan akun — **diterima** karena diwajibkan SKPL (UISW02: "Email harus unik"), dimitigasi rate-limit di atas. Dokumentasikan.
5. Catat kegagalan login berulang ke `audit_logs` (`LOGIN_FAIL`, hash email, IP) — untuk deteksi serangan; jangan simpan password.

**AC.** 6 login salah beruntun (email & IP sama) → percobaan ke-6 mendapat 429; login benar dari IP lain untuk email yang sama tetap bisa.

---

# E3 — DOMAIN BERSAMA (`packages/shared`) — jantung aplikasi

> Semua fungsi di bawah **murni (pure)**: tidak memanggil `Date.now()` atau membaca DB di dalamnya. `now` dan `timezone` dikirim sebagai argumen. Ini membuat test deterministik dan memungkinkan dipakai FE+BE.

### ISSUE-015 — Tipe, konstanta, dan skema Zod bersama
`P0 · M · Depends: 003` · FR-01.1–01.2 · D-06, D-32

**Langkah.**
1. `constants.ts`: `PRIORITY_THRESHOLDS = {TOP:36, HIGH:24, MEDIUM:12}`, `BUFFER_MINUTES=30`, `DEFAULT_CAPACITY_HOURS=8`, `REMINDER_LEAD_HOURS=24`, `ROUTINE_LEAD_MINUTES=30`, `DEFAULT_CATEGORIES` (D-10), `CATEGORY_PALETTE` (12 warna dari `app.css`/`app.js` lama), batas panjang field (D-32).
2. `schemas/task.ts`: `taskInputSchema = z.discriminatedUnion('type', [...])` (Bagian 6.3) dengan aturan:
   - `title` trim 1–100; `description` ≤ 1000; `importance/difficulty` int 1–5.
   - FIXED_TIME: `endAt > startAt`. DEADLINE: `durationHours ≥ 0.5` (langkah input 0.5; sesuai SKPL UISW09 "minimal 0.5 jam"; maks 100 jam). ROUTINE: `routineDays` 1–7 unik berisi 1..7, `routineStartTime` `HH:mm`, `durationHours ≥ 0.25` (langkah 0.25, maks 12 jam).
   - Tanggal diterima sebagai ISO string dengan offset; transform ke `Date`.
3. `schemas/category.ts` (nama 1–50 trim, `color` regex `^#[0-9A-Fa-f]{6}$` → simpan UPPERCASE, `type`), `schemas/mood.ts`, `schemas/user.ts` (admin: nama/email/password opsional saat edit/role), `schemas/auth.ts` (Issue 010).
4. Ekspor tipe TS dari skema (`z.infer`) — **satu-satunya** sumber tipe request/response.
5. Pesan error Zod tidak di-hardcode Indonesia di server; kirim **kode** (`too_short`, `invalid_email`…) + gunakan peta i18n di FE (Issue 039). Server juga menyediakan `message` default Indonesia untuk klien non-web.

**AC.** Test: tiap skema menerima contoh valid dan menolak ≥ 5 contoh tidak valid (batas bawah/atas, tipe salah, kunci tak dikenal, `endAt <= startAt`, warna `#GGGGGG`, hari rutin `[0]`, `[8]`, duplikat).

---

### ISSUE-016 — Utilitas waktu & zona waktu (Luxon)
`P0 · M · Depends: 015` · D-20 · Menutup T-13

**Langkah.**
1. `domain/time.ts`: `startOfDay(ms, tz)`, `endOfDay`, `addDays` (aman DST), `weekdayISO(ms, tz)` (1=Senin), `minutesSinceMidnight(ms, tz)`, `localToUtc({date:'2026-10-05', time:'19:30'}, tz)`, `isValidTimezone(tz)`.
2. `domain/routine.ts`: `nextOccurrence(task, fromMs, tz)` → ms start kemunculan berikutnya (kemunculan yang **sedang berlangsung** dihitung, seperti kode lama: `d + dur > from`); `occurrencesBetween(task, fromMs, toMs, tz)` → `[start,end][]`.
3. `eventTime(task, now, tz)`: FIXED→`startAt`; DEADLINE→`deadlineAt`; ROUTINE→`nextOccurrence`.
4. `durationHours(task)`: FIXED→(end−start)/jam; lainnya→`durationMinutes/60`.
5. Format tampilan (`fmtDateTime`, `fmtRelative`) ada di FE (Issue 036), **bukan** di shared (hindari ketergantungan locale).

**AC.** Test dengan zona `Asia/Jakarta`, `Asia/Makassar`, `America/New_York` (melewati DST), dan routine "Senin 23:30" yang melewati batas hari UTC → hasil benar. `nextOccurrence` untuk routine yang sedang berlangsung mengembalikan kemunculan hari ini.

---

### ISSUE-017 — Priority engine (FR-02)
`P0 · M · Depends: 016` · FR-02.1–02.6 · SKPL 4.5.2-A · D-22, D-27

**Rumus (wajib persis):**
```
Priority = Urgency × Importance(1–5) × DifficultyModifier
DifficultyModifier = 0.8 + (difficulty − 1) × 0.1        → 0.8 … 1.2
Urgency:
  FIXED_TIME : 10 − hours_until_start / 24
  DEADLINE   : 10 − (hours_until_deadline − duration_hours) / 24
  ROUTINE    : seperti FIXED_TIME memakai kemunculan berikutnya
  lalu di-clamp ke [1, 10]; FIXED_TIME yang sudah selesai berlangsung → urgency = 1
Label (pakai skor mentah, bukan yang dibulatkan): ≥36 TOP · ≥24 HIGH · ≥12 MEDIUM · selain itu LOW
Skor tampilan dibulatkan 1 desimal. Skor maksimum = 10×5×1.2 = 60.
```

**Langkah.** Implementasi `urgency(task, now, tz)`, `priority(task, now, tz) → {score, label, urgency}`, `compareByPriority` (tugas `DONE` selalu paling bawah — UC #3 langkah 6), `isHighPriority` (TOP/HIGH).

**Golden test wajib** (now = 2026-10-05 08:00 WIB, difficulty 3 ⇒ modifier 1.0 bila tidak disebut):
| Kasus | Hitungan | Hasil |
|---|---|---|
| DEADLINE +48 j, durasi 2 j, imp 5, diff 4 | U = 10 − (48−2)/24 = 8.0833; ×5×1.1 | **44.5 → TOP** |
| FIXED mulai +24 j, imp 4, diff 4 | U = 9; 9×4×1.1 | **39.6 → TOP** |
| DEADLINE +120 j, durasi 3 j, imp 4, diff 3 | U = 5.125; ×4×1.0 | **20.5 → MEDIUM** |
| DEADLINE +480 j, durasi 1 j, imp 2, diff 1 | U clamp → 1; 1×2×0.8 | **1.6 → LOW** |
| FIXED sudah berakhir, imp 3, diff 3 | U = 1; 1×3×1.0 | **3.0 → LOW** |
| DEADLINE terlambat 5 j, durasi 2 j, imp 3, diff 3 | U = 10.29 → clamp 10; 10×3 | **30.0 → HIGH** |
| Batas: skor tepat 36 / 24 / 12 | | TOP / HIGH / MEDIUM |
| ROUTINE sedang berlangsung | event = kemunculan hari ini | U dari kemunculan itu |

**AC.** Semua baris tabel di atas jadi test Vitest hijau; test properti: skor selalu dalam [0.8, 60]; menaikkan `importance` tidak pernah menurunkan skor.

---

### ISSUE-018 — Conflict engine (FR-04)
`P0 · L · Depends: 017` · FR-04.1–04.6 · UC #1 · Port dari `checkConflicts`, `suggestSlot`, `dayLoad`, `intervals`

**Aturan (perilaku kode lama yang dipertahankan):**
1. Horizon pengecekan: **14 hari** ke depan dari `now`. Hanya tugas **belum DONE** dan **bukan tugas yang sedang diedit** (`excludeTaskId`, FR-04.6).
2. Hanya **FIXED_TIME** dan **ROUTINE** yang memakai slot waktu (diekspansi jadi interval di zona user). **DEADLINE tidak bisa "bentrok"**, tetapi menyumbang beban harian.
3. **Tabrakan:** `a1 < b2 && b1 < a2`. **Buffer:** jika tidak tabrakan tetapi jarak < **30 menit** → peringatan buffer (FR-04.2). Satu tugas lawan dilaporkan paling banyak sekali.
4. **Overcommitment (FR-04.3):** beban harian = jam FIXED/ROUTINE pada hari itu + jam DEADLINE yang **disebar rata** dari hari ini sampai hari deadline (`durasi / jumlahHari`). Jika > kapasitas user (default 8 j) → `overload` (maks 3 hari ditampilkan).
5. **Saran solusi (FR-04.4):**
   - `suggestedSlot` hanya untuk kandidat FIXED_TIME: geser mulai ke setelah penghalang terakhir + 30 menit, dibulatkan ke atas ke kelipatan 15 menit; ulangi maksimal 24 kali; jika tidak ketemu → `null`.
   - `lowPriorityCandidate`: tugas lawan (tabrakan/buffer) dengan skor **lebih rendah** dari kandidat, ambil yang terendah; bila tidak ada & ada overload → tugas dengan skor terendah (< kandidat) yang berkontribusi pada hari overload.
6. Output: `{ collisions[{task,start,end}], buffers[{task,gapMinutes,start,end}], overload[{dayStart,hours}], suggestedSlot|null, lowPriorityCandidate|null, any:boolean }`.

**Test wajib:** tabrakan penuh; tabrakan sebagian; jarak 29 vs 30 menit (batas); routine vs fixed; deadline tidak pernah "bentrok"; overload tepat di kapasitas (tidak overload) vs +0.1 j (overload); edit tugas tidak bentrok dengan dirinya sendiri; saran slot melewati dua penghalang berturut-turut; tidak ada saran bila 24 iterasi habis.

**AC.** Semua test di atas hijau; fungsi tidak mengakses DB (data tugas dikirim sebagai argumen).

---

### ISSUE-019 — Recommendation engine rule-based (FR-03, 06, 08)
`P0 · L · Depends: 017` · SKPL 4.5.2-B · D-13, D-15

**Aturan (port dari `recommend()` lama):**
```
Kompleksitas c = clamp(0.7×difficulty + 0.3×(min(durasiJam,6)/6×5), 1, 5)
Rentang energi per mood:  5:[3,5]  4:[2.5,4.5]  3:[2,3.5]  2:[1,2.5]  1:[1,1.6]
dist = 0 bila c di dalam rentang; selain itu jarak ke batas terdekat
fit  = max(0, 1 − dist/2)          matchPercent = round(fit×100)
score = (priorityScore/60)×0.55 + fit×0.45
Kandidat = tugas belum DONE, kecuali FIXED yang sudah lewat
Mood ≤ 2 DAN c ≥ 3.2 DAN sisa waktu > 48 j DAN label ≠ TOP  →  masuk daftar "Saran Ditunda" (maks 3) (FR-06.4)
Mood = 1: hanya tugas berlabel TOP atau sisa < 24 j yang boleh direkomendasikan
Hasil: maks 5 item urut skor menurun
```
Setiap item memuat `reasonKey` (kunci i18n, bukan kalimat) + parameter, mis. `rec.reason.highEnergyComplex`, `rec.reason.light`, `rec.reason.fits`, `rec.reason.warmup`, `rec.reason.challenging`, `rec.reason.urgentGentle`, serta penanda tambahan `topPriority` / `dueIn24h`. Teks Indonesia & Inggris diambil dari kode lama (`L('…','…')`) dan dipindah ke file i18n (Issue 039).

**Self-care (FR-08.1):** mood 1 → kartu dengan 4 saran (napas 4-7-8, peregangan 5 menit, minum air & jauhi layar ±20 menit, bicara dengan orang tepercaya/konseling kampus). Mood 2 → tip Pomodoro. Sediakan **daftar tip** (≥ 6) agar tombol "refresh tip" di mockup UISW06 ("Self-Care Tip" + ikon refresh) punya isi berbeda.

**Antarmuka (D-15):**
```ts
interface RecommendationProvider {
  recommend(input: { mood: 1|2|3|4|5; tasks: Task[]; now: number; tz: string }): RecommendationResult;
}
export const ruleBasedProvider: RecommendationProvider = { … }   // satu-satunya implementasi sekarang
```
**Fallback (FR-06.5):** `recommendationService` memanggil provider terkonfigurasi; bila melempar error/timeout (> 2 detik) → pakai `ruleBasedProvider`. Saat ini provider default sudah rule-based, tetapi jalur fallback tetap diimplementasikan dan dites (dengan provider palsu yang error).

**AC.** Test: mood 5 memilih tugas kompleks; mood 2 menaruh tugas berat dengan deadline > 48 j di `postpone`; mood 1 hanya mengembalikan TOP/<24 j; daftar kosong → `items=[]`; waktu eksekusi untuk 500 tugas < 50 ms (NFR-01.2 < 3 s dipenuhi jauh); fallback terpanggil saat provider error.

---

### ISSUE-020 — Reminder time calculator + paket test domain
`P0 · S · Depends: 016, 017` · FR-05.1, 05.4 · D-11

**Langkah.** `domain/reminder.ts`: `computeReminderAt(task, now, tz) → {remindAt, eventAt} | null`:
- DEADLINE/FIXED: `remindAt = event − 24j`; bila `remindAt < now + 1 menit` → `event − 1j`; bila masih `< now + 1 menit` → `null`. Jika `event < now` → `null`.
- ROUTINE: kemunculan berikutnya; `remindAt = start − 30 menit`; bila sudah lewat → ambil kemunculan sesudahnya.
- `status === DONE` → `null`.
Kumpulkan seluruh golden test Issue 015–019 di `packages/shared/src/**/*.test.ts`; konfigurasikan **coverage ≥ 90 %** untuk `domain/`.

**AC.** Coverage domain ≥ 90 %; tabel kasus reminder (tugas dibuat 3 hari sebelum, 10 jam sebelum, 30 menit sebelum, sudah lewat, DONE, routine yang sedang berlangsung) lulus.

---

# E4 — KATEGORI (FR-07)

### ISSUE-021 — API Kategori
`P0 · M · Depends: 013, 015` · FR-07.1–07.6 · UC #6 · D-09, D-10, T-06

**Langkah.**
1. `GET /categories` → urut: tipe, lalu nama; sertakan `taskCount` per kategori (satu query `groupBy`, jangan N+1).
2. `POST /categories` `{name,color,type}`: nama ≤ 50, warna `#RRGGBB` (server menormalkan ke uppercase), unik per user+tipe (tangkap unique violation → 409 `NAME_TAKEN`, pesan "Nama kategori sudah ada").
3. `PATCH /categories/:id`: ubah nama/warna/tipe. Bila tipe berubah dan ada tugas terkait → respons sukses, tetapi `GET /tasks?scope=` akan otomatis memindahkan tampilannya (scope diturunkan dari kategori). FE meminta konfirmasi sebelum mengirim.
4. `DELETE /categories/:id?reassignTo=<categoryId>`: jika ada tugas memakai kategori dan **tidak** ada `reassignTo` → 409 `CATEGORY_IN_USE` + `{taskCount}`. Dengan `reassignTo` (harus milik user, bukan dirinya sendiri) → dalam satu transaksi pindahkan tugas lalu hapus.
5. Tidak ada limit kategori? Tetapkan maksimum **50 kategori per user** (cegah penyalahgunaan) → 409 bila terlampaui.

**AC.**
- [ ] Warna `javascript:alert(1)`, `red`, `#12345` → 400.
- [ ] Hapus kategori terpakai tanpa `reassignTo` → 409; dengan `reassignTo` → tugas pindah, kategori hilang.
- [ ] Kategori user lain tidak bisa dipakai di `reassignTo` (404).
- [ ] FR-07.6: setelah POST, `GET /categories` langsung memuat kategori baru (FE meng-invalidate query → dropdown form ikut berubah).

---

# E5 — TUGAS (FR-01, FR-02, FR-04)

### ISSUE-022 — API Tugas: CRUD, daftar, filter, sort, cari
`P0 · L · Depends: 013, 017, 021` · FR-01.1–01.6, FR-02.3–02.6 · UC #1, #2, #4 · D-22, D-30, D-31

**Langkah.**
1. `POST /tasks`: validasi `taskInputSchema`; pastikan `categoryId` milik user; konversi `durationHours`→`durationMinutes`; routine `routineStartTime`→`routineStartMinute`. Simpan, lalu panggil `ReminderService.sync(task)` **dalam transaksi yang sama** (Issue 029). Respons 201 berisi tugas + `priority` terhitung. **Server tidak memblokir karena konflik** — keputusan ada pada user (FR-04.5); cek konflik lewat endpoint terpisah (Issue 024).
2. `PATCH /tasks/:id`: *partial update* dengan validasi penuh atas hasil gabungan; **tipe boleh diganti** (field tipe lama dibersihkan agar lolos CHECK DB); status/`doneAt`/`createdAt` tidak berubah; sync reminder (FR-05.4).
3. `GET /tasks/:id`, `DELETE /tasks/:id` (reminder ikut terhapus via cascade — FR-05.5).
4. `GET /tasks` — query Bagian 6.2. Implementasi: ambil tugas user (dengan filter SQL untuk `status`, `type`, `categoryId`, `scope` via join kategori, `q` → `ILIKE` pada judul & deskripsi dengan escape `%`/`_`), lalu **hitung `priority` di memori**, filter `priority` & `time` (D-30) di memori, urutkan:
   - selalu `DONE` paling bawah;
   - `priority`: skor menurun; `deadline`: waktu acara menaik (tanpa waktu → paling akhir); `newest`: `createdAt` menurun;
   - batas `limit` default 100, maks 500; sertakan `total`.
5. Respons tidak boleh memuat field milik user lain atau `userId`.
6. Catat `Cache-Control: no-store`.

**AC.**
- [ ] Membuat 3 tipe tugas valid → 201; payload tidak valid (mis. DEADLINE dengan `startAt`) → 400.
- [ ] Mengganti tipe dari DEADLINE→ROUTINE lewat PATCH berhasil (tidak melanggar CHECK) dan reminder dihitung ulang.
- [ ] `GET /tasks?sort=priority` urut skor menurun dengan tugas DONE di bawah; `q=quiz` mencari tanpa membedakan kapital; `q=%` tidak mengembalikan semua data (di-escape).
- [ ] 150 tugas: `GET /tasks` p95 < 300 ms di mesin CI (diukur pada Issue 063).
- [ ] FR-02.6: setelah DELETE, daftar berikutnya tidak memuat tugas itu dan urutan benar.

---

### ISSUE-023 — Perubahan status tugas (tri-state)
`P0 · S · Depends: 022` · FR-01.4, FR-05.3 · UC #3 · D-07, D-11

**Langkah.** `PATCH /tasks/:id/status` `{status}`: izinkan lompat langsung ke status mana pun (FE yang melakukan siklus). `DONE` → set `doneAt=now`, **batalkan** reminder PENDING; kembali ke `TODO/IN_PROGRESS` → `doneAt=null` dan **buat ulang** reminder bila masih relevan. Idempoten.

**AC.**
- [ ] Setelah `DONE`, tabel `reminders` untuk tugas itu tidak punya baris PENDING (status CANCELLED).
- [ ] `DONE → TODO` untuk deadline masa depan membuat reminder baru.
- [ ] Status tidak valid (`"FINISHED"`) → 400.

---

### ISSUE-024 — Endpoint cek konflik + saran solusi
`P0 · M · Depends: 018, 022` · FR-04.1–04.6 · UC #1 langkah 8–9

**Langkah.**
1. `POST /tasks/conflicts` body `{ candidate: <taskInput>, excludeTaskId?: uuid }`. Ambil semua tugas aktif user (kecuali `excludeTaskId`), panggil conflict engine, kembalikan hasil Bagian 6.2 (tugas lawan cukup `{id,title,priority}`).
2. Endpoint **tidak menyimpan apa pun** (dry-run).
3. Opsi "hapus tugas prioritas rendah" memakai `DELETE /tasks/:id` yang sudah ada (FE memanggil setelah konfirmasi).
4. Dipanggil FE: (a) saat klik Simpan (wajib), (b) opsional debounce 800 ms saat user mengubah waktu untuk menampilkan peringatan dini (P2).

**AC.** Test integrasi dengan dataset: kandidat bentrok → `collisions` terisi + `suggestedSlot` benar; mengedit tugas yang sama tidak bentrok dengan dirinya; user lain tidak pernah muncul di hasil.

---

### ISSUE-025 — Analytics tugas
`P1 · S · Depends: 022` · FR-01.7, FR-10.1 · D-08

**Langkah.** `GET /tasks/analytics?scope=kuliah|pribadi|all` → `{ total, done, active, totalHours, highPriority }` dengan definisi D-08. `totalHours` = jumlah `durationHours` tugas belum DONE (Routine dihitung **satu sesi**). Fungsi murni `computeAnalytics(tasks, now, tz)` di `shared` agar dashboard (Issue 028) memakai ulang.

**AC.** Test dengan dataset kecil: 5 tugas (2 DONE, 2 HIGH aktif) → angka sesuai D-08.

---
# E6 — MOOD & REKOMENDASI (FR-03, FR-06, FR-08)

### ISSUE-026 — API Mood
`P0 · S · Depends: 013, 015` · FR-03.1–03.3 · UC #7 · D-13, T-12

**Langkah.**
1. `POST /moods` `{level: 1..5}` → simpan `MoodEntry`. **Dedupe:** jika entri terakhir user punya `level` sama dan umurnya < 60 detik → kembalikan entri itu (200) tanpa insert baru.
2. `GET /moods/today` → entri **terbaru hari ini menurut zona waktu user** atau `{ level: null }`. `GET /moods?limit=7` → riwayat terakhir (untuk deretan emoji).
3. Pembersihan data: job di worker menghapus mood > 12 bulan (konfigurasi, lihat Issue 060).

**AC.** Dua POST level 3 dalam 5 detik → 1 baris di DB. "Hari ini" benar untuk user `Asia/Jayapura` yang input jam 00:30 waktu lokal (batas hari ≠ UTC). Level 0/6/"3" (string) → 400.

---

### ISSUE-027 — API Rekomendasi AI (rule-based) + self-care
`P0 · M · Depends: 019, 022, 026` · FR-06.1–06.5, FR-08.1 · UC #7

**Langkah.**
1. `GET /recommendations?mood=1..5` (bila `mood` kosong → pakai mood hari ini; jika belum ada → 400 `MOOD_REQUIRED`). Endpoint **tidak menyimpan mood** (FE memanggil `POST /moods` lebih dulu).
2. Muat tugas aktif user → `recommendationService.run()` (provider + fallback Issue 019).
3. Respons: `{ mood, energyKey, items:[{task:{id,title,category,type,eventAt,durationHours,difficulty,importance,priority}, matchPercent, reasonKey, reasonParams, isTopPick}], postpone:[{task, reasonKey, reasonParams}], selfCare:{ level: 1|2|null, tipKeys:[…] } }`.
4. Ukur & log durasi (`recommendation_ms`); target p95 < 300 ms (NFR-01.2 < 3 detik).
5. SuperAdmin → 403 (D-04).

**AC.** Contoh dataset golden (Issue 019) menghasilkan urutan yang sama via HTTP. `mood=7` → 400. Tanpa tugas aktif → `items: []` (FE menampilkan pesan "Tidak ada tugas untuk direkomendasikan saat ini").

---

# E7 — DASHBOARD (FR-10)

### ISSUE-028 — API Dashboard (satu panggilan)
`P0 · M · Depends: 025, 026, 027` · FR-10.1, 10.2 · UC #5 · NFR-01.1 · D-08, D-29

**Langkah.** `GET /dashboard` → 
```json
{ "analytics": {"total":0,"done":0,"totalHours":0,"highPriority":0},
  "nearest": [ /* maks 4 tugas: id,title,category{name,color},type,eventAt,priority,isOverdue */ ],
  "dueWithin24h": 0,
  "mood": { "level": 3, "at": "…" },
  "topPick": { "taskId":"…", "title":"…" } }
```
- `nearest` mengikuti D-29. `dueWithin24h` = tugas bukan routine, belum DONE, `0 < event − now < 24 jam` (untuk banner pengingat).
- `topPick` hanya bila ada mood hari ini (kartu ringkasan rekomendasi).
- Gunakan **maksimal 2 query SQL** (tugas user + mood) lalu hitung di memori; tidak ada N+1.

**AC.** Seed 150 tugas: p95 < 300 ms. Tugas deadline yang lewat 3 hari tetap muncul di `nearest` dengan `isOverdue=true`. Tugas DONE tidak pernah muncul.

---

# E8 — REMINDER & PUSH (FR-05)

### ISSUE-029 — ReminderService (sinkron jadwal ↔ tugas)
`P0 · M · Depends: 020, 022` · FR-05.1, 05.3, 05.4, 05.5 · D-11

**Langkah.**
1. `ReminderService.sync(tx, task, user)`: (a) ubah semua reminder `PENDING` tugas itu → `CANCELLED`; (b) `computeReminderAt()` (Issue 020); jika hasil ≠ null → `INSERT` reminder `PENDING` (`remindAt`, `eventAt`). Dipanggil **di dalam transaksi** create/update/status (Issue 022/023).
2. Hapus tugas → cascade menghapus reminder (FR-05.5). User mengganti `timezone` → panggil ulang `syncAll(user)` untuk tugas ROUTINE.
3. `GET /tasks/:id` menyertakan `reminderAt` (reminder PENDING berikutnya) untuk ditampilkan di popup detail.
4. Idempoten: memanggil `sync` dua kali berturut-turut menghasilkan tepat satu reminder PENDING (dijaga unique index parsial).

**AC.** Test: buat deadline 3 hari lagi → 1 PENDING pada H-1; ubah deadline → PENDING lama CANCELLED & baru dibuat (FR-05.4); status DONE → tidak ada PENDING (FR-05.3); hapus tugas → tidak ada baris reminder (FR-05.5); ROUTINE → reminder 30 menit sebelum kemunculan berikutnya.

---

### ISSUE-030 — Infrastruktur Web Push (VAPID) + langganan perangkat
`P0 · M · Depends: 012, 009` · FR-05.2 · NFR-04

**Langkah.**
1. Pasang `web-push`; `webpush.setVapidDetails(subject, publicKey, privateKey)` dari env. Aplikasi menolak start di production bila VAPID kosong **dan** `RUN_WORKER=true`.
2. `GET /push/public-key` → `{ publicKey }`.
3. `POST /push/subscriptions` `{ endpoint, keys:{p256dh,auth}, userAgent? }`: **upsert berdasarkan `endpoint`** (bila endpoint sudah ada milik user lain — mis. perangkat bersama — pindahkan ke user saat ini). Maksimal 10 langganan per user (hapus yang terlama).
4. **Anti-SSRF (penting):** server nanti mengirim HTTP ke `endpoint` yang diberikan klien. Validasi: skema harus `https:`; host bukan IP literal / localhost / rentang privat; host harus berakhiran salah satu **allowlist** layanan push: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `push.services.mozilla.com`, `web.push.apple.com`, `push.apple.com`, `notify.windows.com`. Di luar itu → 400 (catat di log untuk ditinjau; senior yang memutuskan penambahan allowlist).
5. `DELETE /push/subscriptions` `{ endpoint }` → hapus (hanya milik user sendiri).
6. `POST /push/test` → kirim notifikasi uji ke **semua perangkat user sendiri** (rate-limit 5/menit).
7. Generate kunci VAPID sekali (`npx web-push generate-vapid-keys`), simpan di secret manager/`.env` server. **Mengganti kunci akan memutus semua langganan lama** — catat di runbook.

**AC.** Endpoint `http://169.254.169.254/…` atau `https://evil.example/…` ditolak (400). Dua user mendaftarkan endpoint sama → hanya satu baris (milik terakhir). Pengiriman memakai klien push yang bisa di-*mock* di test.

---

### ISSUE-031 — Worker pengirim reminder
`P0 · L · Depends: 029, 030` · FR-05.2, 05.1 · NFR-03, NFR-06

**Langkah.** `src/worker/index.ts` (proses terpisah; juga bisa jalan in-process jika `RUN_WORKER=true`):
1. Loop setiap `REMINDER_POLL_SECONDS` (default 30 detik; hindari tumpang-tindih — jalankan iterasi berikutnya setelah selesai). Tiap iterasi dalam transaksi:
```sql
SELECT id FROM reminders
WHERE status = 'PENDING' AND remind_at <= now()
ORDER BY remind_at
LIMIT 50
FOR UPDATE SKIP LOCKED;
```
2. Untuk tiap reminder: muat tugas+user; jika tugas sudah DONE/hilang → `CANCELLED`. Jika `eventAt < now()` (acara sudah lewat; mis. worker mati lama) → `EXPIRED` (jangan kirim notifikasi basi). Selain itu bangun payload (Issue 032) dan kirim ke **semua** langganan user.
3. Hasil kirim: status HTTP 404/410 → hapus langganan itu; error sementara (5xx/jaringan/429) → `attempts+1`, jadwalkan ulang `remindAt = now + [1,5,15] menit`, setelah 3 kali → `FAILED` + `lastError`; minimal satu langganan sukses → `SENT`, `sentAt=now`, update `lastSuccessAt`; user tak punya langganan → `FAILED` dengan `lastError='NO_SUBSCRIPTION'` (UI dashboard tetap menampilkan banner fallback).
4. **ROUTINE:** setelah `SENT`/`EXPIRED`, hitung kemunculan berikutnya dan sisipkan reminder PENDING baru (`ReminderService`), sehingga siklus berlanjut sampai tugas DONE/dihapus.
5. Tugas harian pembersihan (sekali sehari): hapus `sessions` kedaluwarsa > 7 hari, `reminders` berstatus final > 30 hari, mood > retensi.
6. Graceful shutdown (`SIGTERM`), log ringkas per iterasi (jumlah diproses/terkirim/gagal) — tanpa judul tugas/isi notifikasi di log.
7. Healthcheck: setiap iterasi menyentuh file `/tmp/worker.alive`; compose memeriksa umur file < 120 detik (Issue 069).

**AC.**
- [ ] Test dengan *fake clock* + pengirim palsu: reminder jatuh tempo terkirim tepat sekali walau 2 worker berjalan bersamaan (`SKIP LOCKED`).
- [ ] Reminder dengan `eventAt` di masa lalu → `EXPIRED`, tidak terkirim.
- [ ] Respons 410 menghapus langganan; 3× error 500 → `FAILED`.
- [ ] Routine: setelah terkirim, ada tepat 1 PENDING berikutnya.
- [ ] Uji manual end-to-end di HP nyata: buat deadline dengan reminder 2 menit lagi (gunakan env `REMINDER_LEAD_OVERRIDE_MINUTES` **hanya di dev**) → notifikasi muncul saat aplikasi ditutup.

---

### ISSUE-032 — Isi & lokalisasi notifikasi
`P1 · S · Depends: 031` · FR-05.2 · SKPL 2.5 (no dark patterns) · D-11

**Format payload** (JSON terenkripsi Web Push, ≤ 1 KB):
```json
{ "title": "⏰ Deadline besok: Laporan Praktikum Jarkom",
  "body": "Kamis, 8 Okt 20.00 · estimasi 3 jam. Ketuk untuk membuka.",
  "tag": "task-<taskId>", "url": "/tugas-kuliah?open=<taskId>", "taskId": "<taskId>" }
```
- Tanggal/jam diformat server dengan Luxon memakai `user.timezone` dan `user.locale` (id/en).
- `tag` = per-tugas sehingga notifikasi baru **mengganti** yang lama (tidak menumpuk).
- Header push: `TTL` = detik sampai `eventAt` (maks 24 jam), `urgency: 'normal'`.
- **Tidak boleh**: judul clickbait, hitung mundur menekan, atau mengirim ulang berulang (SKPL 2.5c).
- (P2) Pengaturan "Sembunyikan judul tugas pada notifikasi" (privasi layar kunci) → judul diganti "Anda punya pengingat tugas".

**AC.** Snapshot test payload untuk DEADLINE, FIXED, ROUTINE dalam id & en; jam sesuai zona user (user `Asia/Makassar` mendapat jam yang benar).

---

# E9 — ADMIN (FR-11)

### ISSUE-033 — API Manajemen User (SuperAdmin)
`P0 · M · Depends: 013, 010` · FR-11.1–11.4 · UC #11 · UISW08 · D-04, D-21

**Langkah.**
1. `GET /admin/stats` → `{ totalUsers, totalMahasiswa, totalSuperAdmin }`.
2. `GET /admin/users?limit=50&offset&q` → `[{id,name,email,role,createdAt}]` (tanpa `passwordHash`), urut `createdAt` menurun. **Tidak** pernah mengembalikan tugas/mood/kategori user.
3. `POST /admin/users` `{name,email,password,role}` → hash Argon2id; bila `MAHASISWA` buat kategori default (D-10).
4. `PATCH /admin/users/:id` `{name?,email?,role?,password?}`; password kosong = tidak berubah. Jika `role` atau `password` berubah → `revokeAllSessions(userId)` (paksa login ulang).
5. `DELETE /admin/users/:id`: tolak jika id = diri sendiri; tolak jika target adalah **SuperAdmin terakhir** (409 `LAST_SUPERADMIN`). Hapus = cascade penuh (tugas, kategori, mood, reminder, sesi, langganan push).
6. **Aturan SuperAdmin terakhir harus aman dari race condition:** lakukan dalam transaksi `SERIALIZABLE` atau `SELECT … FOR UPDATE` pada semua baris SuperAdmin sebelum menghitung. Ini juga berlaku untuk menurunkan role.
7. Setiap aksi tulis → `audit_logs` (`USER_CREATE/UPDATE/DELETE`, actor, target, **tanpa** password).

**AC.**
- [ ] Dua request paralel yang masing-masing menghapus/menurunkan SuperAdmin berbeda (tersisa 2) → hasil akhir tetap ≥ 1 SuperAdmin.
- [ ] Mengubah role/password user → sesi aktif user itu langsung tidak valid.
- [ ] Mahasiswa → 403 untuk semua `/admin/*`. Email duplikat (beda kapital) → 409.
- [ ] Hapus user → `SELECT count(*)` pada semua tabel anak untuk user itu = 0.

---

# E10 — FONDASI FRONTEND

### ISSUE-034 — Scaffold `apps/web` (Vite + React 18 + TS + Tailwind 3)
`P0 · M · Depends: 003` · NFR-05

**Langkah.**
1. `npm create vite` template `react-ts` di `apps/web` (rapikan sesuai monorepo). Pasang `tailwindcss@^3.4`, `postcss`, `autoprefixer`, `lucide-react`, `react-router`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`, `luxon`, `i18next`, `react-i18next`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-toast`, `vite-plugin-pwa`; dev: `vitest`, `@testing-library/*`, `msw`, `jsdom`.
2. `vite.config.ts`: `server.proxy['/api'] → http://localhost:3000`; `build.target: ['chrome90','firefox88','safari15']`; `build.sourcemap: 'hidden'`; alias `@` → `src`; `define` `__APP_VERSION__`.
3. `package.json` → `browserslist`: `Chrome >= 90, Edge >= 90, Firefox >= 88, Safari >= 15.4, iOS >= 15.4` (iOS 16.4 untuk push; shell tetap jalan di 15.4+). Aktifkan `eslint-plugin-compat`.
4. **Tanpa CDN & tanpa Google Fonts.** Font = tumpukan sans-serif sistem: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif` (SKPL 4.1.2: sans-serif 14–16 px). Alasan: privasi, performa, CSP `font-src 'self'`.
5. Code-splitting per rute (`React.lazy`); `main.tsx` membungkus `QueryClientProvider`, `RouterProvider`, `I18nextProvider`, `ToastProvider`, `ErrorBoundary`.
6. `index.html`: `<html lang="id">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (**tanpa** `maximum-scale`), `<meta name="theme-color" content="#1D4ED8">`, `<meta name="robots" content="noindex">`, `<noscript>` pesan "Aktifkan JavaScript".
7. Setup MSW untuk dev opsional & test.

**AC.** `npm run dev -w apps/web` menampilkan halaman awal; `npm run build -w apps/web` sukses; `npx browserslist` menampilkan target sesuai D-16; tidak ada request ke domain eksternal (cek tab Network).

---

### ISSUE-035 — Design system: token & komponen dasar
`P0 · L · Depends: 034` · SKPL 4.1.1–4.1.3 · D-06, D-27, D-36

**Token (pindahkan dari `app.css` lama ke `tailwind.config.ts`):** `primary #2563EB`, `primary-dark #1D4ED8`, `primary-light #DBEAFE`, `primary-xl #EFF6FF`, `bg #F4F7FC`, `text #0F172A`, `muted #64748B`, `line #E2E8F0`, `top #B91C1C`, `high #EF4444`, `medium #EAB308`, `low #16A34A`, `ok #16A34A`, `warn #D97706`, `danger #DC2626`; radius 14 px; bayangan kartu; spacing skala 4 px.

**Tipografi (SKPL: sans-serif 14–16 px):** teks isi 15–16 px; **input/select/textarea ≥ 16 px** (cegah iOS zoom-saat-fokus); label 14 px; teks sekunder & badge **minimal 12 px**. Tombol min tinggi **44 px** (target sentuh).

**Komponen (satu file per komponen + test + dipamerkan di rute dev-only `/dev/ui`):**
`Button` (primary/secondary/danger/ghost, sm/md, `loading`), `Input`, `PasswordInput` (tombol mata, `aria-pressed`), `Textarea`, `Select` (native `<select>`), `Field` (label + hint + error, `aria-describedby`, `aria-invalid`), `Checkbox`, **`TriStateCheckbox`** (`<button role="checkbox" aria-checked="false|mixed|true">`), `ScaleSelect` (dropdown berlabel 1–5), `DayPicker` (7 checkbox Senin–Minggu, grup berlabel), **`DateTimeField`** (date + time terpisah — D-36), `ColorPicker` (12 swatch palet + input `type=color` → dinormalkan `#RRGGBB`), `PriorityBadge`, `CategoryBadge`, `StatusBadge`, `StatCard`, `Card`, `EmptyState`, `Skeleton`, `Spinner`, `Avatar` (inisial).

**Aturan tampilan:**
- Warna prioritas konsisten di seluruh aplikasi: TOP merah tua, HIGH merah, MEDIUM kuning (teks gelap), LOW hijau; **selalu sertakan teks label** (bukan hanya warna).
- Kontras teks ≥ **4.5:1** (WCAG AA). Periksa `muted` pada latar `bg` — jika di bawah 4.5, gelapkan sedikit. Gunakan alat kontras/axe.
- Fokus terlihat jelas (`focus-visible:ring-2 ring-primary`); jangan `outline: none` tanpa pengganti.
- Hormati `prefers-reduced-motion`.

**AC.** Halaman `/dev/ui` menampilkan semua komponen & state (normal, hover, fokus, disabled, error, loading) dalam 360 px dan 1280 px; test axe tanpa pelanggaran serius; semua komponen bisa dioperasikan dengan keyboard.

---

### ISSUE-036 — Layout aplikasi responsif (mobile-first)
`P0 · L · Depends: 035` · SKPL 4.1.1 ("sidebar selalu di kiri"), 4.1.2 (mobile-first) · D-04, D-34

**Spesifikasi.**
| Lebar | Struktur |
|---|---|
| < 1024 px | **TopBar** (hamburger/back + judul + aksi kanan) · **BottomNav** 5 item (Beranda, Kuliah, Pribadi, AI, Kategori) · **Drawer** dari kiri (profil, Pengaturan, Bahasa, Pasang Aplikasi, Keluar) |
| ≥ 1024 px | **Sidebar kiri tetap** 256 px: logo "StudyWork", menu (Dashboard, Tugas Kuliah, Tugas Pribadi, AI Recommendation, Kategori Tugas, Pengaturan), kotak user di bawah (avatar inisial, nama, email terpotong, chip role) + tombol **Keluar**. Konten maks 1100 px, header halaman = judul + subjudul. |
| SuperAdmin | Menu hanya **Admin Panel** (+ Pengaturan, Keluar) di kedua layout (D-04) |

Detail wajib: link "Lewati ke konten" (skip link); landmark `header/nav/main`; item aktif `aria-current="page"`; hormati `env(safe-area-inset-*)` (notch iPhone/PWA standalone); tanpa `100vh` mentah (pakai `min-h-screen` + fallback `100dvh` bila didukung); FAB "Tambah tugas" hanya di mobile (di desktop tombol ada di header halaman); `useDocumentTitle` per halaman; scroll ke atas saat pindah rute; status bar tema biru.

**AC.** Screenshot 360×640, 768×1024, 1280×800 untuk Mahasiswa & SuperAdmin sesuai tabel; tidak ada scroll horizontal; sidebar tidak muncul < 1024; tab-order logis; BottomNav tidak menutupi konten terakhir (padding bawah cukup).

---

### ISSUE-037 — Klien API + TanStack Query
`P0 · M · Depends: 034` · NFR-03.1, NFR-03.2, NFR-06.2

**Langkah.**
1. `lib/api.ts`: `apiFetch<T>(path, {method, body, signal})` — base `/api/v1`, `credentials: 'same-origin'`, header `Content-Type: application/json`, timeout 15 s (`AbortController`), parsing error → `ApiError{status,code,message,fields}`; jaringan putus → `NetworkError`. **Tidak ada token di JS.**
2. Respons 401 pada selain `/auth/login|register|me` → bersihkan cache & arahkan ke `/login` (satu kali, hindari loop).
3. `queryClient`: `staleTime 30 s`, `retry` hanya untuk GET & error jaringan (maks 2), `refetchOnWindowFocus: true`, `refetchOnReconnect: true`; daftar tugas/dashboard `refetchInterval: 60_000` saat tab terlihat.
4. Kunci query terpusat (`qk.tasks(filter)`, `qk.dashboard`, `qk.categories`, `qk.me`, …). Setelah mutasi tugas/kategori/mood → `invalidateQueries` untuk dashboard + tugas + rekomendasi (FR-02.5, FR-10 "analytics terupdate otomatis", FR-07.6).
5. Mutasi status tugas **optimistik** dengan rollback bila gagal.
6. **Auto-sync (NFR-03.1: maks 5 detik):** setiap perubahan dikirim ke server **segera** (tanpa tombol sinkron manual); jika gagal, tampilkan toast error dan pertahankan data input. Perubahan dari perangkat lain tampil ≤ 60 detik / saat jendela difokuskan.
7. `useNow(intervalMs=60000)` untuk memperbarui teks relatif ("2 hari lagi") tanpa refetch.

**AC.** Test dengan MSW: error validasi menghasilkan `fields`; 401 mengalihkan sekali; mutasi sukses meng-invalidate query yang benar; mematikan jaringan menghasilkan toast "Tidak ada koneksi" dan form tidak kosong.

---

### ISSUE-038 — State autentikasi & route guard
`P0 · M · Depends: 037, 036` · FR-09.7, 09.10, 09.11 · UC #9, #10

**Langkah.**
1. `useAuth()` = `useQuery(['me'])` → `GET /auth/me`. Saat boot tampilkan **splash** (logo) sampai status diketahui — jangan berkedip ke halaman login.
2. Rute: publik `/login`, `/register`; privat Mahasiswa `/`, `/tugas-kuliah`, `/tugas-pribadi`, `/tugas/baru`, `/tugas/:id/edit`, `/ai`, `/kategori`, `/pengaturan`; privat SuperAdmin `/admin`, `/pengaturan`. `ProtectedRoute(role)` & `PublicOnlyRoute`. Role salah → arahkan ke beranda role-nya (Mahasiswa `/`, SuperAdmin `/admin`). Menu **disembunyikan** untuk role yang tidak berhak (tetapi keamanan sesungguhnya ada di server).
3. Parameter `?from=` setelah login: **hanya terima path internal** yang diawali satu `/` dan bukan `//` atau skema (cegah *open redirect*); selain itu abaikan.
4. Logout (`UC #10`): dialog "Yakin ingin keluar dari akun?" → tombol "Ya, Keluar" → `POST /auth/logout` → bersihkan **seluruh** query cache, draf form, dan (lihat Issue 055) hapus langganan push perangkat ini → arahkan ke `/login` + toast "Anda telah logout".
5. Sinkron lintas tab: `BroadcastChannel('swp-auth')` — logout/login di satu tab memengaruhi tab lain.

**AC.** Membuka `/admin` sebagai Mahasiswa → diarahkan ke `/`. `/login?from=//evil.com` setelah login → ke beranda, bukan ke evil.com. Logout di tab A → tab B pindah ke `/login` dalam < 2 detik. Refresh halaman saat login → tetap login (cookie).

---

### ISSUE-039 — Internasionalisasi (id default, en opsional)
`P0 · M · Depends: 034` · NFR-02.2 · D-25

**Langkah.**
1. `i18n/id.json` & `i18n/en.json`; key semantik berhierarki (`common.save`, `auth.login.title`, `tasks.form.errors.endBeforeStart`, `rec.reason.light`). Kode lama memakai teks Indonesia sebagai key — **jangan ditiru**. Pindahkan terjemahan EN dari objek `EN` di `app.js` lama.
2. Urutan penentuan bahasa: `user.locale` → `localStorage('swp_lang')` (halaman publik) → `navigator.language` → `id`. Ubah `<html lang>`.
3. Format tanggal/angka lewat `Intl` dengan locale + `user.timezone`.
4. Peta kode error Zod/server → pesan i18n (Issue 015).
5. Aturan lint: `eslint-plugin-i18next` (`no-literal-string`) pada JSX; test paritas: kunci `id.json` ≡ `en.json`.
6. **Teks wajib dari SKPL (harus persis di bahasa Indonesia):**

| Konteks | Teks |
|---|---|
| Login gagal | Email atau password tidak valid |
| Register sukses | Selamat datang di StudyWork Planner! |
| Konfirmasi hapus tugas | Apakah Anda yakin ingin menghapus tugas ini? |
| Hapus tugas sukses | Tugas berhasil dihapus |
| Konfirmasi hapus kategori | Apakah Anda yakin ingin menghapus kategori ini? |
| Konfirmasi hapus user | Apakah Anda yakin ingin menghapus user ini? Semua data terkait (tugas, mood, kategori) akan ikut terhapus. |
| Logout | Konfirmasi tombol "Ya, Keluar"; notifikasi "Anda telah logout" |
| Hapus user | tombol "Ya, Hapus" |
| Daftar kosong | Belum ada tugas |
| Rekomendasi kosong | Tidak ada tugas untuk direkomendasikan saat ini |
| Widget mood | Bagaimana Perasaanmu Hari Ini? · tombol "Dapatkan Rekomendasi" |
| Self-care | Sepertinya Anda perlu istirahat. Cobalah ambil napas dalam atau lakukan peregangan singkat. |
| Tombol | Tambah Tugas Baru · Simpan Perubahan · Tambah Kategori · Tambah User · Daftar Sekarang · Masuk · Daftar · Batal · Simpan |
| Dashboard | 4 Tugas Terdekat · Akses Cepat |

**AC.** Mengganti bahasa di Pengaturan langsung mengubah seluruh UI tanpa reload; test paritas kunci hijau; tidak ada string literal tersisa di JSX (lint hijau).

---

### ISSUE-040 — Primitif Dialog, Toast, Konfirmasi, Menu + tombol Back
`P0 · M · Depends: 035` · UC #2, #10 · Golden Rules (4.1.1) · pengganti `swpBack` lama

**Langkah.**
1. `Modal` (Radix Dialog): **bottom-sheet** di < 768 px, dialog tengah di ≥ 768 px; fokus terjebak di dalam, `Esc` menutup, klik di luar menutup (kecuali `sticky`), `aria-labelledby`, kembalikan fokus ke pemicu, kunci scroll latar.
2. `useConfirm()` → `await confirm({title,text,okLabel,danger})` mengembalikan `boolean` (menggantikan `confirm()` bawaan). Dipakai oleh hapus tugas/kategori/user & logout.
3. `ToastProvider` (Radix Toast; **bukan** `sonner`/pustaka yang menyuntik `<style>` saat runtime karena akan diblokir CSP — Issue 059): posisi tengah-bawah **di atas BottomNav & safe-area**, `aria-live="polite"`, varian sukses/error/info, auto-hilang 3–4 detik, tombol aksi opsional.
4. `useBackToClose(open, onClose)`: saat dialog terbuka → `history.pushState`; tombol Back (fisik Android/gesture/browser) menutup dialog **bukan** meninggalkan halaman; saat ditutup manual → `history.back()` agar riwayat bersih. Wajib bekerja di mode PWA standalone.
5. `DropdownMenu` (Radix) untuk menu kebab kategori (Edit/Hapus) — bisa dioperasikan keyboard, `aria-label` menyebut nama item.

**AC.** Test: fokus kembali ke tombol pemicu; `Esc` menutup; Back menutup dialog dan tetap di halaman yang sama; screen reader membaca judul dialog; toast tidak menutupi BottomNav.

---

# E11 — HALAMAN FRONTEND (UISW01–UISW09)

> Tiap halaman harus: punya state **loading (skeleton)**, **error (dengan tombol "Coba lagi")**, **kosong**, dan **sukses**; berfungsi di 360 px s.d. 1280 px; seluruh teks lewat i18n; semua interaksi bisa dengan keyboard; target sentuh ≥ 44 px.

### ISSUE-041 — UISW01 Login Page
`P0 · M · Depends: 011, 038, 035` · FR-09.4–09.7 · UC #9 · D-26

**Spesifikasi (ikuti mockup SKPL: kartu di tengah, latar gradasi biru muda).**
- Logo (kotak biru membulat + ikon topi wisuda) + "StudyWork Planner" + subjudul "Masuk ke akun Anda".
- Field **Email** (`type=email`, `inputmode=email`, `autocomplete=username`, placeholder `nama@email.com`) — validasi format **real-time** (setelah field disentuh); **Password** (`autocomplete=current-password`, placeholder "Masukkan password", tombol mata).
- Checkbox **"Ingat Saya"** (persistent session). **Default: tidak dicentang** (aman untuk perangkat bersama; PO boleh membalik).
- Tombol "Masuk" (full-width, biru), loading + disabled saat submit; `Enter` mengirim.
- Footer: "Belum punya akun? **Daftar Sekarang**" → `/register`.
- Error server `INVALID_CREDENTIALS` → banner `role="alert"`: "Email atau password tidak valid". `RATE_LIMITED` → "Terlalu banyak percobaan. Coba lagi dalam {n} menit." Jaringan putus → pesan koneksi.
- **Jangan** menampilkan kredensial demo (kode lama menampilkannya — T-02).
- Setelah sukses: toast "Berhasil masuk" → Mahasiswa `/`, SuperAdmin `/admin` (atau `from` yang valid).

**AC.** Manajer password (Chrome/Safari) menawarkan simpan & isi otomatis; fokus awal di Email; pesan error dibacakan screen reader; tidak ada perbedaan pesan untuk email tak terdaftar vs password salah; sudah login → membuka `/login` mengalihkan ke beranda.

---

### ISSUE-042 — UISW02 Register Page
`P0 · M · Depends: 010, 041` · FR-09.1–09.3 · UC #8 · D-01

**Spesifikasi.** Judul "Buat Akun Baru"; field: **Nama Lengkap** (wajib, min 3), **Email** (wajib, valid, unik), **Password** (wajib, min **8** — placeholder "Minimal 8 karakter"; indikator kekuatan non-blokir), **Konfirmasi Password** (harus sama). Tombol primer "Daftar" (full-width) dan sekunder "Batal" (→ `/login`). Footer "Sudah punya akun? **Masuk di sini**".
- Validasi inline real-time per field (Zod dari `shared`, pesan i18n) + menampilkan `fields` dari server (mis. `EMAIL_TAKEN` pada field Email).
- Kirim `timezone` hasil `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Sukses: sesi otomatis aktif → toast "Selamat datang di StudyWork Planner!" → `/`.

**AC.** Semua aturan D-01 diuji (7 karakter ditolak, 8 diterima); `Batal` kembali ke login tanpa menyimpan; tombol tidak bisa diklik ganda (tidak ada akun ganda).

---

### ISSUE-043 — UISW03 Dashboard
`P0 · L · Depends: 028, 044 (komponen item tugas & popup detail — kerjakan 044 lebih dulu), 036` · FR-10.1–10.4 · UC #5 · NFR-01.1

**Spesifikasi.** (Mobile satu kolom; desktop ≥ 1024 px: kartu analytics 4 kolom, "Tugas Terdekat" dan "Akses Cepat" berdampingan seperti mockup.)
1. Sapaan sesuai jam ("Selamat pagi/siang/sore/malam, {nama depan}") + tanggal.
2. **Banner pengingat** jika `dueWithin24h > 0`: "N tugas jatuh tempo / dimulai dalam 24 jam ke depan." (juga menjadi fallback bila push tidak aktif).
3. **4 kartu analytics** (Total Tugas, Total Waktu Pengerjaan, Prioritas Tinggi, Tugas Selesai) — grid 2×2 di mobile.
4. **Kartu mood**: jika belum ada mood hari ini → 5 tombol emoji + prompt (FR-03.1) yang memanggil `POST /moods`; jika sudah → ringkasan "Mood hari ini: … · Rekomendasi utama: {topPick}" yang menuju `/ai`.
5. **"4 Tugas Terdekat"**: kartu berisi nama, kategori (titik warna), deadline/waktu mulai + sisa waktu ("2 hari lagi" / **"Terlambat 3 jam"** merah). Klik → popup detail (komponen Issue 044).
6. **"Akses Cepat"** (grid 2×2): Tugas Kuliah, Tugas Pribadi, AI Recommendation, Kategori (tombol besar dengan ikon & sub-teks, mis. "4 aktif").
7. **"Semua Tugas"** + filter **Waktu** (Semua/Hari ini/Minggu ini/Bulan ini), **Kategori**, **Tipe** (FR-10.3) — disimpan di URL query. Aksi langsung: tambah, edit, hapus, tandai selesai (FR-10.4).
8. Kartu analytics & daftar ter-update otomatis setelah perubahan tugas (invalidate query).

**AC.** Lighthouse mobile (Slow 4G, CPU 4×): dashboard interaktif < 3 detik (NFR-01.1; lihat Issue 063). Akun baru tanpa tugas melihat empty state dengan CTA "Tambah Tugas". Tugas terlambat tampil merah. Semua aksi di dashboard memperbarui kartu tanpa reload halaman.

---

### ISSUE-044 — UISW04 / UISW05 Daftar Tugas Kuliah & Pribadi + popup detail
`P0 · L · Depends: 022, 023, 036, 040` · FR-01.4–01.7, FR-02.3–02.4 · UC #2, #3, #4

**Satu komponen `TaskListPage scope="kuliah|pribadi"`** (judul "Tugas Kuliah"/"Tugas Pribadi", subjudul "N tugas aktif").
1. **4 kartu analytics** versi scope (Total Tugas Kuliah / Total Waktu Pengerjaan / Prioritas Tinggi / Tugas Kuliah Selesai).
2. **Action bar:** tombol "Tambah Tugas" (kanan atas, primer — di mobile juga FAB), **search box** (debounce 300 ms), dropdown **Prioritas** (Semua/TOP/HIGH/MEDIUM/LOW), **Status** (Semua/Aktif/Selesai), **Urutkan** (Prioritas/Deadline/Terbaru). Filter tersimpan di URL (refresh/Back tidak menghilangkan filter) dan **update tanpa reload**.
3. **Item tugas:** `TriStateCheckbox` (belum → sedang → selesai → belum), judul tebal, `CategoryBadge`, tipe (Fixed-time/Deadline/Routine), waktu + sisa waktu, `PriorityBadge`. Tugas `DONE`: dicoret, redup, **berpindah ke bawah** (UC #3 langkah 6). Klik checkbox **tidak** membuka detail.
4. **Popup detail** (klik item; tutup via klik luar / tombol close / Esc / Back): judul, badge, deskripsi (teks biasa, `white-space: pre-wrap`), waktu mulai/selesai/deadline/estimasi, hari rutin + jam, kategori, kepentingan, kesulitan, **rincian skor** ("= U 8.1 × I 5 × D 1.1"), **waktu reminder berikutnya**, tombol **Edit Tugas** (→ `/tugas/:id/edit`) dan **Hapus Tugas** (konfirmasi *"Apakah Anda yakin ingin menghapus tugas ini?"* → "OK" → toast "Tugas berhasil dihapus", daftar ter-refresh).
5. Teks bantuan kecil: "Ketuk kotak untuk mengubah status".
6. "Muat lebih banyak" bila `total > limit`.

**AC.** Skenario UC #2/#3/#4 lolos di E2E. Judul berisi `<script>` / emoji / 100 karakter tampil sebagai teks biasa & tidak merusak layout (`break-words`). Pembaca layar membacakan status checkbox ("belum", "sebagian/sedang", "selesai").

---

### ISSUE-045 — UISW09 Form Tambah / Edit Tugas
`P0 · L · Depends: 022, 021, 044, 040` · FR-01.1–01.3, FR-02.1–02.2, FR-05.1 · UC #1 · D-06, D-31, D-35, D-36

**Spesifikasi (urutan field sesuai SKPL):**
1. Header: "Tambah Tugas Baru" / "Edit Tugas".
2. **Judul Tugas** (wajib, ≤ 100; placeholder "Contoh: Quiz Matematika Diskrit"), **Deskripsi** (opsional, ≤ 1000; placeholder "Tambahkan deskripsi tugas...").
3. **Tipe Tugas** (dropdown wajib: Fixed-time / Deadline / Routine) dan **Kategori Tugas** (dropdown wajib, dikelompokkan Kuliah/Pribadi, terisi dari `GET /categories`, tautan "+ Kelola kategori").
4. **Field dinamis** (berubah real-time saat tipe diganti, nilai yang sudah diisi pada tipe lain tidak hilang):
   - Fixed-time: *Waktu Mulai*, *Waktu Selesai* (`DateTimeField`).
   - Deadline: *Deadline* (`DateTimeField`), *Estimasi Durasi Pengerjaan* (angka, sufiks "jam", langkah 0.5, min 0.5).
   - Routine: *Hari Rutin* (checkbox Senin–Minggu, min 1), *Jam Mulai* (time), *Durasi per Sesi* (jam, default 1) — D-28.
5. **Tingkat Kesulitan** & **Tingkat Kepentingan** (dropdown 1–5 berlabel): Kesulitan `1 Sangat Mudah · 2 Mudah · 3 Sedang · 4 Sulit · 5 Sangat Sulit`; Kepentingan `1 Tidak Penting · 2 Kurang Penting · 3 Cukup Penting · 4 Penting · 5 Critical`.
6. **Pratinjau prioritas langsung** ("Perkiraan prioritas: HIGH (score 27.4)") memakai fungsi `priority()` dari `shared` — memenuhi FR-02.1/02.2 secara visual.
7. Tombol: "Batal" (sekunder → halaman sebelumnya) dan "Tambah Tugas" / "Simpan Perubahan" (primer).
8. **Validasi** (Zod `shared`, pesan di bawah field, fokus ke error pertama): semua wajib terisi; selesai > mulai; durasi ≥ 0.5; ≥ 1 hari rutin. Peringatan non-blokir bila waktu di masa lalu (D-31).
9. **Draf otomatis (NFR-03.2)** hanya untuk mode *tambah*: simpan ke `localStorage` kunci `swp_draft_<userId>` (debounce 500 ms), TTL 7 hari; saat kembali tampilkan "Lanjutkan draf sebelumnya? [Lanjutkan] [Buang]"; dihapus setelah simpan/batal/logout. Jangan simpan data lain di localStorage.
10. **Penjaga perubahan belum tersimpan:** bila form kotor, Batal/Back/tutup tab meminta konfirmasi.
11. Alur Simpan: validasi → `POST /tasks/conflicts` → jika ada konflik → **Issue 046**; jika tidak → `POST/PATCH /tasks` → toast "Tugas berhasil ditambahkan" / "Perubahan tersimpan" → arahkan ke `/tugas-kuliah` atau `/tugas-pribadi` sesuai **tipe kategori** yang dipilih (SKPL UISW09). Tombol Simpan dinonaktifkan selama proses (cegah dobel).
12. Layout: halaman penuh di < 768 px dengan bar aksi menempel di bawah (hormati keyboard virtual & safe-area), **modal** di ≥ 768 px (D-35). Mode edit: `GET /tasks/:id`; 404 → kembali + toast.

**AC.** Tiga skenario SKPL (edit Fixed-time, tambah Deadline, tambah Routine) sesuai mockup halaman 49–51. Mengganti tipe tidak menghapus judul/deskripsi. Draf pulih setelah refresh; hilang setelah simpan. Tab-order benar; iOS tidak zoom saat fokus input (font ≥ 16 px). Pratinjau prioritas sama persis dengan hasil server.

---

### ISSUE-046 — Dialog konflik jadwal
`P0 · M · Depends: 024, 045` · FR-04.1–04.6 · UC #1 langkah 8–9

**Spesifikasi (port dari `showConflict()` lama).** Judul **"Konflik Jadwal Terdeteksi"**; daftar peringatan:
- 🟥 *Bentrok* dengan "{judul tugas}" ({waktu}).
- 🟨 *Jeda* dengan "{judul}" hanya **{n} menit** (disarankan ≥ 30 menit).
- 🟨 *Beban* {tanggal}: **{x} jam** — melebihi kapasitas harian {kapasitas} jam.

Pilihan solusi (FR-04.4, 04.5):
1. **Pakai jadwal saran** (hanya jika `suggestedSlot`): isi ulang field waktu lalu **cek konflik lagi otomatis** (FR-04.6); batasi agar tidak berputar tanpa akhir (maks 3 kali berturut-turut, lalu tampilkan pesan).
2. **Atur Ulang Jadwal** → tutup dialog, kembali ke form.
3. **Hapus tugas prioritas rendah** ("{judul}" ({label})) → konfirmasi → `DELETE /tasks/:id` → lanjut simpan (hanya jika `lowPriorityCandidate`).
4. **Tetap Simpan** → simpan apa adanya.
Jika pengecekan konflik gagal karena jaringan: tampilkan error & tombol "Coba lagi" (jangan diam-diam menyimpan).

**AC.** Skenario E2E: buat Quiz 09:00–10:30 lalu Rapat 10:15–11:30 → dialog muncul dengan bentrok + saran 11:00 (10:30 + 30 menit, dibulatkan 15 menit); memilih saran menyimpan di 11:00 tanpa dialog lagi. Dialog bisa dioperasikan keyboard dan dibacakan screen reader.

---

### ISSUE-047 — UISW06 AI Recommendation
`P0 · L · Depends: 026, 027, 036, 040` · FR-03.1–03.3, FR-06.1–06.4, FR-08.1 · UC #7 · D-13, D-15

**Spesifikasi (sesuai SKPL + mockup hal. 43–44, 48–49):**
1. Header "AI Recommendation" + subjudul "Dapatkan rekomendasi tugas yang sesuai dengan kondisi mental dan energimu saat ini".
2. Kartu "Mood terakhir: {emoji} {label} · {tanggal jam}" (jika ada).
3. Section **"Bagaimana Perasaanmu Hari Ini?"**: 5 tombol emoji urut **Sangat Baik → Sangat Buruk** (😄 🙂 😐 😟 😢), `role="radiogroup"`; yang dipilih diberi highlight (border + latar). Di bawahnya kartu energi, mis. "Netral — Medium Energy · Cocok untuk tugas ringan-menengah".
4. Tombol **"Dapatkan Rekomendasi"** (full-width, primer; nonaktif sampai mood dipilih) → `POST /moods` lalu `GET /recommendations`.
5. **Self-care (FR-08.1):** mood 1 → alert hijau/biru lembut berisi saran lengkap (napas, peregangan, istirahat, hubungi orang tepercaya/layanan konseling kampus). Mood 2 → tip ringan. Kartu **"Self-Care Tip"** dengan tombol refresh (pilih acak dari `tipKeys`).
6. **Daftar rekomendasi:** nomor urut, judul, badge **Top Pick** (peringkat 1), `PriorityBadge`, **"{n}% match"**, alasan (kalimat dari `reasonKey`), chip: kategori, "Kesulitan 3/5", "Kepentingan 3/5", deadline/waktu mulai, estimasi waktu pengerjaan. Klik → popup detail.
7. **"Saran Ditunda"** (FR-06.4) bila ada.
8. **Real-time (FR-06.3):** setelah rekomendasi pertama tampil, mengganti mood langsung memperbarui hasil (debounce 400 ms, batalkan request lama).
9. Kosong: "Tidak ada tugas untuk direkomendasikan saat ini".
10. Catatan kecil: "Rekomendasi berbasis aturan (rule-based), bukan saran medis. Jika kamu merasa sangat tertekan, hubungi orang terdekat atau layanan konseling kampus/profesional." Teks ini **harus ditinjau PO** (Pertanyaan P-06).
11. Riwayat mood 7 terakhir (deretan emoji).

**AC.** Waktu tampil rekomendasi < 3 detik (NFR-01.2). Mood 1 selalu menampilkan alert self-care. Mengganti mood 5→2 mengubah daftar tanpa klik tombol lagi. Seluruh tombol mood punya label teks (bukan hanya emoji) untuk screen reader.

---

### ISSUE-048 — UISW07 Kategori Tugas
`P0 · M · Depends: 021, 036, 040` · FR-07.1–07.6 · UC #6 · D-09

**Spesifikasi.** Header "Kategori Tugas" + subjudul "Kelola kategori untuk tugas Anda"; tombol **"Tambah Kategori"** (kanan atas, primer).
- Dua panel: **Kategori Kuliah** | **Kategori Pribadi** (berdampingan di desktop, bertumpuk di mobile). Kolom: **Warna** (titik), **Nama** (+ jumlah tugas), **Tipe**, **Aksi** (tombol titik tiga → menu **Edit** / **Hapus**).
- **Modal form** tambah/edit: *Nama Kategori* (wajib, maks 50, penghitung karakter), *Pilih Warna* (12 swatch + custom color), *Tipe Kategori* (Kuliah/Pribadi), tombol "Simpan" & "Batal". Error nama duplikat dari server (`NAME_TAKEN`) tampil di bawah field.
- **Hapus:** konfirmasi *"Apakah Anda yakin ingin menghapus kategori ini?"*. Bila kategori dipakai → dialog kedua: "Kategori ini dipakai {n} tugas. Pindahkan ke: [dropdown kategori lain] lalu hapus" (kirim `reassignTo`).
- Mengubah **tipe** kategori yang sudah dipakai → konfirmasi "N tugas akan pindah ke halaman Tugas {Pribadi/Kuliah}".
- FR-07.6: dropdown di form tugas otomatis memuat kategori terbaru (invalidate query `categories`).
- Semantik tabel: gunakan `<table>`/`role="table"` dengan `<th>` agar pembaca layar mengerti kolom.

**AC.** Skenario E2E UC #6 (tambah → muncul di dropdown form tugas → edit → hapus yang tak terpakai). Tidak bisa menyimpan warna selain `#RRGGBB`. Menu kebab bisa dioperasikan keyboard.

---

### ISSUE-049 — UISW08 Admin Panel
`P0 · L · Depends: 033, 036, 040` · FR-11.1–11.4 · UC #11 · D-04

**Spesifikasi.**
- Hanya SuperAdmin. Header "Admin Panel" + subjudul "Kelola semua user dalam sistem".
- **3 kartu statistik**: Total Users, Total Mahasiswa, Total SuperAdmin.
- Bar aksi: tombol **"Tambah User"** (kanan atas, primer) + pencarian nama/email.
- **Tabel** (desktop): Nama · Email · Role (badge Mahasiswa/SuperAdmin) · Tanggal Registrasi · Aksi (ikon **pensil** Edit, ikon **tong sampah** Hapus). Di mobile jadi kartu. Paginasi/“muat lebih banyak” (limit 50). Baris milik sendiri diberi tanda "(Anda)".
- **Modal Tambah/Edit:** Nama Lengkap (wajib), Email (wajib, valid), Password (**wajib saat tambah**, opsional saat edit — placeholder "Kosongkan jika tidak diubah"), Role (Mahasiswa/SuperAdmin), "Simpan"/"Simpan Perubahan" & "Batal".
- **Hapus:** konfirmasi *"Apakah Anda yakin ingin menghapus user ini? Semua data terkait (tugas, mood, kategori) akan ikut terhapus."*, tombol "Ya, Hapus". Tombol hapus **nonaktif** (dengan tooltip/alasan terbaca) untuk akun sendiri; error `LAST_SUPERADMIN` ditampilkan jelas.
- Kartu statistik & tabel ter-update otomatis setelah aksi.
- Jangan menampilkan `passwordHash` atau data tugas user mana pun.

**AC.** Skenario E2E UC #11. Mahasiswa yang mengetik URL `/admin` diarahkan keluar. Tidak bisa menghapus/menurunkan SuperAdmin terakhir (UI + server).

---

### ISSUE-050 — Halaman Pengaturan
`P1 · M · Depends: 012, 039, 036` · D-12, D-18, D-19, D-20, D-25

**Spesifikasi (`/pengaturan`, tersedia untuk kedua role):**
1. **Profil**: ubah nama (email hanya tampil).
2. **Bahasa**: Indonesia / English (langsung berlaku, disimpan di `user.locale`).
3. **Zona waktu**: dropdown (default terdeteksi; daftar pendek WIB/WITA/WIT + opsi "Lainnya…" dengan pencarian IANA). Mengubahnya memicu sync ulang reminder routine (Issue 029).
4. **Kapasitas beban harian** (jam, 1–24, langkah 0.5) — dipakai deteksi overcommitment.
5. **Notifikasi** (Issue 055) dan **Pasang Aplikasi** (Issue 054).
6. **Ganti password** *(P2 — di luar SKPL, tetapi praktik keamanan dasar)*: `POST /me/password {currentPassword,newPassword}` → verifikasi password lama, aturan D-01, **revoke semua sesi lain**, sesi saat ini tetap.
7. **Tentang**: versi aplikasi (`__APP_VERSION__`), tautan Kebijakan Privasi (Issue 060), tombol **Keluar**.

**AC.** Perubahan tersimpan lewat `PATCH /me` dan bertahan setelah refresh/di perangkat lain; zona waktu tidak valid → ditolak server.

---

### ISSUE-051 — State umum: kosong / error / offline / 404 + data contoh
`P1 · M · Depends: 036, 037` · NFR-06.2 · SKPL UC #4 ("Belum ada tugas")

**Langkah.**
1. `ErrorBoundary` global (UI ramah: "Terjadi kesalahan. [Muat ulang]"; kirim ID kesalahan ke log, **bukan** detail teknis ke pengguna).
2. Halaman 404 ("Halaman tidak ditemukan" + tombol ke beranda), 403.
3. `OfflineBanner` di atas konten ketika `navigator.onLine === false` atau request gagal jaringan: "Anda sedang offline. Perubahan tidak dapat disimpan." Hilang otomatis saat `online` + refetch.
4. Skeleton untuk dashboard/daftar/rekomendasi (hindari layout shift).
5. **Empty state** konsisten: ikon + judul + penjelasan + CTA (Dashboard/Daftar tugas: "Belum ada tugas · Tambahkan tugas pertamamu untuk mulai", Filter kosong: "Tidak ada tugas yang cocok dengan filter").
6. *(P2)* Tombol **"Coba dengan contoh tugas"** pada empty state akun baru → `POST /tasks/sample` membuat 8 tugas contoh relatif terhadap hari ini (adaptasi `seedSample()` lama; endpoint hanya aktif untuk Mahasiswa yang punya 0 tugas) — membantu NFR-02.1 (tugas pertama < 3 menit tanpa tutorial). Pastikan mudah dihapus.

**AC.** Mematikan jaringan di DevTools menampilkan banner offline; memutus API menampilkan state error dengan tombol "Coba lagi"; URL ngawur → 404 bukan layar putih.

---
# E12 — PWA (BISA DI-INSTALL, TETAP BERBASIS WEB)

> Target: aplikasi dapat dipasang dari **Chrome/Edge (Android & desktop)**, **Samsung Internet**, **Safari iOS/iPadOS ("Tambahkan ke Layar Utama")**, dan berjalan mandiri (tanpa bilah alamat) dengan ikon, splash, notifikasi, dan update otomatis — sambil tetap satu codebase web.

### ISSUE-052 — Web App Manifest, ikon, dan meta tag
`P0 · M · Depends: 034` · NFR-05.1 · T-07

**Langkah.**
1. Master logo `public/logo.svg` (ambil dari ikon lama: kotak biru + topi wisuda; vektor sumber ada di `legacy/.../res/drawable/ic_launcher_*.xml`). Hasilkan ikon dengan `@vite-pwa/assets-generator` atau alat setara:
   - `icons/icon-192.png`, `icons/icon-512.png` (purpose `any`),
   - `icons/maskable-512.png` (purpose `maskable`, konten utama dalam **zona aman 80 %**),
   - `apple-touch-icon.png` 180×180 (tanpa transparansi),
   - `favicon.svg` + `favicon.ico`, `icons/badge-72.png` (monokrom putih, untuk notifikasi Android).
2. `manifest.webmanifest`:
```json
{
  "id": "/",
  "name": "StudyWork Planner",
  "short_name": "StudyWork",
  "description": "Kelola tugas kuliah & pribadi dengan prioritas otomatis dan rekomendasi sesuai mood.",
  "lang": "id",
  "dir": "ltr",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "background_color": "#F4F7FC",
  "theme_color": "#1D4ED8",
  "categories": ["productivity", "education"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Tambah Tugas", "url": "/tugas/baru", "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }] },
    { "name": "Rekomendasi AI", "url": "/ai", "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }] }
  ],
  "screenshots": [
    { "src": "/screenshots/mobile-dashboard.png", "sizes": "540x960", "type": "image/png", "form_factor": "narrow" },
    { "src": "/screenshots/desktop-dashboard.png", "sizes": "1280x800", "type": "image/png", "form_factor": "wide" }
  ]
}
```
   > **Jangan** mengunci `orientation` (kode lama mengunci portrait — buruk untuk tablet/desktop).
3. `index.html`: `<link rel="manifest">`, `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color" content="#1D4ED8">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-title" content="StudyWork">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, viewport `viewport-fit=cover` (tanpa `maximum-scale`/`user-scalable`).
4. Layar splash: Chrome membuatnya otomatis dari `background_color` + ikon 512; iOS memakai `apple-touch-startup-image` (P2, boleh dilewati).
5. Tampilan standalone: tambahkan padding `env(safe-area-inset-*)`, cegah *overscroll* memantul pada elemen `fixed` (`overscroll-behavior: none` pada body bila perlu), dan pastikan tidak ada elemen yang bergantung pada bilah alamat.

**AC.** Chrome DevTools → Application → Manifest: **tanpa peringatan**, ikon & maskable terlihat benar (cek di maskable.app); "Installable" ✓.

---

### ISSUE-053 — Service Worker (Workbox `injectManifest`)
`P0 · L · Depends: 052` · FR-05.2 · NFR-05, D-17

**Langkah.**
1. `vite-plugin-pwa` dengan `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, `registerType: 'prompt'`, `injectRegister: null` (didaftarkan manual di `main.tsx` lewat `virtual:pwa-register` agar tidak ada skrip inline → CSP aman), `manifest: false` (pakai file manual Issue 052), `devOptions.enabled: false` (uji SW pada `npm run build && npm run preview`).
2. `src/sw.ts`:
```ts
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);            // shell: html/js/css/ikon ber-hash
cleanupOutdatedCaches();
// SPA fallback — KECUALI /api (jangan pernah menyajikan index.html untuk API)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting(); });

self.addEventListener('push', (event) => {
  const d = event.data?.json() ?? {};
  // WAJIB selalu showNotification (Safari/iOS mencabut izin jika push "diam-diam")
  event.waitUntil(self.registration.showNotification(d.title ?? 'StudyWork Planner', {
    body: d.body, tag: d.tag, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png',
    data: { url: typeof d.url === 'string' ? d.url : '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin);
  if (target.origin !== self.location.origin) return;           // tolak URL luar
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins[0];
    if (w) { await w.focus(); if ('navigate' in w) await w.navigate(target.href); }
    else await self.clients.openWindow(target.href);
  })());
});
```
3. **Jangan meng-cache respons `/api/*` di Service Worker** (data pribadi; berisiko bocor di perangkat bersama setelah logout). API selalu lewat jaringan.
4. `pushsubscriptionchange`: coba berlangganan ulang dan beri tahu klien (opsional; minimal jangan menimbulkan error).
5. Header server (Issue 067): `sw.js`, `index.html`, `manifest.webmanifest` → `Cache-Control: no-cache`; `/assets/*` → `immutable` 1 tahun.
6. Pastikan SW mengikuti CSP (`worker-src 'self'`) dan tidak memakai `importScripts` dari domain luar.

**AC.** Setelah build+preview: SW terdaftar & aktif (DevTools → Application); mematikan jaringan lalu me-refresh membuka shell aplikasi (bukan halaman error browser); `fetch('/api/v1/healthz')` tidak pernah dijawab dari cache SW; push uji (Issue 030 `POST /push/test`) muncul saat tab ditutup; klik notifikasi membuka/mengfokus aplikasi pada URL tujuan.

---

### ISSUE-054 — UX pemasangan aplikasi (Add to Home Screen)
`P0 · M · Depends: 053, 050` · permintaan: "bisa di-install di mobile atau di web"

**Langkah.** Hook `useInstall()`:
1. **Chromium (Android/desktop/Edge/Samsung):** tangkap event `beforeinstallprompt` → `preventDefault()` dan simpan; tombol **"Pasang Aplikasi"** (di Pengaturan, Drawer/Sidebar) memanggil `prompt()` lalu membaca `userChoice`. Event `appinstalled` → sembunyikan tombol + toast "Aplikasi terpasang".
2. **iOS/iPadOS Safari** (tidak ada `beforeinstallprompt`): deteksi (UA iOS + bukan standalone) → tombol membuka *sheet* instruksi bergambar: **Bagikan (ikon kotak-panah) → Tambahkan ke Layar Utama → Tambah**. Catat bahwa notifikasi push di iOS **hanya** berfungsi setelah terpasang (iOS ≥ 16.4) — D-18.
3. **Browser lain / Firefox:** tampilkan petunjuk generik "Buka menu browser → *Instal aplikasi* / *Tambahkan ke layar utama*". (Firefox desktop tidak mendukung instal PWA — tampilkan pesan bahwa situs tetap bisa dipakai biasa.)
4. Deteksi sudah terpasang/standalone: `matchMedia('(display-mode: standalone)').matches || navigator.standalone` → sembunyikan semua ajakan.
5. **Banner ajakan opsional (tidak mengganggu — SKPL 2.5c):** tampil paling banyak sekali per 30 hari, hanya setelah pengguna membuat ≥ 1 tugas atau pada kunjungan ke-3; dapat ditutup (simpan penutupan di `localStorage`); tidak pernah menutupi konten penuh atau memblokir.
6. Bila `display-mode: standalone`, tombol "Kembali" aplikasi (Issue 040) harus tetap berfungsi dan tidak ada tautan keluar domain yang membuka halaman tanpa kontrol navigasi (buka di tab browser: `target="_blank" rel="noopener"`).

**AC.** Diuji nyata: (a) Chrome Android → terpasang, ikon di launcher, terbuka tanpa bilah alamat; (b) Chrome/Edge desktop → jendela aplikasi sendiri; (c) iPhone Safari → ikut instruksi → terpasang; (d) setelah terpasang, tombol "Pasang" hilang; (e) kunjungan berikutnya tidak menampilkan banner jika sudah ditutup.

---

### ISSUE-055 — Alur izin & langganan notifikasi (client)
`P0 · M · Depends: 030, 053, 050` · FR-05.2 · D-18, D-19

**Langkah.** Di Pengaturan → "Notifikasi pengingat":
1. Deteksi dukungan: `'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window`. Tidak didukung → pesan jelas + (iOS belum terpasang) "Pasang aplikasi ke Layar Utama dulu".
2. Tombol **"Aktifkan notifikasi"** → *di dalam handler klik* panggil `Notification.requestPermission()` → bila `granted`: ambil `GET /push/public-key`, `registration.pushManager.subscribe({userVisibleOnly:true, applicationServerKey})` → `POST /push/subscriptions`.
3. Status yang ditampilkan: *Aktif*, *Dimatikan*, *Diblokir oleh browser* (petunjuk cara membuka blokir: ikon gembok → Izinkan notifikasi), *Tidak didukung*.
4. Tombol **"Kirim notifikasi uji"** → `POST /push/test`.
5. Matikan: `subscription.unsubscribe()` + `DELETE /push/subscriptions`.
6. Saat login/app dibuka: bila izin sudah `granted` tetapi server belum punya langganan perangkat ini → daftarkan ulang diam-diam. Saat **logout**: hapus langganan perangkat ini dari server (cegah notifikasi akun lama muncul di perangkat bersama).
7. **Jangan** meminta izin otomatis saat halaman dimuat. Setelah user pertama kali membuat tugas ber-deadline, boleh tampil *ajakan halus* sekali ("Aktifkan pengingat agar tidak lupa deadline?") — dapat ditutup, tidak diulang.
8. Fallback bila push tidak aktif: banner pengingat di dashboard (Issue 043).

**AC.** Alur lengkap diuji di Android Chrome, desktop Chrome/Edge/Firefox, dan iPhone (terpasang). Menolak izin tidak menimbulkan error/loop. Logout membuat server tidak lagi mengirim ke perangkat itu.

---

### ISSUE-056 — Alur pembaruan aplikasi (update SW)
`P1 · S · Depends: 053` · NFR-07.1, NFR-07.2

**Langkah.** `registerSW({ onNeedRefresh, onOfflineReady })` → toast **persisten** "Versi baru tersedia · [Muat ulang]" (jangan memuat ulang otomatis bila form tugas sedang diisi/kotor). Klik → kirim `SKIP_WAITING` lalu `location.reload()` setelah `controllerchange`. Cek pembaruan saat aplikasi difokuskan dan tiap 60 menit (`registration.update()`). Tampilkan versi di Pengaturan. Kebijakan kompatibilitas API: perubahan skema/endpoint **hanya aditif** satu rilis (klien lama yang masih ter-cache tidak boleh rusak) — lihat Issue 070.

**AC.** Deploy v2 → pengguna yang membuka v1 melihat toast; setelah klik, versi baru berjalan dan data form tidak hilang.

---

### ISSUE-057 — Perilaku offline & jaringan buruk
`P1 · S · Depends: 053, 051` · SKPL 2.5(b), 2.6 · D-17

**Langkah.**
1. Tanpa jaringan: shell terbuka (precache) → `OfflineBanner`; semua aksi tulis menampilkan "Tidak ada koneksi. Perubahan belum tersimpan." dan **tidak** menghapus input; draf form (Issue 045) tetap ada.
2. Data terakhir yang sudah dimuat tetap tampil dari cache React Query (memori) dengan penanda "mungkin tidak terbaru".
3. Event `online` → refetch otomatis + toast "Kembali online".
4. *(P2)* Persistensi cache baca ke IndexedDB (`@tanstack/query-persist-client`) maksimum 24 jam, **dihapus saat logout**, tidak menyimpan hasil `/auth` — agar aplikasi terpasang bisa menampilkan data terakhir secara read-only saat offline.

**AC.** Simulasi offline (DevTools) pada aplikasi terpasang: terbuka, banner tampil, mencoba simpan → pesan jelas, input utuh; kembali online → data tersinkron.

---

# E13 — KEAMANAN & PRIVASI

### ISSUE-058 — Paket uji keamanan otomatis
`P0 · L · Depends: 013, 044, 049` · Bagian 9

**Buat test (API + E2E) untuk setiap butir berikut; semua harus hijau di CI:**
| Area | Uji |
|---|---|
| IDOR | Matriks user A vs B untuk tiap endpoint tugas/kategori/mood/push/reminder: baca, ubah, hapus → 404; `categoryId` milik user lain → ditolak |
| AuthZ | Mahasiswa → `/admin/*` = 403; SuperAdmin → endpoint mahasiswa = 403; role tidak bisa diubah via `PATCH /me` atau register |
| Mass assignment | Body berisi `id,userId,role,createdAt,passwordHash,status` → diabaikan/ditolak |
| Sesi/JWT | `alg=none`, secret salah, token kedaluwarsa, sesi revoked, cookie tanpa sesi DB → 401; cookie flag lengkap |
| CSRF | `POST` dengan `Origin` asing → 403; `Content-Type` form → 415 |
| XSS | Isi `<img src=x onerror=…>`, `"><script>`, `javascript:` pada judul, deskripsi, nama kategori, nama user → tampil **sebagai teks** di semua halaman (Playwright memastikan `window.__xss` tidak pernah di-set) |
| SQLi | `' OR 1=1 --`, `%`, `_`, `\` pada `q`, email, nama |
| Rate-limit | Login, register, push test, global |
| Enumerasi | Pesan & status login identik; waktu tidak berbeda signifikan |
| Race | Hapus/turunkan SuperAdmin terakhir paralel; register email sama paralel |
| Open redirect | `?from=//evil.com`, `?from=https://evil.com`, `?from=/\evil.com` |
| Log | Menjalankan seluruh suite lalu `grep` log: tidak ada password, cookie, token, `passwordHash` |
| Input ekstrem | Judul 10 000 karakter → 400; emoji/RTL/zero-width tidak merusak UI |
| SSRF push | Endpoint non-allowlist ditolak |
Manual (sekali sebelum go-live): **OWASP ZAP baseline scan** terhadap staging; simpan laporan di `docs/security/`.

**AC.** Suite berjalan di CI; laporan ZAP tidak memuat temuan High/Medium yang belum ditangani.

---

### ISSUE-059 — Header keamanan & CSP (verifikasi)
`P0 · S · Depends: 053; konfigurasi final ada di Caddy (Issue 067) — kerjakan bersamaan dengan 067` · Bagian 9

**Langkah.** Terapkan di Caddy (Issue 067) lalu verifikasi:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```
1. Jalankan dulu sebagai `Content-Security-Policy-Report-Only` di staging, buka **semua halaman & fitur** (termasuk dialog, toast, color picker, SW, push) dan perbaiki pelanggaran. Pustaka yang menyuntik `<style>`/skrip inline **diganti**, bukan dilonggarkan. Hanya jika benar-benar tak terhindarkan, `'unsafe-inline'` untuk `style-src` (bukan `script-src`) boleh dipertimbangkan oleh senior dengan ADR.
2. Target skor **Mozilla Observatory ≥ A** dan securityheaders.com ≥ A.
3. `frame-ancestors 'none'` memastikan tidak bisa di-iframe (anti-clickjacking).

**AC.** Tidak ada pelanggaran CSP di console pada seluruh alur E2E; skor sesuai target.

---

### ISSUE-060 — Privasi & perlindungan data pribadi
`P1 (halaman & retensi) / P2 (ekspor & hapus akun) · M · Depends: 050, 033`

**Konteks.** Aplikasi menyimpan nama, email, daftar tugas, dan **data mood (kondisi mental)** — perlakukan sebagai data pribadi yang sensitif (UU PDP No. 27/2022; konsultasikan dengan PO/pihak berwenang kampus).
**Langkah.**
1. Halaman statis **Kebijakan Privasi** (id/en): data apa yang dikumpulkan, tujuan, retensi, hak pengguna, kontak; tautan dari Register, Pengaturan, dan footer login. Teks final dari PO/Prodi (Pertanyaan P-07).
2. Catatan singkat sekali pada halaman AI: "Data mood hanya digunakan untuk rekomendasi dan hanya dapat dilihat olehmu."
3. **Retensi:** mood > 12 bulan dihapus otomatis oleh worker (angka bisa dikonfigurasi).
4. **Minimisasi:** tidak ada analitik pihak ketiga, tidak ada font/CDN eksternal, tidak ada pelacak. Cookie hanya cookie sesi yang esensial (tidak perlu banner persetujuan cookie).
5. *(P2)* `GET /me/export` (unduh semua data user sebagai JSON) dan `DELETE /me` (hapus akun sendiri; wajib input ulang password; ditolak bila SuperAdmin terakhir; revoke semua sesi; cascade penuh).

**AC.** Halaman privasi dapat diakses tanpa login; job retensi teruji; (P2) ekspor memuat tugas, kategori, mood milik user saja.

---

# E14 — QA / PENGUJIAN

### ISSUE-061 — Strategi test & target cakupan
`P0 · M · Depends: 020, 022, 044` · semua NFR

| Lapis | Alat | Target |
|---|---|---|
| Unit domain (`shared`) | Vitest | **≥ 90 %** baris/cabang `domain/` |
| Integrasi API (route + DB nyata) | Vitest + Supertest + PostgreSQL | **Setiap endpoint**: sukses, validasi gagal, 401, 403, 404; cakupan baris ≥ 80 % |
| Komponen FE | Vitest + Testing Library + MSW | Form tugas, login/register, dialog konflik, daftar tugas, tri-state checkbox |
| E2E | Playwright | Issue 062 |
| A11y | `axe-core` (otomatis di E2E) | 0 pelanggaran serious/critical |
| Performa | Lighthouse CI, autocannon/k6 | Issue 063 |
Praktik: factory data uji (`makeUser`, `makeTask`), DB di-reset per test file (truncate), **tanpa** bergantung urutan test, waktu dikontrol (fake timers / parameter `now`). Gate CI: coverage di bawah target → merge diblokir.

**AC.** Laporan coverage tampil di PR; angka target tercapai.

---

### ISSUE-062 — E2E Playwright berbasis Use Case SKPL
`P0 · L · Depends: 046, 047, 048, 049, 055` · semua UC

Jalankan di **Chromium, Firefox, WebKit** + emulasi **Pixel 7** dan **iPhone 14**. Skenario minimal:

| ID | Skenario | Hasil yang diperiksa |
|---|---|---|
| E2E-01 | UC #8 Register | validasi (email salah, password < 8, konfirmasi beda), sukses → dashboard + toast; 11 kategori default |
| E2E-02 | UC #9 Login/Logout | salah password → pesan SKPL; "Ingat Saya" on/off (tutup-buka konteks browser); logout dengan konfirmasi + toast; Back setelah logout tidak menampilkan data |
| E2E-03 | UC #1 Tambah tugas ×3 tipe | field dinamis; validasi; pratinjau prioritas; redirect sesuai tipe kategori; reminder terbuat (lewat API) |
| E2E-04 | UC #1 Konflik | dialog muncul; pakai saran; tetap simpan; hapus tugas prioritas rendah |
| E2E-05 | UC #1 Edit | ubah waktu → reminder & prioritas berubah; cek ulang konflik |
| E2E-06 | UC #3 Tandai selesai | siklus 3 status; dicoret & pindah ke bawah; analytics berubah; reminder CANCELLED |
| E2E-07 | UC #2 Hapus | dialog konfirmasi teks persis; batal vs OK; toast; reminder hilang |
| E2E-08 | UC #4 Daftar | filter prioritas/status, sort 3 mode, search; tanpa reload |
| E2E-09 | UC #5 Dashboard | 4 kartu, 4 tugas terdekat, akses cepat 4 tombol, filter waktu/kategori/tipe |
| E2E-10 | UC #6 Kategori | tambah → muncul di dropdown form; edit; hapus terpakai → alur pindahkan |
| E2E-11 | UC #7 Mood/AI | 5 mood; mood 1 → self-care; ganti mood → daftar berubah; kosong → pesan SKPL |
| E2E-12 | UC #11 Admin | tambah/edit/hapus user; tidak bisa hapus diri/SuperAdmin terakhir; statistik berubah |
| E2E-13 | Keamanan peran | Mahasiswa buka `/admin` → ditolak; SuperAdmin buka `/tugas-kuliah` → dialihkan |
| E2E-14 | PWA | manifest valid, SW aktif, offline → banner, instal-prompt tersedia (Chromium), notifikasi uji |
| E2E-15 | **Aturan 3 klik** | tabel di bawah |
| E2E-16 | Responsif | tangkapan layar 360/768/1280, tidak ada scroll horizontal |

**Tabel verifikasi "maksimal 3 klik" (SKPL 2.5c):**
| Fitur | Jalur klik | Σ |
|---|---|---|
| Tambah tugas | Dashboard → "Tambah Tugas" | 1 |
| Tugas Kuliah / Pribadi / AI / Kategori | Bottom-nav / sidebar / akses cepat | 1 |
| Edit tugas | Menu → klik tugas → "Edit Tugas" | 3 |
| Hapus tugas | Menu → klik tugas → "Hapus Tugas" (konfirmasi = bagian aksi) | 3 |
| Tandai selesai | Menu → checkbox (atau langsung dari dashboard) | 1–2 |
| Input mood | Dashboard → emoji (atau AI → emoji) | 1–2 |
| Tambah kategori | Kategori → "Tambah Kategori" | 2 |
| Pengaturan / Bahasa / Notifikasi (mobile) | ☰ → Pengaturan → toggle | 3 |
| Keluar | ☰ → Keluar → "Ya, Keluar" | 3 |
| Admin Panel | Sidebar/menu "Admin Panel" | 1 |

**AC.** Semua skenario hijau di CI (Chromium wajib; Firefox/WebKit/mobile minimal smoke E2E-01..03,06). Video/trace disimpan saat gagal.

---

### ISSUE-063 — Performa (NFR-01)
`P1 · M · Depends: 043, 044, 027` · NFR-01.1, 01.2, 01.3

**Anggaran & cara ukur:**
| Metrik | Target | Cara |
|---|---|---|
| Dashboard interaktif | **< 3 detik** (profil: Slow 4G, CPU ×4, HP kelas menengah) | Lighthouse CI + Playwright trace |
| LCP / INP / CLS (mobile) | ≤ 2.5 s / ≤ 200 ms / ≤ 0.1 | Lighthouse CI |
| JS awal (gzip) | ≤ 200 KB; halaman lain di-*lazy* | `vite-bundle-visualizer`, gate di CI |
| API `/dashboard`, `/tasks`, `/recommendations` | p95 < 300 ms dengan **150 tugas** (NFR-01.3 "100+ tugas aktif") | autocannon/k6 memakai user "perf" dari seed |
| Rekomendasi AI | **< 3 detik** end-to-end | trace |
| Render daftar 150 item | < 100 ms, tanpa jank saat scroll | React Profiler |
Langkah optimasi: kompresi Brotli/gzip/zstd di Caddy; `React.lazy` per rute; `React.memo` pada `TaskItem`; hindari re-render akibat `useNow` (isolasi komponen waktu relatif); `EXPLAIN ANALYZE` pada query daftar tugas dan pastikan memakai indeks `(user_id, status)`; tidak ada N+1 (Prisma `include`/`groupBy`); gambar/ikon SVG kecil.

**AC.** Laporan `docs/perf.md` berisi angka sebelum/sesudah dan memenuhi tabel di atas.

---

### ISSUE-064 — Matriks kompatibilitas browser & perangkat
`P0 · M · Depends: 062` · NFR-05.1, 05.2 · D-16

Uji manual (BrowserStack atau perangkat nyata) — isi tabel di `docs/compat.md`:
| Platform | Versi | Wajib diuji |
|---|---|---|
| Chrome desktop | **90** (batas bawah) dan terbaru | semua fitur |
| Edge desktop | 90 dan terbaru | semua fitur + instal |
| Firefox desktop | **88** dan terbaru | form (input date/time), semua fitur; push |
| Chrome Android | terbaru; Android 8.0 (Oreo) sesuai SKPL 4.3.1 | instal, push, back button, layar 5″ (360×640) |
| Samsung Internet | terbaru | instal, push |
| Safari iOS/iPadOS | 16.4+ (instal + push), 15.x (tanpa push) | instal manual, input tanggal, safe-area |
| Safari macOS | terbaru | semua fitur |
| Layar | 5″ (360×640), tablet 768, laptop 13″ (1280×800) | tata letak |
Per perangkat periksa: tata letak, input tanggal/jam, instal, push, update SW, cookie bertahan setelah tutup-buka, tombol Back, keyboard-only, zoom 200 %, mode gelap sistem (tidak boleh merusak kontras; aplikasi 1.0 tampil terang).
**Verifikasi dependensi di batas bawah:** jalankan build produksi di Chrome 90 / Firefox 88; bila ada pustaka yang gagal → polyfill terarah atau turunkan versi pustaka dan catat di `docs/compat.md`. Pastikan `eslint-plugin-compat` bersih. Hindari fitur yang tidak ada di batas bawah (mis. `structuredClone`, `Array.prototype.at`, `:has()`, container query, unit `dvh`) kecuali ada fallback.

**AC.** Tabel terisi, semua kegagalan memiliki issue/penyelesaian; keterbatasan (mis. iOS < 16.4 tanpa push) tercatat di Pengaturan & dokumentasi.

---

### ISSUE-065 — Uji kegunaan (SUS) & aksesibilitas
`P0 · M · Depends: 062` · NFR-02.1, 02.3

1. **Uji tugas pertama (NFR-02.1):** 5–8 mahasiswa baru, tanpa tutorial, instruksi: "Daftar lalu tambahkan satu tugas deadline". Ukur waktu; target **< 3 menit** untuk ≥ 90 % peserta. Catat titik bingung.
2. **Kuesioner SUS** (10 butir standar) setelah sesi; target **skor rata-rata ≥ 70** (NFR-02.3).
3. **Aksesibilitas:** axe otomatis 0 serious/critical; manual dengan **TalkBack (Android)** dan **VoiceOver (iOS)** untuk Login, Dashboard, Form tugas, Dialog; navigasi keyboard penuh; zoom 200 %; kontras ≥ 4.5:1; `prefers-reduced-motion`.
4. Temuan dicatat sebagai issue baru berlabel `ux`/`a11y`, dikerjakan sebelum rilis bila severity tinggi.

**AC.** Laporan `docs/usability.md` (waktu, skor SUS, temuan, tindak lanjut).

---

# E15 — DEVOPS & OPERASI

### ISSUE-066 — Dockerfile (api, worker, web)
`P0 · M · Depends: 031, 053` · NFR-06

**Langkah.** `docker/api.Dockerfile` multi-stage: (1) `node:22-bookworm-slim` build — `npm ci`, `prisma generate`, `tsc` build; (2) runtime — `npm ci --omit=dev`, salin `dist` + `prisma`, `USER node`, `ENV NODE_ENV=production`, `HEALTHCHECK` ke `/api/v1/healthz`. Image yang sama dipakai worker (`command: node dist/worker/index.js`). `docker/web.Dockerfile`: stage build Vite → keluaran statis disalin ke volume/image Caddy. `.dockerignore` (node_modules, .git, .env*, legacy, docs, coverage). Pindai image dengan **Trivy** di CI (gagal bila High/Critical yang punya perbaikan). Pin versi base image (tag spesifik, bukan `latest`).

**AC.** `docker build` sukses; container berjalan sebagai non-root (`docker exec … id`); ukuran image api < 300 MB; `argon2` berfungsi di dalam image.

---

### ISSUE-067 — Compose produksi + Caddy + hardening server
`P0 · L · Depends: 066` · NFR-04.2, NFR-06.1 · SKPL 2.4/4.2

**Langkah.**
1. VPS Ubuntu **22.04/24.04 LTS**, min 2 vCPU / 4 GB / SSD (SKPL). Buat user non-root `deploy`; SSH **hanya kunci** (matikan password & root login); `ufw` hanya 22/80/443; `fail2ban`; `unattended-upgrades`; sinkron waktu (`chrony`) — **reminder bergantung pada jam server**.
2. DNS domain → IP VPS. `docker-compose.prod.yml`: `caddy` (80/443, volume data/config untuk sertifikat), `api`, `worker`, `db` (`postgres:16`, **tanpa `ports:`** ke host, volume bernama, password kuat dari `.env` bermode 600), `restart: unless-stopped`, `logging: json-file max-size=10m max-file=5`, `healthcheck` untuk db/api/worker (worker: umur `/tmp/worker.alive` < 120 s).
3. `Caddyfile`:
```
{$DOMAIN} {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
		-Server
	}
	handle /api/* {
		reverse_proxy api:3000
	}
	handle {
		root * /srv/web
		@immutable path /assets/*
		header @immutable Cache-Control "public, max-age=31536000, immutable"
		@revalidate path /index.html /sw.js /manifest.webmanifest
		header @revalidate Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}
}
```
4. API di belakang proxy: `TRUST_PROXY=1`, `APP_ORIGIN=https://<domain>`, cookie `__Host-` aktif.
5. Staging terpisah (domain/subdomain lain, DB lain) dengan konfigurasi identik.

**AC.** `https://<domain>` valid (sertifikat otomatis), http→https redirect; port 5432 tidak terjangkau dari luar (`nmap`); `curl -I` menampilkan header keamanan; `/api/v1/healthz` OK; mematikan container api → Caddy mengembalikan 502 tanpa membocorkan detail.

---

### ISSUE-068 — Backup & pemulihan
`P0 · M · Depends: 067` · NFR-03 (data tidak boleh hilang)

**Langkah.** Cron harian (container/host): `pg_dump -Fc` → enkripsi (`age`) → unggah ke penyimpanan **di luar VPS** (mis. S3/Backblaze/GDrive terenkripsi). Retensi: 7 harian, 4 mingguan, 3 bulanan. Notifikasi bila backup gagal (email/Telegram). **Latihan restore** ke database kosong dan jalankan `smoke test` (hitung baris, login). Dokumentasikan di `docs/runbook.md`. Kunci enkripsi disimpan terpisah dari backup.

**AC.** Bukti restore berhasil (tanggal, ukuran, jumlah baris); backup otomatis berjalan 3 hari berturut-turut.

---

### ISSUE-069 — Monitoring, uptime, dan log
`P1 · S · Depends: 067` · NFR-06.1 (≥ 90 % uptime; target internal 99 %)

**Langkah.** Monitor eksternal (UptimeRobot/Better Stack) pada `/api/v1/readyz` tiap 1–5 menit + notifikasi email/Telegram; pantau juga sertifikat HTTPS (kedaluwarsa). Rotasi log Docker. Alert bila worker mati (healthcheck unhealthy) atau disk > 80 %. Log aplikasi JSON ke stdout; **tanpa PII**. *(P2)* error tracking (mis. Sentry) dengan *scrubbing* PII dan tanpa isi tugas/mood.

**AC.** Mematikan container api sengaja → alert diterima < 5 menit.

---

### ISSUE-070 — Proses rilis, migrasi aman, rollback
`P0 · M · Depends: 067, 005` · NFR-07.1, NFR-07.2

**Aturan:**
1. **Versi**: SemVer, tag git `vX.Y.Z`, `CHANGELOG.md`.
2. **Deploy** (`scripts/deploy.sh`): pull image bertag SHA → backup cepat DB → `prisma migrate deploy` → `docker compose up -d` → *smoke test* (`/readyz`, login akun uji, buat & hapus tugas uji) → gagal = rollback otomatis ke image sebelumnya.
3. **Migrasi *expand/contract*:** rilis N hanya **menambah** (kolom nullable/tabel baru, tetap kompatibel dengan kode N-1); rilis N+1 baru menghapus yang usang. Dilarang `DROP/RENAME` kolom dalam rilis yang sama dengan perubahan kode yang memakainya. Tujuan: update tanpa kehilangan data (NFR-07.1) dan klien PWA lama yang masih ter-cache tidak rusak.
4. **Rollback** = pasang kembali image sebelumnya; **jangan** me-rollback DB — perbaiki maju (*forward fix*).
5. **Hotfix** bug kecil (NFR-07.2): branch `fix/…`, PR cepat, deploy tanpa mengganggu fitur lain; API `/api/v1` stabil (breaking change → `/api/v2`).
6. Semua rilis lewat staging dulu.

**AC.** Latihan: rilis dengan migrasi aditif berhasil; rilis yang sengaja gagal smoke test ter-rollback otomatis; data tidak berubah.

---

### ISSUE-071 — Dokumentasi
`P1 · M · Depends: semua fitur utama`

- `README.md`: deskripsi, prasyarat (Node ≥ 22, Docker Desktop), setup **≤ 6 perintah** (`git clone`, `npm ci`, `cp .env.example .env`, `docker compose up -d db`, `npm run db:migrate`, `npm run dev`), daftar skrip, struktur folder, troubleshooting Windows (Docker Desktop/WSL2, port bentrok, modul native `argon2`, line-ending LF).
- `docs/api.md` (tabel endpoint Bagian 6 + contoh `curl`); *(P2)* OpenAPI dari Zod.
- `docs/adr/` — 0001 database, 0002 auth (Argon2id + JWT cookie + sesi), 0003 PWA & push, 0004 timezone, 0005 tanpa offline-write.
- `docs/runbook.md`: deploy, rollback, restore backup, rotasi `JWT_SECRET` (efek: semua user logout), rotasi VAPID (efek: semua langganan putus), menambah SuperAdmin, mencabut sesi user, memeriksa antrean reminder.
- `docs/user-guide-id.md` singkat: cara memasang di Android/iOS/desktop + cara mengaktifkan notifikasi (dengan tangkapan layar).
- `CONTRIBUTING.md` (aturan Bagian 0).

**AC.** Developer baru mengikuti README dan menjalankan aplikasi penuh dalam < 30 menit (uji dengan orang yang belum pernah melihat proyek).

---

# E16 — PENSIUN APLIKASI LAMA

### ISSUE-072 — Decommission APK & arsip
`P2 (setelah rilis & stabil 2 minggu) · S · Depends: 065, 070` · T-08, T-09

1. Pastikan UAT (Issue 065) lulus dan produksi stabil ≥ 2 minggu.
2. Beri tag `android-final` pada commit terakhir yang memuat `legacy/`; pindahkan `legacy/` ke branch `legacy-android` lalu hapus dari `main` (PR terpisah).
3. Hentikan distribusi APK lama; umumkan bahwa **data lama (tersimpan lokal di HP) tidak dimigrasikan** (Pertanyaan P-05). Bila PO mewajibkan migrasi, buat issue baru: rilis APK terakhir dengan tombol "Ekspor data (JSON)" + fitur "Impor" di web.
4. Keystore lama: simpan arsip offline terenkripsi; **jangan dipakai ulang** (passwordnya pernah terekspos). Bila kelak membungkus PWA ke Play Store (TWA/Bubblewrap), buat keystore baru.
5. Hapus `StudyWorkPlanner.apk.idsig` dan artefak build dari repo.

**AC.** `main` tidak memuat file Android; tag/branch arsip ada; pengumuman terkirim.

---

## 8. Matriks keterlacakan

> Nomor use case mengikuti **isi bab 3.2.1** SKPL (#1 Manage Tugas … #11 Manage All Users); daftar isi SKPL menomori sedikit berbeda.

### 8.1 Kebutuhan fungsional (FR)
| FR | Nama | Issue |
|---|---|---|
| 01 / 01.1 / 01.2 / 01.3 | CRUD, Tambah, Dynamic form, Edit | 015, 022, 044, 045 |
| 01.4 | Mark complete (tri-state) | 023, 044 |
| 01.5 | Hapus + konfirmasi | 022, 044 |
| 01.6 | Filter tugas | 022, 043, 044 |
| 01.7 | Analytics view | 025, 043, 044 |
| 02 / 02.1 / 02.2 | Prioritas otomatis, urgency, priority | 017, 045 (pratinjau) |
| 02.3 / 02.4 | Sort & label warna | 022, 035, 044 |
| 02.5 / 02.6 | Recalc otomatis / setelah hapus | 017, 022, 037 |
| 03 / 03.1 / 03.2 / 03.3 | Mood input/update/basis rekomendasi | 019, 026, 043, 047 |
| 04 / 04.1 / 04.2 / 04.3 | Deteksi tabrakan, buffer 30 mnt, overcommit | 018, 024 |
| 04.4 / 04.5 | Saran solusi & keputusan user | 018, 046 |
| 04.6 | Recheck saat edit | 024, 045, 046 |
| 05 / 05.1 | Reminder otomatis H-1 | 020, 029 |
| 05.2 | Push notification | 030, 031, 032, 053, 055 |
| 05.3 / 05.4 / 05.5 | Cancel saat selesai / update / hapus | 022, 023, 029 |
| 06 / 06.1 / 06.2 | Rekomendasi AI, analisis, energy-task match | 019, 027, 047 |
| 06.3 | Adaptif real-time saat mood berubah | 047 |
| 06.4 | Saran tunda | 019, 047 |
| 06.5 | Fallback rule-based | 019 |
| 07 / 07.1–07.5 | Manajemen kategori | 021, 048 |
| 07.6 | Dropdown kategori otomatis update | 037, 045, 048 |
| 08 / 08.1 | Self-care | 019, 027, 047 |
| 09 / 09.1 / 09.2 / 09.3 | Register, validasi, hashing | 010, 015, 042 |
| 09.4 / 09.5 / 09.6 / 09.7 | Login, validasi, sesi, redirect | 011, 038, 041 |
| 09.8 / 09.9 | Logout + hapus sesi | 012, 038 |
| 09.10 / 09.11 | Cek sesi / sesi persisten | 011, 012, 038 |
| 10 / 10.1 / 10.2 | Dashboard, analytics, daftar | 028, 043 |
| 10.3 / 10.4 | Filter & aksi di dashboard | 043 |
| 11 / 11.1–11.4 | Kelola semua user | 033, 049 |

### 8.2 Kebutuhan non-fungsional (NFR)
| NFR | Isi | Issue |
|---|---|---|
| 01.1 Dashboard < 3 s | | 028, 043, 063 |
| 01.2 AI < 3 s | | 019, 027, 047, 063 |
| 01.3 100+ tugas tanpa lag | | 022, 063 |
| 02.1 Tugas pertama < 3 menit | | 051, 065 |
| 02.2 Bahasa Indonesia (+Inggris) | | 039, 050 |
| 02.3 SUS ≥ 70 | | 065 |
| 03.1 Auto-sync ≤ 5 s | | 037 |
| 03.2 Auto-save | | 037, 045 |
| 03 (data tidak hilang) | | 007, 068 |
| 04.1 Hash bcrypt/argon2 | | 010 |
| 04.2 HTTPS | | 067, 059 |
| 05.1 Responsif desktop+mobile | | 036, 064 |
| 05.2 Browser modern | | 034, 064 |
| 06.1 Uptime ≥ 90 % | | 069 |
| 06.2 Data tidak hilang saat refresh | | 007, 045 |
| 07.1 Update tanpa hapus data | | 007, 056, 070 |
| 07.2 Perbaikan bug kecil tanpa ganggu fungsi | | 070 |

### 8.3 Antarmuka & use case
| UI / UC | Issue |
|---|---|
| UISW01 Login | 041 |
| UISW02 Register | 042 |
| UISW03 Dashboard | 028, 043 |
| UISW04/05 Tugas Kuliah/Pribadi | 044 |
| UISW06 AI Recommendation | 026, 027, 047 |
| UISW07 Kategori | 021, 048 |
| UISW08 Admin Panel | 033, 049 |
| UISW09 Form Tugas (+ dialog konflik) | 045, 046 |
| UC #1 Manage Tugas | 022, 024, 029, 045, 046 |
| UC #2 Hapus | 022, 044 |
| UC #3 Tandai selesai | 023, 044 |
| UC #4 Lihat daftar | 022, 025, 044 |
| UC #5 Dashboard | 028, 043 |
| UC #6 Kategori | 021, 048 |
| UC #7 Input mood | 026, 027, 047 |
| UC #8 Register | 010, 042 |
| UC #9 Login | 011, 041 |
| UC #10 Logout | 012, 038 |
| UC #11 Manage users | 033, 049 |
| SKPL 4.1.3 komponen GUI (textbox, dropdown, radio→dropdown D-06, checkbox, date picker, button, search, cards) | 035, 044, 045 |
| SKPL 4.4 (JSON REST, JWT, auto-save AJAX) | 006, 011, 037 |
| SKPL 4.5 (rule-based, Face Emotion = ditunda D-15) | 017, 019 |

---

## 9. Checklist keamanan

> Centang dengan bukti (nomor issue/PR/test). **Semua P0 harus lengkap sebelum go-live.**

**Autentikasi & sesi**
- [ ] Password di-hash **Argon2id** (m≥19 MiB, t≥2, p=1) di **server**; tidak pernah di-log (010)
- [ ] Kebijakan password 8–128, ditegakkan di server (010)
- [ ] JWT HS256, `alg` dipaksa, secret ≥ 32 byte dari env (011)
- [ ] Cookie `HttpOnly; Secure; SameSite=Lax; Path=/`, prefix `__Host-` di produksi (011)
- [ ] Sesi di DB, bisa direvoke; logout menghapus sesi; ID sesi baru tiap login (011, 012)
- [ ] Kedaluwarsa: 12 jam (tanpa "Ingat Saya") / 30 hari (dengan) (011)
- [ ] Semua sesi dicabut saat password/role berubah atau user dihapus (033)
- [ ] Rate-limit login/register + anti-enumerasi (014)
- [ ] Tidak ada akun/kredensial default; admin pertama dari env (008)

**Otorisasi**
- [ ] RBAC dibaca dari DB, bukan klaim token (013)
- [ ] Semua query data user memakai `userId`; resource orang lain → 404 (013, 058)
- [ ] `categoryId`/`reassignTo` divalidasi kepemilikan (013, 021)
- [ ] SuperAdmin tidak bisa membaca data tugas/mood mahasiswa (013, 033)
- [ ] SuperAdmin terakhir terlindungi (aman race) (033)

**Input/Output**
- [ ] Validasi Zod `.strict()` di server untuk semua body/query/param (015)
- [ ] Tidak ada `dangerouslySetInnerHTML`/`innerHTML`; warna kategori divalidasi `#RRGGBB` (021, 035)
- [ ] Prisma terparameter; `LIKE` di-escape (022)
- [ ] Batas ukuran body 100 KB; panjang field dibatasi (009, 015)
- [ ] Redirect `?from=` hanya path internal (038)
- [ ] Anti-SSRF pada endpoint push (030)

**Transport & header**
- [ ] HTTPS wajib, HSTS, redirect http→https (067)
- [ ] CSP ketat tanpa `unsafe-inline` skrip, `frame-ancestors 'none'`, header lain (059)
- [ ] Tanpa CORS lintas origin; cek `Origin` untuk mutasi; hanya JSON (009)
- [ ] Respons API terautentikasi `Cache-Control: no-store`; SW tidak meng-cache `/api` (009, 053)

**Rahasia & rantai pasok**
- [ ] `.env` tidak di-commit; gitleaks aktif; rahasia produksi di server saja (001, 003)
- [ ] `npm audit` (high+) & Trivy & CodeQL di CI; Dependabot aktif; lockfile di-commit (005, 066)
- [ ] Keystore/kredensial lama tidak ada di repo (001)

**Operasional**
- [ ] DB tidak terekspos publik; firewall; SSH kunci saja (067)
- [ ] Backup terenkripsi di luar VPS + restore teruji (068)
- [ ] Log tanpa PII/rahasia (006, 058)
- [ ] Penetration baseline (ZAP) bersih dari High/Medium (058)
- [ ] Container non-root, image dipin & dipindai (066)

---

## 10. Checklist tampilan / UX / aksesibilitas

- [ ] **Mobile-first**; diuji 360×640 (layar 5″), 768, 1280; tidak ada scroll horizontal (036)
- [ ] **Sidebar kiri** di desktop; bottom-nav + drawer di mobile (036)
- [ ] Skema warna **biru dominan**; prioritas merah/kuning/hijau konsisten, selalu dengan label teks (035)
- [ ] Font sans-serif sistem, isi 14–16 px, **input ≥ 16 px**, badge ≥ 12 px (035)
- [ ] Posisi & gaya tombol aksi (Tambah/Edit/Hapus) konsisten di semua halaman (035)
- [ ] Semua aksi destruktif memakai **dialog konfirmasi** (040)
- [ ] Minimalis: satu aksi primer per layar; tidak ada pop-up mengganggu / dark pattern (SKPL 2.5c)
- [ ] State **loading/skeleton, kosong, error, offline** di setiap halaman (051)
- [ ] Teks wajib SKPL persis (039)
- [ ] Bisa **zoom** (tanpa `maximum-scale`) (034, 052)
- [ ] Target sentuh ≥ 44 px; jarak antar tombol cukup (035)
- [ ] Keyboard-only penuh; fokus terlihat; urutan tab logis; skip-link (035, 036)
- [ ] Label form terhubung ke input; error dibacakan (`aria-describedby`, `role="alert"`) (035)
- [ ] Kontras ≥ 4.5:1; informasi tidak hanya lewat warna (035)
- [ ] Dialog: fokus terjebak & kembali; Esc; Back menutup dialog (040)
- [ ] `prefers-reduced-motion` dihormati (035)
- [ ] Safe-area (notch) aman dalam mode standalone (036, 052)
- [ ] Emoji mood punya teks alternatif (047)
- [ ] Tanggal/waktu diformat sesuai locale & zona user (039)
- [ ] Teks panjang/emoji/RTL tidak merusak tata letak (`break-words`) (044, 058)
- [ ] Mode terang saja untuk 1.0; tidak rusak jika OS dalam mode gelap (064)
- [ ] Ikon konsisten (Lucide), ukuran seragam (035)

---

## 11. Checklist PWA

- [ ] HTTPS valid (067) · `manifest.webmanifest` lengkap, tanpa peringatan DevTools (052)
- [ ] Ikon 192/512, **maskable**, apple-touch-icon 180, favicon (052)
- [ ] `display: standalone`, `start_url`, `scope`, `id`, `theme_color`, `background_color`, shortcuts, screenshots (052)
- [ ] Service Worker aktif; shell ter-precache; fallback navigasi SPA; **`/api` tidak di-cache** (053)
- [ ] Prompt instal Chromium; instruksi iOS; sembunyi bila sudah terpasang (054)
- [ ] Push: izin hanya setelah klik; langganan tersimpan; klik notifikasi membuka tujuan; logout menghapus langganan (030, 031, 055)
- [ ] Update: toast "Versi baru tersedia" tanpa merusak form (056)
- [ ] Offline: shell terbuka + banner + pesan aksi ditolak (057)
- [ ] Diuji instal di: Chrome Android, Samsung Internet, Chrome/Edge desktop, Safari iOS (064)
- [ ] Catatan: Lighthouse versi baru **tidak lagi punya kategori PWA** — verifikasi instalabilitas lewat DevTools → Application dan uji perangkat nyata.
- [ ] Tip uji di HP tanpa deploy: Chrome desktop memperlakukan `localhost` sebagai aman; untuk HP gunakan tunnel HTTPS (mis. `cloudflared tunnel --url http://localhost:5173`) atau `adb reverse tcp:5173 tcp:5173` lalu buka `localhost:5173` di Chrome Android.

---

## 12. Rencana pengujian & UAT

**Sprint (saran, 1 senior + 1–2 junior; estimasi kasar ±85–100 orang-hari termasuk review):**
| Sprint | Fokus | Issue |
|---|---|---|
| 1 | Persiapan, fondasi BE, domain shared | 001–009, 015–020 |
| 2 | Auth, Kategori, Tugas, scaffold FE | 010–014, 021–025, 034–040 |
| 3 | Mood/AI, Dashboard API, Reminder/Push, Admin API, halaman Login/Register/Dashboard/Daftar | 026–033, 041–044 |
| 4 | Form tugas, konflik, AI, Kategori, Admin, Pengaturan, state umum | 045–051 |
| 5 | PWA, keamanan, QA | 052–058, 060–064 |
| 6 | DevOps, header/CSP, dokumentasi, staging, uji kegunaan & UAT, go-live, pensiun legacy | 059, 065–072 |

**Kriteria penerimaan rilis 1.0 (UAT oleh PO + 5–8 mahasiswa):**
1. Semua FR berprioritas **Critical & High** lulus (matriks 8.1) dan semua E2E hijau.
2. NFR terukur terpenuhi: dashboard < 3 s, AI < 3 s, 150 tugas lancar, SUS ≥ 70, tugas pertama < 3 menit, uptime selama uji coba ≥ 90 %.
3. Instal & notifikasi berhasil di minimal: 1 Android (Chrome), 1 iPhone (iOS ≥ 16.4 terpasang), 1 desktop (Chrome/Edge).
4. Checklist Bagian 9, 10, 11 terpenuhi; tidak ada bug **Blocker/Critical** terbuka.
5. Severity bug: *Blocker* (data hilang/keamanan/tidak bisa login) · *Critical* (fitur inti rusak) · *Major* · *Minor*. Rilis hanya bila Blocker/Critical = 0 dan Major terdokumentasi dengan rencana.

---

## 13. Di luar lingkup & pertanyaan terbuka

### 13.1 Tidak dikerjakan di 1.0 (backlog)
| Item | Alasan |
|---|---|
| Menu **Timeline** (ada di mockup, tidak ada di FR) | Perlu spesifikasi (P-01) |
| **Face Emotion Detection** (TensorFlow.js) | Opsional di SKPL; privasi kamera, bobot model, risiko NFR-01.2 (D-15) |
| Integrasi Google Calendar/Outlook | Dilarang SKPL 2.5 |
| Mode offline penuh (tulis offline + sinkron) | SKPL 2.5(b); fase berikutnya (D-17) |
| Bungkus Play Store (TWA/Bubblewrap) | PWA sudah memenuhi "install"; opsional kelak |
| Mode gelap | Tidak diminta |
| Undo hapus (toast "Urungkan") | P2 (D-33) |
| Login sosial / 2FA / lupa password via email | Tidak ada di SKPL — **catatan:** tanpa "lupa password", pemulihan akun lewat SuperAdmin (Admin Panel → edit password). Usulkan ke PO sebagai fase 2 |
| LLM sungguhan untuk rekomendasi | Opsional; antarmuka sudah siap (019) |

### 13.2 Pertanyaan untuk Product Owner (jawab sebelum Sprint 3 bila memungkinkan)
| ID | Pertanyaan | Default yang dipakai jika tidak ada jawaban |
|---|---|---|
| P-01 | Menu "Timeline" di mockup: dibutuhkan? Apa isinya? | Tidak dibuat |
| P-02 | Password minimal 8 (D-01) disetujui? | 8 |
| P-03 | Tugas **Routine** ditandai "Selesai": artinya selesai hari ini, atau hentikan rutinitas? | Menghentikan rutinitas (reminder dibatalkan) |
| P-04 | Ambang label prioritas (36/24/12) dan kapasitas 8 jam/hari disetujui? | Ya |
| P-05 | Data pengguna aplikasi Android lama perlu dimigrasi? | Tidak dimigrasi |
| P-06 | Teks self-care/disclaimer kesehatan mental & rujukan layanan konseling kampus (nomor/tautan) | Teks pada Issue 047 |
| P-07 | Teks Kebijakan Privasi, nama pengelola data, kontak, masa retensi mood | Template + 12 bulan |
| P-08 | Nama domain & hosting yang disetujui; siapa pemilik akun VPS/DNS | — (blokir Issue 067) |
| P-09 | Self-registration SuperAdmin tidak diizinkan; bagaimana proses admin pertama & pemulihan password? | Env seed + reset oleh SuperAdmin |
| P-10 | "Ingat Saya" default tercentang atau tidak? | Tidak tercentang |
| P-11 | "Total Tugas" di kartu: semua tugas atau hanya aktif (D-08)? | Semua tugas |
| P-12 | Apakah SuperAdmin boleh punya tugas pribadi (kode lama ya, mockup tidak)? | Tidak (D-04) |

---

## 14. Final review sebelum go-live

Senior mengecek **ulang seluruhnya** (centang satu per satu, tulis nama + tanggal):

**Fungsional**
- [ ] Matriks 8.1/8.2/8.3 — setiap baris punya issue yang *merged* dan test hijau
- [ ] Semua teks wajib SKPL persis (Issue 039)
- [ ] Rumus prioritas identik dengan SKPL 4.5.2 & golden test (017)
- [ ] 3 tipe tugas × (tambah, edit, hapus, selesai) × (reminder, konflik) dicoba manual di HP nyata
- [ ] Mood 1..5 menghasilkan rekomendasi yang masuk akal; mood 1 menampilkan self-care
- [ ] SuperAdmin: tambah/edit/hapus user; aturan SuperAdmin terakhir

**Keamanan** — Bagian 9 lengkap; ZAP bersih; rahasia produksi unik (bukan dari `.env.example`); akun admin dari env sudah dipakai & password kuat; `grep -ri "admin123\|studywork123"` di seluruh repo (kecuali branch arsip) = kosong.

**Tampilan** — Bagian 10 lengkap; ulasan visual di 3 lebar layar & 3 browser; ikon/ splash benar saat terpasang.

**PWA** — Bagian 11 lengkap; instal & push di Android, iOS, desktop; update SW diuji.

**Operasional** — HTTPS; backup + restore teruji; monitoring + alert teruji; runbook lengkap; rollback teruji; zona waktu & jam server (chrony) benar; worker hidup.

**Dokumen** — README, ADR, runbook, panduan pengguna, kebijakan privasi final; `issues.md` diperbarui (centang status), pertanyaan terbuka terjawab.

> **Pesan terakhir dari senior:** jika ada instruksi di dokumen ini yang tampak bertentangan dengan SKPL atau tidak masuk akal saat kamu kerjakan — **berhenti dan tanya**, jangan mengarang. Lebih baik 10 menit bertanya daripada 2 hari memperbaiki. Dan ingat tiga hal yang paling sering salah pada proyek seperti ini: **(1) zona waktu, (2) filter `userId` di setiap query, (3) rahasia yang ikut ter-commit.** Periksa tiga hal itu di setiap PR.
