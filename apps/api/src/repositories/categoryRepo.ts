import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DEFAULT_CATEGORIES } from '@swp/shared';

type Db = PrismaClient | Prisma.TransactionClient;

/** Dibuat saat register & saat admin membuat mahasiswa baru (D-10). */
export async function createDefaultCategories(db: Db, userId: string): Promise<void> {
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ id: randomUUID(), userId, name: c.name, color: c.color, type: c.type })),
  });
}

/** Aturan repo (Issue 013): `userId` selalu argumen pertama dan selalu di WHERE — anti-IDOR. */
export async function findCategoryOwnedByUser(db: Db, userId: string, categoryId: string) {
  return db.category.findFirst({ where: { id: categoryId, userId } });
}
