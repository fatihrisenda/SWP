import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { signSessionToken } from './jwt.js';

export function cookieName(): string {
  return env.NODE_ENV === 'production' ? `__Host-${env.SESSION_COOKIE_NAME}` : env.SESSION_COOKIE_NAME;
}

interface MinimalUser {
  id: string;
}

/**
 * Buat sesi baru di DB + cookie HttpOnly bertanda tangan JWT (Issue 011).
 * `remember=false` → cookie sesi (hilang saat browser ditutup) + kedaluwarsa absolut 12 jam di DB.
 * `remember=true`  → cookie + DB kedaluwarsa 30 hari.
 */
export async function issueSession(res: Response, user: MinimalUser, remember: boolean): Promise<void> {
  const ttlMs = remember
    ? env.SESSION_TTL_REMEMBER_DAYS * 24 * 60 * 60 * 1000
    : env.SESSION_TTL_DEFAULT_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  const session = await prisma.session.create({
    data: { id: randomUUID(), userId: user.id, expiresAt },
  });

  const token = await signSessionToken({ sub: user.id, sid: session.id }, Math.floor(expiresAt.getTime() / 1000));

  res.cookie(cookieName(), token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: ttlMs } : {}),
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(cookieName(), {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/** Dipakai saat ganti password / role diubah / user dihapus (Issue 012, 033). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
