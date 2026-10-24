import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma, type Task } from '@prisma/client';
import {
  checkConflicts,
  computeAnalytics,
  conflictCheckSchema,
  eventTime,
  priority,
  taskInputSchema,
  taskListQuerySchema,
  taskStatusSchema,
  type DomainTask,
} from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { findCategoryOwnedByUser } from '../repositories/categoryRepo.js';
import { syncReminder, toDomainTask } from '../lib/reminderService.js';
import { serializeTask } from '../services/taskSerializer.js';
import { taskInputToDbFields, taskToPseudoInput } from '../lib/taskInput.js';
import { escapeLikePattern, timeRangeMs } from '../lib/dateRange.js';

export const tasksRouter = Router();
tasksRouter.use('/tasks', requireAuth, requireRole('MAHASISWA'));

async function pendingReminderMap(userId: string, taskIds: string[]): Promise<Map<string, Date>> {
  if (taskIds.length === 0) return new Map();
  const reminders = await prisma.reminder.findMany({
    where: { userId, taskId: { in: taskIds }, status: 'PENDING' },
  });
  return new Map(reminders.map((r) => [r.taskId, r.remindAt]));
}

async function assertCategoryOwned(userId: string, categoryId: string): Promise<void> {
  const category = await findCategoryOwnedByUser(prisma, userId, categoryId);
  if (!category) throw notFound('Kategori tidak ditemukan');
}

// ---------------------------------------------------------------------------
// POST /tasks
// ---------------------------------------------------------------------------
tasksRouter.post('/tasks', async (req, res) => {
  const userId = req.user!.id;
  const input = taskInputSchema.parse(req.body);
  await assertCategoryOwned(userId, input.categoryId);

  const fields = taskInputToDbFields(input);
  const now = Date.now();

  const { task, reminderAt } = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({ data: { id: randomUUID(), userId, ...fields } });
    await syncReminder(tx, created, { timezone: req.user!.timezone }, now);
    const reminder = await tx.reminder.findFirst({ where: { taskId: created.id, status: 'PENDING' } });
    return { task: created, reminderAt: reminder?.remindAt ?? null };
  });

  const category = await findCategoryOwnedByUser(prisma, userId, task.categoryId);
  res.status(201).json(serializeTask(task, category!, now, req.user!.timezone, reminderAt));
});

