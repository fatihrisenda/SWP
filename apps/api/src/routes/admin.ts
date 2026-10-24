import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { adminCreateUserSchema, adminListUsersQuerySchema, adminUpdateUserSchema } from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { createDefaultCategories } from '../repositories/categoryRepo.js';
import { writeAuditLog } from '../lib/auditLog.js';

export const adminRouter = Router();
adminRouter.use('/admin', requireAuth, requireRole('SUPERADMIN'));

adminRouter.get('/admin/stats', async (_req, res) => {
  const [totalUsers, totalMahasiswa, totalSuperAdmin] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'MAHASISWA' } }),
    prisma.user.count({ where: { role: 'SUPERADMIN' } }),
  ]);
  res.status(200).json({ totalUsers, totalMahasiswa, totalSuperAdmin });
});

adminRouter.get('/admin/users', async (req, res) => {
  const { limit, offset, q } = adminListUsersQuerySchema.parse(req.query);

  const where: Prisma.UserWhereInput = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }
    : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(200).json(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

adminRouter.post('/admin/users', async (req, res) => {
  const input = adminCreateUserSchema.parse(req.body);
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { id: randomUUID(), name: input.name, email: input.email, passwordHash, role: input.role },
      });
      if (input.role === 'MAHASISWA') {
        await createDefaultCategories(tx, created.id);
      }
      await writeAuditLog(tx, 'USER_CREATE', req.user!.id, created.id, { role: input.role });
      return created;
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('EMAIL_TAKEN', 409, 'Email sudah terdaftar');
    }
    throw err;
  }
});

adminRouter.patch('/admin/users/:id', async (req, res) => {
  const id = req.params.id as string;
  const input = adminUpdateUserSchema.parse(req.body);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw notFound('Pengguna tidak ditemukan');

      const demoting = input.role !== undefined && target.role === 'SUPERADMIN' && input.role !== 'SUPERADMIN';
      if (demoting) {
        await assertSuperAdminGuardLocked(tx, id);
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.password !== undefined ? { passwordHash: await hashPassword(input.password) } : {}),
        },
      });

      if (input.role !== undefined || input.password !== undefined) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }

      await writeAuditLog(tx, 'USER_UPDATE', req.user!.id, id, {
        fields: Object.keys(input).filter((k) => k !== 'password'),
      });

      return updated;
    });

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('EMAIL_TAKEN', 409, 'Email sudah terdaftar');
    }
    throw err;
  }
});

adminRouter.delete('/admin/users/:id', async (req, res) => {
  const id = req.params.id as string;
  if (id === req.user!.id) {
    throw new AppError('FORBIDDEN', 403, 'Tidak bisa menghapus akun sendiri');
  }

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw notFound('Pengguna tidak ditemukan');

    if (target.role === 'SUPERADMIN') {
      await assertSuperAdminGuardLocked(tx, id);
    }

    await tx.user.delete({ where: { id } });
    await writeAuditLog(tx, 'USER_DELETE', req.user!.id, id);
  });

  res.status(204).end();
});

/**
 * Kunci semua baris SuperAdmin (`FOR UPDATE`) lalu pastikan masih tersisa ≥1 selain `excludeUserId`
 * (Issue 033) — aman dari race condition saat dua request paralel menghapus/menurunkan SuperAdmin berbeda.
 */
async function assertSuperAdminGuardLocked(tx: Prisma.TransactionClient, excludeUserId: string): Promise<void> {
  const admins = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM users WHERE role = 'SUPERADMIN' FOR UPDATE`,
  );
  const remaining = admins.filter((a) => a.id !== excludeUserId);
  if (remaining.length === 0) {
    throw new AppError('LAST_SUPERADMIN', 409, 'Tidak bisa menghapus/menurunkan SuperAdmin terakhir');
  }
}
