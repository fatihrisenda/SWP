import { rateLimit, type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';

function rateLimitedResponse(_req: Request, res: Response) {
  const retryAfter = res.getHeader('Retry-After');
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Terlalu banyak percobaan, coba lagi nanti',
      ...(retryAfter ? { retryAfter } : {}),
    },
  });
}

const base: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedResponse,
};

/** Global: 300 req/menit/IP (Issue 009). */
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 300,
});

function normalizeEmail(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return email;
}

/** Login: kunci IP+email, 5 gagal/15 menit (Issue 014). Dihitung hanya untuk request yang gagal. */
export const loginByEmailIpLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip ?? 'unknown'}:${normalizeEmail(req)}`,
});

/** Login: kunci IP saja, 30 percobaan/15 menit (Issue 014). */
export const loginByIpLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 30,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip ?? 'unknown',
});

/** Register: 5/jam/IP (Issue 010, 014). */
export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => req.ip ?? 'unknown',
});

/** Push test: 5/menit/user (Issue 030). */
export const pushTestLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 5,
  keyGenerator: (req) => {
    const user = (req as { user?: { id?: string } }).user;
    return user?.id ?? req.ip ?? 'unknown';
  },
});
