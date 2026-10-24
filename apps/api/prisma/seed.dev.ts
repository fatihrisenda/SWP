import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/lib/password.js';
import { createDefaultCategories } from '../src/repositories/categoryRepo.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Buat (atau pakai ulang) mahasiswa demo + kategori default; mengembalikan map nama→id kategori. */
async function ensureStudent(email: string, name: string, password: string): Promise<{ id: string; categories: Map<string, string> }> {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { id: randomUUID(), name, email, passwordHash, role: 'MAHASISWA' } });
      await createDefaultCategories(tx, created.id);
      return created;
    });
  }

  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  return { id: user.id, categories: new Map(categories.map((c) => [c.name, c.id])) };
}

async function seedSampleTasks(userId: string, categories: Map<string, string>): Promise<void> {
  const existingCount = await prisma.task.count({ where: { userId } });
  if (existingCount > 0) {
    console.log('Mahasiswa demo sudah punya tugas; lewati pembuatan 8 tugas contoh.');
    return;
  }

  const now = Date.now();
  const categoryId = (name: string): string => categories.get(name) ?? [...categories.values()][0]!;

  const tasks = [
    {
      type: 'DEADLINE' as const,
      title: 'Laporan Praktikum Jaringan Komputer',
      description: 'Kumpulkan laporan bab 1-3 beserta lampiran screenshot.',
      categoryId: categoryId('Praktikum'),
      importance: 4,
      difficulty: 3,
      deadlineAt: new Date(now + 2 * DAY + 5 * HOUR),
      durationMinutes: 180,
    },
    {
      type: 'DEADLINE' as const,
      title: 'Tugas Harian Aljabar Linear',
      description: '',
      categoryId: categoryId('Tugas Harian'),
      importance: 3,
      difficulty: 2,
      deadlineAt: new Date(now + 1 * DAY),
      durationMinutes: 60,
    },
    {
      type: 'DEADLINE' as const,
      title: 'Revisi Makalah Etika Profesi',
      description: 'Perbaiki bagian metodologi sesuai catatan dosen.',
      categoryId: categoryId('Assessment'),
      importance: 5,
      difficulty: 4,
      deadlineAt: new Date(now + 5 * DAY),
      durationMinutes: 240,
    },
    {
      type: 'FIXED_TIME' as const,
      title: 'Quiz Matematika Diskrit',
      description: '',
      categoryId: categoryId('Quiz'),
      importance: 4,
      difficulty: 4,
      startAt: new Date(now + 1 * DAY + 2 * HOUR),
      endAt: new Date(now + 1 * DAY + 3 * HOUR),
    },
    {
      type: 'FIXED_TIME' as const,
      title: 'Presentasi Proyek Rekayasa Perangkat Lunak',
      description: 'Presentasi kelompok tahap akhir.',
      categoryId: categoryId('Presentasi'),
      importance: 5,
      difficulty: 3,
      startAt: new Date(now + 3 * DAY + 1 * HOUR),
      endAt: new Date(now + 3 * DAY + 2 * HOUR),
    },
    {
      type: 'ROUTINE' as const,
      title: 'Review Strategi Algoritma',
      description: '',
      categoryId: categoryId('Tugas Harian'),
      importance: 3,
      difficulty: 2,
      routineDays: [1, 3, 5],
      routineStartMinute: 19 * 60 + 30,
      durationMinutes: 60,
    },
    {
      type: 'ROUTINE' as const,
      title: 'Olahraga Pagi',
      description: '',
      categoryId: categoryId('Olahraga'),
      importance: 2,
      difficulty: 1,
      routineDays: [1, 2, 3, 4, 5],
      routineStartMinute: 6 * 60,
      durationMinutes: 30,
    },
    {
      type: 'DEADLINE' as const,
      title: 'Bayar UKT Semester Ini',
      description: '',
      categoryId: categoryId('Pribadi'),
      importance: 5,
      difficulty: 1,
      deadlineAt: new Date(now - 1 * DAY),
      durationMinutes: 30,
    },
  ];

  for (const t of tasks) {
    await prisma.task.create({
      data: {
        id: randomUUID(),
        userId,
        status: 'TODO',
        routineDays: [],
        ...t,
      },
    });
  }

  console.log(`Dibuat ${tasks.length} tugas contoh untuk mahasiswa demo.`);
}

async function seedPerfUser(email: string, name: string, password: string): Promise<void> {
  const { id, categories } = await ensureStudent(email, name, password);
  const existingCount = await prisma.task.count({ where: { userId: id } });
  if (existingCount >= 150) {
    console.log('User perf sudah punya ≥150 tugas; lewati.');
    return;
  }

  const now = Date.now();
  const categoryIds = [...categories.values()];
  const toCreate = 150 - existingCount;
  const data = Array.from({ length: toCreate }, (_, i) => {
    const categoryId = categoryIds[i % categoryIds.length]!;
    const kind = i % 3;
    if (kind === 0) {
      return {
        id: randomUUID(),
        userId: id,
        categoryId,
        title: `Tugas Deadline #${i + 1}`,
        type: 'DEADLINE' as const,
        status: 'TODO' as const,
        importance: (i % 5) + 1,
        difficulty: (i % 5) + 1,
        deadlineAt: new Date(now + ((i % 20) + 1) * DAY),
        durationMinutes: 60 + (i % 4) * 30,
        routineDays: [],
      };
    }
    if (kind === 1) {
      const startAt = new Date(now + ((i % 15) + 1) * DAY + (i % 10) * HOUR);
      return {
        id: randomUUID(),
        userId: id,
        categoryId,
        title: `Jadwal Tetap #${i + 1}`,
        type: 'FIXED_TIME' as const,
        status: 'TODO' as const,
        importance: (i % 5) + 1,
        difficulty: (i % 5) + 1,
        startAt,
        endAt: new Date(startAt.getTime() + HOUR),
        routineDays: [],
      };
    }
    return {
      id: randomUUID(),
      userId: id,
      categoryId,
      title: `Rutin #${i + 1}`,
      type: 'ROUTINE' as const,
      status: 'TODO' as const,
      importance: (i % 5) + 1,
      difficulty: (i % 5) + 1,
      routineDays: [((i % 7) + 1)],
      routineStartMinute: (i % 23) * 60,
      durationMinutes: 30 + (i % 3) * 15,
    };
  });

  for (const d of data) {
    await prisma.task.create({ data: d });
  }
  console.log(`Dibuat ${data.length} tugas untuk user perf (total ${existingCount + data.length}).`);
}

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    console.error('seed:dev tidak boleh dijalankan saat NODE_ENV=production.');
    process.exit(1);
  }

  const student = await ensureStudent('mahasiswa@dev.local', 'Mahasiswa Demo', 'DemoPassword8');
  await seedSampleTasks(student.id, student.categories);
  await seedPerfUser('perf@dev.local', 'Perf Test User', 'DemoPassword8');

  console.log('Seed dev selesai.');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
