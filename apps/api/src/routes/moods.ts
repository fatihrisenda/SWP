import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { moodInputSchema } from '@swp/shared';
import { DateTime } from 'luxon';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const moodsRouter = Router();
moodsRouter.use('/moods', requireAuth, requireRole('MAHASISWA'));

const DEDUPE_WINDOW_MS = 60_000;
const historyQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(30).optional().default(7) }).strict();

moodsRouter.post('/moods', async (req, res) => {
  const userId = req.user!.id;
  const { level } = moodInputSchema.parse(req.body);

  const last = await prisma.moodEntry.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (last && last.level === level && Date.now() - last.createdAt.getTime() < DEDUPE_WINDOW_MS) {
    res.status(200).json({ id: last.id, level: last.level, at: last.createdAt.toISOString() });
    return;
  }

  const created = await prisma.moodEntry.create({ data: { id: randomUUID(), userId, level } });
  res.status(201).json({ id: created.id, level: created.level, at: created.createdAt.toISOString() });
});

moodsRouter.get('/moods/today', async (req, res) => {
  const userId = req.user!.id;
  const tz = req.user!.timezone;
  const startOfToday = DateTime.now().setZone(tz).startOf('day').toJSDate();

  const latest = await prisma.moodEntry.findFirst({
    where: { userId, createdAt: { gte: startOfToday } },
    orderBy: { createdAt: 'desc' },
  });

  if (!latest) {
    res.status(200).json({ level: null });
    return;
  }
  res.status(200).json({ level: latest.level, at: latest.createdAt.toISOString() });
});

moodsRouter.get('/moods', async (req, res) => {
  const userId = req.user!.id;
  const { limit } = historyQuerySchema.parse(req.query);
  const entries = await prisma.moodEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.status(200).json(entries.map((e) => ({ level: e.level, at: e.createdAt.toISOString() })));
});
