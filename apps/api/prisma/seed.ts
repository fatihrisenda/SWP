import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/lib/password.js';

/**
 * Seed SuperAdmin pertama dari env (Issue 008). Idempoten: tidak membuat admin kedua bila
 * sudah ada satu SuperAdmin. Tidak pernah membuat kredensial default di kode (Bagian 0.5).
 */
async function main(): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
  if (existing) {
    console.log(`SuperAdmin sudah ada (${existing.email}); tidak membuat yang baru.`);
    return;
  }

  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME } = env;

  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    if (env.NODE_ENV === 'production') {
      console.error('SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi di production untuk membuat SuperAdmin pertama.');
      process.exit(1);
    }
    console.log(
      'SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD kosong — lewati pembuatan SuperAdmin.\n' +
        'Isi kedua env tersebut di apps/api/.env lalu jalankan ulang `npm run db:seed -w apps/api`.',
    );
    return;
  }

  if (SEED_ADMIN_PASSWORD.length < 8) {
    console.error('SEED_ADMIN_PASSWORD minimal 8 karakter.');
    process.exit(1);
  }

  const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: SEED_ADMIN_NAME || 'Super Admin',
      email,
      passwordHash,
      role: 'SUPERADMIN',
    },
  });

  console.log(`SuperAdmin dibuat: ${admin.email}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
