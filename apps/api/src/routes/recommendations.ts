import { Router } from 'express';
import { DateTime } from 'luxon';
import {
  eventTime,
  priority,
  recommendationQuerySchema,
  runRecommendation,
  ruleBasedProvider,
  taskDurationHours,
  type DomainTask,
} from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { toDomainTask } from '../lib/reminderService.js';
import { logger } from '../lib/logger.js';
import type { CategorySummary } from '../services/taskSerializer.js';

export const recommendationsRouter = Router();
recommendationsRouter.use('/recommendations', requireAuth, requireRole('MAHASISWA'));

recommendationsRouter.get('/recommendations', async (req, res) => {
  const userId = req.user!.id;
  const tz = req.user!.timezone;
  const { mood: moodQuery } = recommendationQuerySchema.parse(req.query);

  let mood = moodQuery as 1 | 2 | 3 | 4 | 5 | undefined;
  if (mood === undefined) {
    const startOfToday = DateTime.now().setZone(tz).startOf('day').toJSDate();
    const todayMood = await prisma.moodEntry.findFirst({
      where: { userId, createdAt: { gte: startOfToday } },
      orderBy: { createdAt: 'desc' },
    });
    if (!todayMood) throw new AppError('MOOD_REQUIRED', 400, 'Isi mood hari ini terlebih dahulu');
    mood = todayMood.level as 1 | 2 | 3 | 4 | 5;
  }

  const rows = await prisma.task.findMany({ where: { userId, status: { not: 'DONE' } }, include: { category: true } });
  const metaById = new Map<string, { title: string; category: CategorySummary }>(
    rows.map((r) => [
      r.id,
      { title: r.title, category: { id: r.category.id, name: r.category.name, color: r.category.color, type: r.category.type } },
    ]),
  );
  const tasks = rows.map((r) => toDomainTask(r));

  const now = Date.now();
  const start = Date.now();
  const result = await runRecommendation(ruleBasedProvider, { mood, tasks, now, tz });
  logger.info({ recommendation_ms: Date.now() - start }, 'recommendation computed');

  const toSummary = (domain: DomainTask) => {
    const meta = metaById.get(domain.id);
    const ev = eventTime(domain, now, tz);
    return {
      id: domain.id,
      title: meta?.title ?? '',
      category: meta?.category ?? null,
      type: domain.type,
      eventAt: ev == null ? null : new Date(ev).toISOString(),
      durationHours: Math.round(taskDurationHours(domain) * 100) / 100,
      difficulty: domain.difficulty,
      importance: domain.importance,
      priority: priority(domain, now, tz),
    };
  };

  res.status(200).json({
    mood,
    energyKey: result.energyKey,
    items: result.items.map((item) => ({
      task: toSummary(item.task),
      matchPercent: item.matchPercent,
      reasonKey: item.reasonKey,
      reasonParams: item.reasonParams,
      isTopPick: item.isTopPick,
    })),
    postpone: result.postpone.map((item) => ({
      task: toSummary(item.task),
      reasonKey: item.reasonKey,
      reasonParams: item.reasonParams,
    })),
    selfCare: result.selfCare,
  });
});
