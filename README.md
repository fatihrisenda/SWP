# StudyWork Planner (SWP)

StudyWork Planner adalah aplikasi manajemen jadwal dan tugas mahasiswa berbasis Web & PWA (Progressive Web App) yang dibangun menggunakan arsitektur monorepo TypeScript (React 18, Express 5, Prisma ORM, dan PostgreSQL 16).

Proyek ini dikembangkan untuk tugas besar mata kuliah **Implementasi dan Pengujian Perangkat Lunak (CAK3BAB3-BS1IF)**, Program Studi S1 PJJ Informatika, Fakultas Informatika, Universitas Telkom (Kelompok 2 — Kelas IF-48-PJJ-02).

## Fitur Utama

- **Manajemen Tugas 3 Tipe:** Mendukung tugas `FIXED_TIME` (waktu mulai & selesai), `DEADLINE` (tenggat & durasi estimasi), dan `ROUTINE` (hari rutin ISO 1–7 & jam mulai), lengkap dengan status tri-state (`TODO`, `IN_PROGRESS`, `DONE`), filter multi-kriteria, dan pencarian.
- **Perhitungan Prioritas & Deteksi Konflik:** Skor prioritas dihitung dinamis berdasarkan urgensi waktu, tingkat kepentingan (1–5), dan kesulitan (1–5). Sistem juga mendeteksi bentrokan jadwal, jeda sempit (< 30 menit), kelebihan kapasitas harian, serta menyarankan slot kosong.
- **Rekomendasi Berbasis Mood:** Mencocokkan tingkat kesulitan tugas dengan kondisi mood harian (skala 1–5), menyarankan tugas berat untuk ditunda saat mood rendah, dan menampilkan tips self-care.
- **Kategori Kustom:** Setiap mahasiswa otomatis mendapat 11 kategori default (6 Kuliah, 5 Pribadi) saat mendaftar, dan dapat menambah/mengubah warna (`#RRGGBB`) atau memindahkan tugas sebelum menghapus kategori.
- **PWA & Web Push Notification:** Mendukung instalasi aplikasi di desktop maupun mobile lewat Service Worker (`sw.ts`) serta pengingat terjadwal menggunakan Web Push (VAPID) melalui background worker.
- **Keamanan & Panel Admin:** Hashing password Argon2id, sesi JWT pada cookie `HttpOnly` (`SameSite=Lax`), validasi input bersama dengan Zod dan Regex (`@swp/shared`), validasi parameter UUID, rate limiting, RBAC (`MAHASISWA` dan `SUPERADMIN`), serta peninjauan Log Audit Keamanan (`GET /api/v1/admin/audit-logs`).

## Struktur Direktori

```text
SWP/
├── apps/
│   ├── api/                # REST API (Express 5, TypeScript, Prisma ORM, PostgreSQL)
│   │   ├── prisma/         # schema.prisma, migrations/, seed.ts, seed.dev.ts
│   │   ├── src/            # routes/, middleware/, repositories/, services/, worker/, lib/
│   │   └── test/           # 140 integration & unit tests (Vitest + Supertest)
│   └── web/                # Frontend Web & PWA (React 18, Vite, Tailwind CSS)
│       ├── src/            # pages/, components/, lib/, i18n/ (id/en), sw.ts
│       └── test/           # 38 component & i18n tests (Vitest + Testing Library)
├── packages/
│   └── shared/             # Paket bersama (@swp/shared): domain logic & Zod/Regex schemas (67 unit tests)
├── docker/                 # Skrip inisialisasi database pengujian (swp_test)
├── docker-compose.yml      # Konfigurasi container PostgreSQL 16
└── package.json            # Skrip monorepo root
```

## Prasyarat

Pastikan perangkat sudah terpasang:

- **Node.js** v22+ dan **npm** v10+
- **Docker Desktop** (direkomendasikan untuk menjalankan PostgreSQL 16 secara instan) atau **PostgreSQL 16** lokal

## Cara Menjalankan di Lokal

### 1. Clone Repositori & Install Dependensi

```bash
git clone https://github.com/fatihrisenda/SWP.git
cd SWP
npm install
```

### 2. Siapkan File Environment

Salin template `apps/api/.env.example` menjadi `apps/api/.env`, lalu isi konfigurasi lokal berikut (untuk development kuliah):

```env
NODE_ENV=development
PORT=3000
APP_ORIGIN=http://localhost:5173
TRUST_PROXY=0
DATABASE_URL=postgresql://swp:swp_dev_password@localhost:5432/swp?schema=public
JWT_SECRET=T6kzqONbGXhJt4uvDimwI7RPvTKRSds0KqBM7y4DVvXzv6lx4jjFVW1uNOv0cjz3
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
SEED_ADMIN_NAME=Super Admin Dev
SEED_ADMIN_EMAIL=superadmin@dev.local
SEED_ADMIN_PASSWORD=UbahPasswordIni8
LOG_LEVEL=debug
```

Jika ingin menjalankan integration test backend (`npm test`), buat juga file `apps/api/.env.test`:

