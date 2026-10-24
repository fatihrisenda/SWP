import type { Express } from 'express';
import type { PrismaClient, Role } from '@prisma/client';
import { vi } from 'vitest';

export const PASSWORD = 'Password123!';

export interface TestContext {
  app: Express;
  prisma: PrismaClient;
  cookieName: string;
  /** Nama kolom cookie sesi yang dipakai aplikasi pada NODE_ENV=test. */
  cookie: (token: string) => string;
}

interface UserInfo {
  id: string;
  email: string;
  role: Role;
}

interface SessionOptions {
  /** Kedaluwarsa baris `sessions` di DB, relatif ke sekarang. */
  sessionTtlMs?: number;
  /** Kedaluwarsa klaim `exp` JWT, relatif ke sekarang. */
  tokenTtlMs?: number;
  revoked?: boolean;
}

let cachedHash: string | null = null;
const emailCounter = { value: 0 };

async function passwordHash(): Promise<string> {
  if (!cachedHash) {
    const { hashPassword } = await import('../src/lib/password.js');
    cachedHash = await hashPassword(PASSWORD);
  }
  return cachedHash;
}

/**
 * Module registry dibersihkan lalu aplikasi di-import ulang supaya store express-rate-limit
 * (singleton in-memory) kembali kosong untuk setiap file test.
 */
export async function setup(): Promise<TestContext> {
  vi.resetModules();
  const [{ createApp }, prismaMod, sessionMod] = await Promise.all([
    import('../src/app.js'),
    import('../src/lib/prisma.js'),
    import('../src/lib/session.js'),
  ]);
  const prisma = prismaMod.prisma as PrismaClient;
  const name = sessionMod.cookieName();
  return {
    app: createApp(),
    prisma,
    cookieName: name,
    cookie: (token: string) => `${name}=${token}`,
  };
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.reminder.deleteMany(),
    prisma.pushSubscription.deleteMany(),
    prisma.moodEntry.deleteMany(),
    prisma.session.deleteMany(),
    prisma.task.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function makeUser(
  ctx: TestContext,
  options: { role?: Role; name?: string; timezone?: string; dailyCapacityHours?: number } = {},
): Promise<UserInfo> {
  emailCounter.value += 1;
  const role = options.role ?? 'MAHASISWA';
  const email = `user${emailCounter.value}.${role.toLowerCase()}@test.local`;
  const user = await ctx.prisma.user.create({
    data: {
      name: options.name ?? (role === 'SUPERADMIN' ? 'Super Admin' : 'Mahasiswa Uji'),
      email,
      role,
      passwordHash: await passwordHash(),
      timezone: options.timezone ?? 'Asia/Jakarta',
      ...(options.dailyCapacityHours !== undefined ? { dailyCapacityHours: options.dailyCapacityHours } : {}),
    },
  });
  await ctx.prisma.category.createMany({
    data: [
      { id: crypto.randomUUID(), userId: user.id, name: 'Kuliah Uji', color: '#2563EB', type: 'KULIAH' },
      { id: crypto.randomUUID(), userId: user.id, name: 'Pribadi Uji', color: '#16A34A', type: 'PRIBADI' },
    ],
  });
  return { id: user.id, email: user.email, role: user.role };
}

/** Dua pengguna terisolasi untuk uji RBAC/IDOR lintas-user (Issue 013). */
export async function twoUsers(ctx: TestContext): Promise<{ a: UserInfo; b: UserInfo }> {
  const a = await makeUser(ctx, { name: 'Mahasiswa A' });
  const b = await makeUser(ctx, { name: 'Mahasiswa B' });
  return { a, b };
}

export async function makeSession(ctx: TestContext, userId: string, options: SessionOptions = {}): Promise<string> {
  const { signSessionToken } = await import('../src/lib/jwt.js');
  const sessionTtlMs = options.sessionTtlMs ?? 60 * 60_000;
  const tokenTtlMs = options.tokenTtlMs ?? 60 * 60_000;
  const session = await ctx.prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + sessionTtlMs),
      ...(options.revoked ? { revokedAt: new Date() } : {}),
    },
  });
  return signSessionToken({ sub: userId, sid: session.id }, Math.floor((Date.now() + tokenTtlMs) / 1000));
}

export async function categoryIdOf(ctx: TestContext, userId: string, name: string): Promise<string> {
  const category = await ctx.prisma.category.findFirstOrThrow({ where: { userId, name } });
  return category.id;
}

const H = 3_600_000;
const D = 24 * H;

/**
 * `.env.test` memakai TRUST_PROXY=1 sehingga setiap test bisa diberi "IP" sendiri lewat
 * X-Forwarded-For; store express-rate-limit (in-memory, per-key) dengan begitu tidak saling
 * mengganggu antar test.
 */
let ipCounter = 0;
export function nextIp(): string {
  ipCounter += 1;
  return `10.10.${Math.floor(ipCounter / 254)}.${(ipCounter % 254) + 1}`;
}

export function fixedTimeInput(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: 'FIXED_TIME',
    title: 'Kelas Pemrograman',
    description: '',
    categoryId,
    importance: 3,
    difficulty: 2,
    startAt: new Date(Date.now() + D).toISOString(),
    endAt: new Date(Date.now() + D + 2 * H).toISOString(),
    ...overrides,
  };
}

export function deadlineInput(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: 'DEADLINE',
    title: 'Laporan Praktikum',
    description: '',
    categoryId,
    importance: 4,
    difficulty: 3,
    deadlineAt: new Date(Date.now() + 3 * D).toISOString(),
    durationHours: 2,
    ...overrides,
  };
}

export function routineInput(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: 'ROUTINE',
    title: 'Olahraga Pagi',
    description: '',
    categoryId,
    importance: 2,
    difficulty: 1,
    routineDays: [1, 3, 5],
    routineStartTime: '06:30',
    durationHours: 1,
    ...overrides,
  };
}