// ---------------------------------------------------------------------------
// GET /tasks
// ---------------------------------------------------------------------------
tasksRouter.get('/tasks', async (req, res) => {
  const userId = req.user!.id;
  const query = taskListQuerySchema.parse(req.query);
  const now = Date.now();
  const tz = req.user!.timezone;

  const where: Prisma.TaskWhereInput = {
    userId,
    ...(query.status === 'active' ? { status: { not: 'DONE' } } : {}),
    ...(query.status === 'done' ? { status: 'DONE' } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.scope ? { category: { type: query.scope === 'kuliah' ? 'KULIAH' : 'PRIBADI' } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: escapeLikePattern(query.q), mode: 'insensitive' as const } },
            { description: { contains: escapeLikePattern(query.q), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const tasks = await prisma.task.findMany({ where, include: { category: true } });

  let filtered = tasks;
  if (query.priority) {
    filtered = filtered.filter((t) => priority(toDomainTask(t), now, tz).label === query.priority);
  }
  if (query.time) {
    const [start, end] = timeRangeMs(query.time, now, tz);
    filtered = filtered.filter((t) => matchesTimeFilter(t, start, end, now, tz));
  }

  const total = filtered.length;

  filtered.sort((a, b) => compareTasks(a, b, query.sort, now, tz));
  const page = filtered.slice(query.offset, query.offset + query.limit);

  const reminderMap = await pendingReminderMap(
    userId,
    page.map((t) => t.id),
  );

  res.status(200).json({
    items: page.map((t) => serializeTask(t, t.category, now, tz, reminderMap.get(t.id) ?? null)),
    total,
  });
});

function matchesTimeFilter(
  task: Task,
  start: number,
  end: number,
  now: number,
  tz: string,
): boolean {
  const domain = toDomainTask(task);
  if (task.type === 'DEADLINE' && task.status !== 'DONE') {
    const ev = eventTime(domain, now, tz);
    if (ev != null && ev < now) return true;
  }
  const ev = eventTime(domain, now, tz);
  if (ev == null) return false;
  return ev >= start && ev < end;
}

function compareTasks(
  a: Task,
  b: Task,
  sort: 'priority' | 'deadline' | 'newest',
  now: number,
  tz: string,
): number {
  const doneA = a.status === 'DONE' ? 1 : 0;
  const doneB = b.status === 'DONE' ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;

  if (sort === 'priority') {
    return priority(toDomainTask(b), now, tz).score - priority(toDomainTask(a), now, tz).score;
  }
  if (sort === 'deadline') {
    const evA = eventTime(toDomainTask(a), now, tz);
    const evB = eventTime(toDomainTask(b), now, tz);
    if (evA == null && evB == null) return 0;
    if (evA == null) return 1;
    if (evB == null) return -1;
    return evA - evB;
  }
  return b.createdAt.getTime() - a.createdAt.getTime();
}

// ---------------------------------------------------------------------------
// GET /tasks/analytics  (didaftarkan sebelum /tasks/:id agar tidak tertangkap sebagai id)
// ---------------------------------------------------------------------------
tasksRouter.get('/tasks/analytics', async (req, res) => {
  const userId = req.user!.id;
  const scope = typeof req.query.scope === 'string' ? req.query.scope : 'all';
  const where: Prisma.TaskWhereInput = {
    userId,
    ...(scope === 'kuliah' || scope === 'pribadi'
      ? { category: { type: scope === 'kuliah' ? 'KULIAH' : 'PRIBADI' } }
      : {}),
  };
  const tasks = await prisma.task.findMany({ where });
  const now = Date.now();
  const analytics = computeAnalytics(
    tasks.map((t) => toDomainTask(t)),
    now,
    req.user!.timezone,
  );
  res.status(200).json(analytics);
});

// ---------------------------------------------------------------------------
// POST /tasks/conflicts (dry-run)
// ---------------------------------------------------------------------------
tasksRouter.post('/tasks/conflicts', async (req, res) => {
  const userId = req.user!.id;
  const input = conflictCheckSchema.parse(req.body);
  await assertCategoryOwned(userId, input.candidate.categoryId);

  const now = Date.now();
  const tz = req.user!.timezone;
  const capacityHours = req.user!.dailyCapacityHours;

  const candidateId = input.excludeTaskId ?? randomUUID();
  const candidate: DomainTask = { ...taskInputCandidateToDomain(input.candidate), id: candidateId };

  const existingRows = await prisma.task.findMany({ where: { userId } });
  const titleById = new Map(existingRows.map((t) => [t.id, t.title]));
  const existing = existingRows.map((t) => toDomainTask(t));

  const result = checkConflicts(candidate, existing, now, tz, capacityHours, input.excludeTaskId);

  const opponent = (task: DomainTask) => ({
    id: task.id,
    title: titleById.get(task.id) ?? '',
    priority: priority(task, now, tz),
  });

  res.status(200).json({
    collisions: result.collisions.map((c) => ({
      task: opponent(c.task),
      start: new Date(c.start).toISOString(),
      end: new Date(c.end).toISOString(),
    })),
    buffers: result.buffers.map((b) => ({
      task: opponent(b.task),
      gapMinutes: b.gapMinutes,
      start: new Date(b.start).toISOString(),
      end: new Date(b.end).toISOString(),
    })),
    overload: result.overload.map((o) => ({ dayStart: new Date(o.dayStart).toISOString(), hours: o.hours })),
    suggestedSlot: result.suggestedSlot
      ? { start: new Date(result.suggestedSlot.start).toISOString(), end: new Date(result.suggestedSlot.end).toISOString() }
      : null,
    lowPriorityCandidate: result.lowPriorityCandidate ? opponent(result.lowPriorityCandidate) : null,
    any: result.any,
  });
});

function taskInputCandidateToDomain(input: ReturnType<typeof taskInputSchema.parse>): Omit<DomainTask, 'id'> {
  const fields = taskInputToDbFields(input);
  return {
    type: fields.type as DomainTask['type'],
    status: 'TODO',
    importance: fields.importance as number,
    difficulty: fields.difficulty as number,
    startAt: (fields.startAt as Date | null) ?? null,
    endAt: (fields.endAt as Date | null) ?? null,
    deadlineAt: (fields.deadlineAt as Date | null) ?? null,
    durationMinutes: (fields.durationMinutes as number | null) ?? null,
    routineDays: (fields.routineDays as number[] | undefined) ?? [],
    routineStartMinute: (fields.routineStartMinute as number | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// GET /tasks/:id
// ---------------------------------------------------------------------------
tasksRouter.get('/tasks/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const task = await prisma.task.findFirst({ where: { id, userId }, include: { category: true } });
  if (!task) throw notFound('Tugas tidak ditemukan');

  const reminder = await prisma.reminder.findFirst({ where: { taskId: id, status: 'PENDING' } });
  res.status(200).json(serializeTask(task, task.category, Date.now(), req.user!.timezone, reminder?.remindAt ?? null));
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id
// ---------------------------------------------------------------------------
tasksRouter.patch('/tasks/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Tugas tidak ditemukan');

  const body = req.body as Record<string, unknown>;
  const targetType = (body.type as string | undefined) ?? existing.type;

  const merged =
    targetType === existing.type
      ? { ...taskToPseudoInput(existing), ...body, type: targetType }
      : {
          title: existing.title,
          description: existing.description ?? '',
          categoryId: existing.categoryId,
          importance: existing.importance,
          difficulty: existing.difficulty,
          ...body,
          type: targetType,
        };

  const input = taskInputSchema.parse(merged);
  await assertCategoryOwned(userId, input.categoryId);

  const fields = taskInputToDbFields(input);
  const now = Date.now();

  const { task, reminderAt } = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: fields });
    await syncReminder(tx, updated, { timezone: req.user!.timezone }, now);
    const reminder = await tx.reminder.findFirst({ where: { taskId: id, status: 'PENDING' } });
    return { task: updated, reminderAt: reminder?.remindAt ?? null };
  });

  const category = await findCategoryOwnedByUser(prisma, userId, task.categoryId);
  res.status(200).json(serializeTask(task, category!, now, req.user!.timezone, reminderAt));
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id/status
// ---------------------------------------------------------------------------
tasksRouter.patch('/tasks/:id/status', async (req, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const { status } = taskStatusSchema.parse(req.body);

  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Tugas tidak ditemukan');

  const now = Date.now();
  const doneAt = status === 'DONE' ? new Date(now) : null;

  const { task, reminderAt } = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: { status, doneAt } });
    await syncReminder(tx, updated, { timezone: req.user!.timezone }, now);
    const reminder = await tx.reminder.findFirst({ where: { taskId: id, status: 'PENDING' } });
    return { task: updated, reminderAt: reminder?.remindAt ?? null };
  });

  const category = await findCategoryOwnedByUser(prisma, userId, task.categoryId);
  res.status(200).json(serializeTask(task, category!, now, req.user!.timezone, reminderAt));
});

// ---------------------------------------------------------------------------
// DELETE /tasks/:id
// ---------------------------------------------------------------------------
tasksRouter.delete('/tasks/:id', async (req, res) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Tugas tidak ditemukan');

  await prisma.task.delete({ where: { id } });
  res.status(204).end();
});
