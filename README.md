# 🎓 StudyWork Planner (SWP) — Modern Web & PWA Monorepo

> **Spesifikasi Acuan:** `SKPL-001-SWP-2025` — Software Requirement Specification  
> **Institusi:** Program Studi S1 Informatika, Fakultas Informatika, Universitas Telkom  
> **Mata Kuliah:** Implementasi & Pengujian Perangkat Lunak (IPPL)  
> **Status:** Siap Digunakan & Teruji Bebas Error (100% Tests Pass, Zero Type Errors, Clean Build)

---

## 📌 Ringkasan Repositori

Repositori ini merupakan implementasi modern aplikasi **StudyWork Planner (SWP)** berbasis arsitektur *enterprise-ready monorepo* (TypeScript, React 18, Express 5, Prisma ORM, TailwindCSS, Progressive Web App). Seluruh 72 backlog issue migrasi dari legacy WebView ke Modern PWA telah diimplementasikan dan diverifikasi secara komprehensif.

### Fitur Utama:
- 📱 **Progressive Web App (PWA):** Dukungan offline, service worker caching, installable di desktop & mobile, dan Web Push Notification (VAPID).
- ⚖️ **Priority & Recommendation Engine:** Algoritma pembobotan otomatis berbasis *Eisenhower Matrix*, deadline proximity, dan level urgensi tugas kuliah/pekerjaan.
- 🕒 **Conflict Engine & Routine Scheduler:** Deteksi tabrakan jadwal waktu nyata antara agenda perkuliahan, jam kerja, dan rutinitas harian.
- 🔐 **Keamanan Kelas Enterprise:** Autentikasi Argon2id, session cookie anti-tamper dengan Jose JWT, Rate Limiting, RBAC (SuperAdmin & Mahasiswa).
- 🧪 **236 Automated Tests:** Unit test, component test, dan integration test menyeluruh (100% pass).

---

## 📂 Peta Struktur Direktori

```text
swpFinal/
├── README.md                           # Panduan utama repositori (berkas ini)
├── package.json                        # Monorepo root scripts & dev dependencies
├── package-lock.json                   # Lockfile dependensi monorepo
├── tsconfig.base.json                  # Konfigurasi basis TypeScript
├── docker-compose.yml                  # Konfigurasi container PostgreSQL 16 (dev & test db)
├── .env.example                        # Template konfigurasi environment
├── issues.md                           # Backlog 72 issue migrasi dari WebView ke PWA
│
├── apps/                               # Aplikasi utama (Monorepo Workspaces)
│   ├── api/                            # Backend REST API (TypeScript + Express 5 + Prisma)
│   │   ├── prisma/                     # Schema Prisma, migrasi SQL, & skrip seed
│   │   │   ├── schema.prisma           # Model relational PostgreSQL
│   │   │   ├── seed.ts                 # Seeder SuperAdmin pertama
│   │   │   └── seed.dev.ts             # Seeder data uji mahasiswa demo & tugas
│   │   ├── src/                        # Controller, middleware, worker, repositories
│   │   ├── test/                       # 138 Integration & unit test (Vitest)
│   │   ├── .env.example                # Template environment apps/api
│   │   └── package.json
│   │
│   └── web/                            # Frontend Web & PWA (React 18 + Vite + TailwindCSS)
│       ├── src/                        # UI Components, Pages, State, i18n, Service Worker
│       ├── test/                       # 37 Unit & Component tests (Vitest + Testing Library)
│       ├── vite.config.ts              # Vite reverse proxy ke API port 3000
│       └── package.json
│
├── packages/
│   └── shared/                         # Paket logika bersama (@swp/shared)
│       ├── src/domain/                 # Algoritma Priority, Conflict, Recommendation, Routine
│       ├── src/schemas/                # Zod schemas (validasi request & domain)
│       └── test/                       # 61 Unit tests logika bisnis
│
└── docker/                             # Konfigurasi pendukung container database
```

---

## ⚙️ Prasyarat Sistem (Prerequisites)

Sebelum menjalankan aplikasi, pastikan sistem Anda telah memiliki:

| Perangkat Lunak | Versi Minimal | Fungsi |
|---|---|---|
| **Node.js** | `v18.x` atau `v22.x+` (Direkomendasikan `v22+`) | Runtime JavaScript/TypeScript |
| **npm** | `v9.x` atau `v10.x+` | Package manager |
| **PostgreSQL** | `v14+` atau `v16+` (Lokal / Docker) | RDBMS penyimpanan data |
| **Docker & Compose** | Opsional | Menjalankan database PostgreSQL instan tanpa instal manual |

