import { Router } from 'express';
import { DateTime } from 'luxon';
import { computeAnalytics, eventTime, priority, ruleBasedProvider } from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { toDomainTask } from '../lib/reminderService.js';

export const dashboardRouter = Router();
dashboardRouter.use('/dashboard', requireAuth, requireRole('MAHASISWA'));

const DAY_MS = 86_400_000;

dashboardRouter.get('/dashboard', async (req, res) => {
  const userId = req.user!.id;
  const tz = req.user!.timezone;
  const now = Date.now();
  const startOfToday = DateTime.fromMillis(now, { zone: tz }).startOf('day').toJSDate();

  // Maksimal 2 query SQL (Issue 028): tugas + mood hari ini.
  const [tasks, todayMood] = await Promise.all([
    prisma.task.findMany({ where: { userId }, include: { category: true } }),
    prisma.moodEntry.findFirst({ where: { userId, createdAt: { gte: startOfToday } }, orderBy: { createdAt: 'desc' } }),
  ]);

  const domainTasks = tasks.map((t) => toDomainTask(t));
  const analytics = computeAnalytics(domainTasks, now, tz);

  const activeTasks = tasks.filter((t) => t.status !== 'DONE');

  const nearestCandidates = activeTasks
    .filter((t) => t.type !== 'FIXED_TIME' || !t.endAt || t.endAt.getTime() >= now)
    .map((t) => ({ row: t, ev: eventTime(toDomainTask(t), now, tz) }))
    .filter((x): x is { row: (typeof tasks)[number]; ev: number } => x.ev != null)
    .sort((a, b) => a.ev - b.ev)
    .slice(0, 4);

  const nearest = nearestCandidates.map(({ row, ev }) => ({
    id: row.id,
    title: row.title,
    category: { name: row.category.name, color: row.category.color },
    type: row.type,
    eventAt: new Date(ev).toISOString(),
    priority: priority(toDomainTask(row), now, tz),
    isOverdue: row.type === 'DEADLINE' && ev < now,
  }));

  const dueWithin24h = activeTasks.filter((t) => {
    if (t.type === 'ROUTINE') return false;
    const ev = eventTime(toDomainTask(t), now, tz);
    if (ev == null) return false;
    const diff = ev - now;
    return diff > 0 && diff < DAY_MS;
  }).length;

  let topPick: { taskId: string; title: string } | null = null;
  if (todayMood) {
    const activeDomainTasks = activeTasks.map((t) => toDomainTask(t));
    const result = ruleBasedProvider.recommend({
      mood: todayMood.level as 1 | 2 | 3 | 4 | 5,
      tasks: activeDomainTasks,
      now,
      tz,
    });
    const top = result.items[0];
    if (top) {
      const row = activeTasks.find((t) => t.id === top.task.id);
      if (row) topPick = { taskId: row.id, title: row.title };
    }
  }

  res.status(200).json({
    analytics,
    nearest,
    dueWithin24h,
    mood: todayMood ? { level: todayMood.level, at: todayMood.createdAt.toISOString() } : null,
    topPick,
  });
});
