import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { isValidTimezone, loginSchema, registerSchema } from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword, needsRehash, dummyHash } from '../lib/password.js';
import { issueSession, clearSessionCookie } from '../lib/session.js';
import { toPublicUser } from '../lib/serializers.js';
import { createDefaultCategories } from '../repositories/categoryRepo.js';
import { requireAuth } from '../middleware/auth.js';
import { loginByEmailIpLimiter, loginByIpLimiter, registerLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/auth/register', registerLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);

  if (input.password.toLowerCase() === input.email.toLowerCase() || input.password.toLowerCase() === input.name.toLowerCase()) {
    throw new AppError('VALIDATION_ERROR', 400, 'Data tidak valid', {
      password: 'Password tidak boleh sama dengan email atau nama',
    });
  }

  const timezone = isValidTimezone(input.timezone) ? input.timezone : 'Asia/Jakarta';
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: randomUUID(),
          name: input.name,
          email: input.email,
          passwordHash,
          role: 'MAHASISWA',
          timezone,
        },
      });
      await createDefaultCategories(tx, created.id);
      return created;
    });

    await issueSession(res, user, false);
    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('EMAIL_TAKEN', 409, 'Email sudah terdaftar');
    }
    throw err;
  }
});

authRouter.post('/auth/login', loginByIpLimiter, loginByEmailIpLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const invalidCredentials = () => new AppError('INVALID_CREDENTIALS', 401, 'Email atau password tidak valid');

  const user = await prisma.user.findUnique({ where: { email: input.email } });

  const hashToCheck = user ? user.passwordHash : await dummyHash();
  const valid = await verifyPassword(hashToCheck, input.password);

  if (!user || !valid) {
    const emailHash = createHash('sha256').update(input.email).digest('hex');
    await prisma.auditLog.create({
      data: { id: randomUUID(), action: 'LOGIN_FAIL', meta: { emailHash, ip: req.ip ?? null } },
    });
    throw invalidCredentials();
  }

  if (needsRehash(user.passwordHash)) {
    const rehashed = await hashPassword(input.password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: rehashed } });
  }

  await issueSession(res, user, input.remember);
  res.status(200).json({ user: toPublicUser(user) });
});

authRouter.post('/auth/logout', requireAuth, async (req, res) => {
  if (req.sessionId) {
    await prisma.session.updateMany({
      where: { id: req.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new AppError('UNAUTHENTICATED', 401, 'Sesi tidak valid, silakan masuk kembali');
  res.status(200).json({ user: toPublicUser(user) });
});