---

## 🚀 Panduan Menjalankan Proyek

### Langkah 1: Siapkan File Environment (`.env`)
Salin file template `.env.example` menjadi `.env` di root atau di `apps/api/.env`:
```bash
# Salin template
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Pastikan variabel `DATABASE_URL` sesuai dengan pengaturan PostgreSQL Anda:
```env
NODE_ENV=development
PORT=3000
APP_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://swp:swp_dev_password@localhost:5432/swp?schema=public
JWT_SECRET=T6kzqONbGXhJt4uvDimwI7RPvTKRSds0KqBM7y4DVvXzv6lx4jjFVW1uNOv0cjz3
SEED_ADMIN_NAME="Super Admin Dev"
SEED_ADMIN_EMAIL=superadmin@dev.local
SEED_ADMIN_PASSWORD=UbahPasswordIni8
```

### Langkah 2: Jalankan Database PostgreSQL
**Opsi A — Menggunakan Docker (Direkomendasikan):**
```bash
docker compose up -d db
```
Container akan otomatis membuat database `swp` (development) dan `swp_test` (pengujian).

**Opsi B — Menggunakan PostgreSQL Lokal:**
Buat database bernama `swp` di PostgreSQL server Anda (port 5432) dan sesuaikan username/password pada `DATABASE_URL`.

### Langkah 3: Install Dependensi & Jalankan Migrasi Prisma
```bash
# Install seluruh dependencies monorepo
npm install

# Jalankan migrasi Prisma ke database
npm run prisma:migrate

# Jalankan seed akun SuperAdmin & data demo mahasiswa
npm run prisma:seed
npm run db:seed:dev -w apps/api
```

### Langkah 4: Jalankan Server Development
```bash
npm run dev
```
Perintah ini akan menjalankan 2 proses secara paralel:
- 🟢 **API Server (Express 5):** Berjalan di `http://localhost:3000`
- 🔵 **Web Frontend & PWA (Vite):** Berjalan di `http://localhost:5173`

Akses aplikasi di browser melalui: **`http://localhost:5173`**.

---

## 🔑 Kredensial Login Bawaan

* **SuperAdmin (Akses Dashboard Manajemen & Monitoring):**
  - Email: `superadmin@dev.local`
  - Password: `UbahPasswordIni8`
  - URL: `http://localhost:5173/admin`
* **Mahasiswa Demo (Akses Kalender, Jadwal, Tugas, & Mood):**
  - Email: `mahasiswa@dev.local`
  - Password: `DemoPassword8`
  - URL: `http://localhost:5173/`

---

## 🧪 Pengujian Otomatis (Automated Testing)

Seluruh komponen repositori telah diverifikasi dengan test suite otomatis (**100% Pass**):

```bash
# 1. Pengecekan Type TypeScript (0 Error)
npm run typecheck

# 2. Menjalankan Seluruh Automated Tests (236 tests pass)
npm test

# 3. Build Production Bundle (API + Web PWA)
npm run build
```

### Rincian Test Suite (Total 236 Tests):
- **`apps/api` (138 tests)**: Tasks CRUD, Worker Batch, Authentication, RBAC, Security, Admin API, Moods, Categories, Push Notification endpoints.
- **`apps/web` (37 tests)**: TriStateCheckbox, ConflictDialog, TaskList, TaskForm, AuthPages, i18n switcher.
- **`packages/shared` (61 tests)**: Task Schema validation, Time utilities, Routine recurrence, Reminder triggers, Recommendation algorithm, Priority engine, Analytics, Conflict detection.

---

## 🛠️ Ringkasan Port & Service

| Service | Port | Direktori Sumber | Deskripsi |
|---|---|---|---|
| **API Server** | `3000` | `apps/api` | REST API TypeScript + Express 5 + Prisma |
| **Web Client / PWA** | `5173` | `apps/web` | Client React 18 + TailwindCSS (Proxy ke `:3000`) |
| **PostgreSQL Dev** | `5432` | Docker / Lokal | Database utama (`swp`) |
| **PostgreSQL Test** | `5432` | Docker (`swp_test`) | Database pengujian integrasi otomatis |

---

## 👥 Tim & Lisensi

Dikembangkan sebagai bagian dari pengerjaan proyek mata kuliah **Implementasi & Pengujian Perangkat Lunak (IPPL)**, Program Studi S1 Informatika, Fakultas Informatika, Universitas Telkom.
