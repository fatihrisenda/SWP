# StudyWork Planner (SWP)

Aplikasi manajemen jadwal dan tugas mahasiswa berbasis Web & PWA (Progressive Web App) menggunakan arsitektur monorepo TypeScript.

## Fitur Utama

- **Manajemen Tugas (Fixed-Time, Deadline, Routine):** Mendukung tiga tipe penjadwalan tugas dengan status tri-state (`TODO`, `IN_PROGRESS`, `DONE`), kategori kustom berwarna `#RRGGBB`, serta pencarian dan filter multi-kriteria.
- **Perhitungan Prioritas & Deteksi Konflik:** Menghitung skor prioritas dinamis berdasarkan urgensi, tingkat kepentingan, dan kesulitan, serta mendeteksi bentrokan jadwal, jeda sempit (< 30 menit), dan kelebihan beban kerja harian.
- **Rekomendasi Berbasis Mood:** Mencocokkan tingkat kesulitan tugas dengan kondisi mood harian mahasiswa, termasuk saran tugas yang perlu ditunda dan tips self-care saat mood rendah.
- **PWA & Web Push Notification:** Mendukung pemasangan di desktop/mobile melalui Service Worker (`sw.ts`) dan pengingat terjadwal menggunakan Web Push (VAPID).
- **Autentikasi, RBAC, & Log Audit:** Hashing password Argon2id, sesi JWT pada cookie `HttpOnly` (`SameSite=Lax`), validasi input bersama dengan Zod & Regex (`@swp/shared`), validasi parameter UUID, rate limiting, kontrol akses berbasis peran (`MAHASISWA` & `SUPERADMIN`), dan peninjauan log audit keamanan di panel admin.

## Struktur Direktori

```text
SWP/
├── apps/
│   ├── api/                # REST API (Express 5, TypeScript, Prisma ORM, PostgreSQL)
│   │   ├── prisma/         # Skema database, migrasi SQL, dan skrip seed
│   │   ├── src/            # Routes, middleware, repositories, services, worker
│   │   └── test/           # Integration & unit tests (Vitest + Supertest)
│   └── web/                # Frontend Web & PWA (React 18, Vite, Tailwind CSS)
│       ├── src/            # Halaman, komponen UI, hooks, i18n (id/en), service worker
│       └── test/           # Component & i18n tests (Vitest + Testing Library)
├── packages/
│   └── shared/             # Paket bersama (@swp/shared): domain logic & Zod schemas
├── docker/                 # Skrip inisialisasi database pengujian
├── docker-compose.yml      # Konfigurasi PostgreSQL 16 (dev & test)
└── package.json            # Skrip monorepo root
```

## Prasyarat

- Node.js v22+ dan npm v10+
- PostgreSQL 16 (lokal atau via Docker Compose)

## Menjalankan Proyek di Lokal

### 1. Siapkan Environment

Salin template environment ke `apps/api/.env` (dan `apps/api/.env.test` untuk pengujian integrasi):

```bash
cp apps/api/.env.example apps/api/.env
```

Sesuaikan nilai `DATABASE_URL`, `JWT_SECRET`, serta kredensial `SEED_ADMIN_*` di `apps/api/.env`.

### 2. Jalankan Database PostgreSQL

```bash
docker compose up -d db
```

### 3. Install Dependensi, Migrasi, dan Seed

```bash
npm install
npx --workspace apps/api prisma migrate deploy
npm run db:seed -w apps/api
npm run db:seed:dev -w apps/api
```

### 4. Jalankan Server Development

```bash
npm run dev
```

- API berjalan di `http://localhost:3000`
- Web & PWA berjalan di `http://localhost:5173`

## Pengujian & Verifikasi

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Atau jalankan seluruh rangkaian verifikasi sekaligus:

```bash
npm run verify
```
