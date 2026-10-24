import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { categoryInputSchema, LIMITS } from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { findCategoryOwnedByUser } from '../repositories/categoryRepo.js';

export const categoriesRouter = Router();
categoriesRouter.use('/categories', requireAuth, requireRole('MAHASISWA'));

categoriesRouter.get('/categories', async (req, res) => {
  const userId = req.user!.id;
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ where: { userId }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.task.groupBy({ by: ['categoryId'], where: { userId }, _count: { _all: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));

  res.status(200).json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      type: c.type,
      taskCount: countMap.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

categoriesRouter.post('/categories', async (req, res) => {
  const userId = req.user!.id;
  const input = categoryInputSchema.parse(req.body);

  const count = await prisma.category.count({ where: { userId } });
  if (count >= LIMITS.maxCategoriesPerUser) {
    throw new AppError('LIMIT_EXCEEDED', 409, `Maksimum ${LIMITS.maxCategoriesPerUser} kategori per pengguna`);
  }

  try {
    const category = await prisma.category.create({
      data: { id: randomUUID(), userId, name: input.name, color: input.color, type: input.type },
    });
    res.status(201).json({
      id: category.id,
      name: category.name,
      color: category.color,
      type: category.type,
      taskCount: 0,
      createdAt: category.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('NAME_TAKEN', 409, 'Nama kategori sudah ada');
    }
    throw err;
  }
});

categoriesRouter.patch('/categories/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const input = categoryInputSchema.partial().parse(req.body);

  const existing = await findCategoryOwnedByUser(prisma, userId, id);
  if (!existing) throw notFound('Kategori tidak ditemukan');

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      },
    });
    res.status(200).json({
      id: updated.id,
      name: updated.name,
      color: updated.color,
      type: updated.type,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('NAME_TAKEN', 409, 'Nama kategori sudah ada');
    }
    throw err;
  }
});

categoriesRouter.delete('/categories/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const reassignTo = typeof req.query.reassignTo === 'string' ? req.query.reassignTo : undefined;

  const existing = await findCategoryOwnedByUser(prisma, userId, id);
  if (!existing) throw notFound('Kategori tidak ditemukan');

  const taskCount = await prisma.task.count({ where: { userId, categoryId: id } });

  if (taskCount > 0) {
    if (!reassignTo) {
      throw new AppError('CATEGORY_IN_USE', 409, 'Kategori masih dipakai oleh tugas', undefined, { taskCount });
    }
    if (reassignTo === id) {
      throw new AppError('VALIDATION_ERROR', 400, 'Data tidak valid', { reassignTo: 'Tidak boleh sama dengan kategori yang dihapus' });
    }
    const target = await findCategoryOwnedByUser(prisma, userId, reassignTo);
    if (!target) throw notFound('Kategori tujuan tidak ditemukan');

    await prisma.$transaction([
      prisma.task.updateMany({ where: { userId, categoryId: id }, data: { categoryId: reassignTo } }),
      prisma.category.delete({ where: { id } }),
    ]);
    res.status(204).end();
    return;
  }

  await prisma.category.delete({ where: { id } });
  res.status(204).end();
});
