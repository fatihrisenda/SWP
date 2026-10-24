import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { verifySessionToken } from '../lib/jwt.js';
import { cookieName, clearSessionCookie } from '../lib/session.js';
import { AppError } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
  locale: string;
  dailyCapacityHours: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- pola augmentasi Express resmi
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60_000;

/**
 * Middleware autentikasi wajib (Issue 012): verifikasi cookie → sesi aktif di DB → muat user.
 * Gagal pada tahap apa pun → 401 UNAUTHENTICATED + hapus cookie.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[cookieName()];
  if (!token) {
    next(new AppError('UNAUTHENTICATED', 401, 'Silakan masuk terlebih dahulu'));
    return;
  }

  const claims = await verifySessionToken(token);
  if (!claims) {
    clearSessionCookie(res);
    next(new AppError('UNAUTHENTICATED', 401, 'Sesi tidak valid, silakan masuk kembali'));
    return;
  }

  const session = await prisma.session.findUnique({ where: { id: claims.sid } });
  const now = Date.now();
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now || session.userId !== claims.sub) {
    clearSessionCookie(res);
    next(new AppError('UNAUTHENTICATED', 401, 'Sesi tidak valid, silakan masuk kembali'));
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    clearSessionCookie(res);
    next(new AppError('UNAUTHENTICATED', 401, 'Sesi tidak valid, silakan masuk kembali'));
    return;
  }

  if (now - session.lastSeenAt.getTime() > LAST_SEEN_UPDATE_INTERVAL_MS) {
    prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } })
      .catch(() => undefined);
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    locale: user.locale,
    dailyCapacityHours: Number(user.dailyCapacityHours),
  };
  req.sessionId = session.id;
  next();
}

/** RBAC (Issue 013): role dibaca dari user yang sudah dimuat `requireAuth` dari DB, bukan dari klaim JWT. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('UNAUTHENTICATED', 401, 'Silakan masuk terlebih dahulu'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 403, 'Anda tidak berhak mengakses sumber daya ini'));
      return;
    }
    next();
  };
}
