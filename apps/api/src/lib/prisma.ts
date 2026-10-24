import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

declare global {
  // pola singleton standar untuk hot-reload dev
  var __prisma: PrismaClient | undefined;
}

/** Singleton Prisma Client (hindari membuat koneksi baru tiap reload saat dev). */
export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