```env
NODE_ENV=test
PORT=3000
APP_ORIGIN=http://localhost:5173
TRUST_PROXY=1
DATABASE_URL=postgresql://swp:swp_dev_password@localhost:5432/swp_test?schema=public
JWT_SECRET=test-jwt-secret-key-at-least-32-characters-long-0123456789
SESSION_COOKIE_NAME=swp_session
SESSION_TTL_DEFAULT_HOURS=12
SESSION_TTL_REMEMBER_DAYS=30
ARGON2_MEMORY_KIB=4096
ARGON2_TIME_COST=2
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@contoh.id
REMINDER_POLL_SECONDS=30
RUN_WORKER=false
LOG_LEVEL=silent
```

### 3. Jalankan Database PostgreSQL 16

```bash
docker compose up -d db
```

Container `swp_db` otomatis membuat dua database: `swp` (development) dan `swp_test` (pengujian).

### 4. Generate Prisma Client, Migrasi, dan Seed Data

```bash
npx --workspace apps/api prisma generate
npx --workspace apps/api prisma migrate deploy
npm run db:seed -w apps/api
npm run db:seed:dev -w apps/api
```

Untuk menyiapkan skema database pengujian (`swp_test`), jalankan migrasi ke `swp_test`:

- **PowerShell (Windows):**
  ```powershell
  $env:DATABASE_URL="postgresql://swp:swp_dev_password@localhost:5432/swp_test?schema=public"
  npx --workspace apps/api prisma migrate deploy
  Remove-Item Env:DATABASE_URL
  ```
- **Bash (Linux/macOS):**
  ```bash
  DATABASE_URL="postgresql://swp:swp_dev_password@localhost:5432/swp_test?schema=public" npx --workspace apps/api prisma migrate deploy
  ```

### 5. Jalankan Aplikasi (API + Web)

```bash
npm run dev
```

Buka browser di **`http://localhost:5173`**.

## Akun Login Default (Hasil Seed Lokal)

Setelah menjalankan `db:seed` dan `db:seed:dev`, akun berikut langsung tersedia di database lokal (khusus kebutuhan development dan demo perkuliahan):

| Role | Email | Password | Keterangan |
|---|---|---|---|
| **SuperAdmin** | `superadmin@dev.local` | `UbahPasswordIni8` | Akses Panel Admin & Log Audit Keamanan (`/admin`). Dibuat dari `SEED_ADMIN_*` di `apps/api/.env`. |
| **Mahasiswa (Demo)** | `mahasiswa@dev.local` | `DemoPassword8` | Sudah berisi 11 kategori default dan 8 tugas contoh (`FIXED_TIME`, `DEADLINE`, `ROUTINE`). |
| **Mahasiswa (Uji Beban)** | `perf@dev.local` | `DemoPassword8` | Sudah berisi 150 tugas untuk uji performa daftar, filter, dan paginasi. |

### Registrasi Akun Baru (`/register`)

Pengguna juga dapat mendaftar akun mahasiswa baru di `http://localhost:5173/register`. Aturan validasi form registrasi (berlaku di browser dan server):

- **Nama Lengkap:** 3–100 karakter, hanya huruf dan pemisah nama wajar (spasi, titik, apostrof, tanda hubung), tanpa angka atau simbol.
- **Email:** Format email valid (`nama@domain.com`), maksimal 254 karakter, unik.
- **Password:** 8–128 karakter, wajib mengandung huruf besar, huruf kecil, angka, tanpa spasi, dan tidak boleh sama dengan nama atau email.
- **Konfirmasi Password:** Harus sama dengan password.

## Ringkasan Port & Service

| Service | Port / URL | Direktori |
|---|---|---|
| API Server (Express 5) | `http://localhost:3000` (`/api/v1`) | `apps/api` |
| Web Client & PWA (Vite) | `http://localhost:5173` (proxy `/api` ke `:3000`) | `apps/web` |
| PostgreSQL 16 (Docker) | `localhost:5432` (`swp` & `swp_test`) | `docker-compose.yml` |

## Pengujian & Verifikasi

```bash
# Cek lint (ESLint --max-warnings=0)
npm run lint

# Cek tipe TypeScript (API, Web, Service Worker, Shared)
npm run typecheck

# Jalankan seluruh automated tests (245 tests: 140 API + 38 Web + 67 Shared)
npm run test

# Build produksi (Shared, API, Web + Service Worker)
npm run build

# Atau jalankan seluruh rangkaian verifikasi sekaligus
npm run verify
```

## Catatan Singkat Troubleshooting

- **Prisma Client belum ditemukan saat menjalankan API/test:** jalankan `npx --workspace apps/api prisma generate` lalu `npm run build -w packages/shared`.
- **Port 5432 sudah dipakai PostgreSQL lokal lain:** hentikan service PostgreSQL lokal terlebih dahulu atau sesuaikan port di `docker-compose.yml` dan `DATABASE_URL`.
- **Menghentikan container database setelah selesai:** jalankan `docker compose stop db`.

## Tim Pengembang (Kelompok 2 — IF-48-PJJ-02)

1. Ananda Nabbil Pratama (`103042400052`)
2. Joko Indaryanto (`103042400054`)
3. Fatih Risenda (`103042400022`)
4. Ringo Noer Junaedy (`103042400012`)
