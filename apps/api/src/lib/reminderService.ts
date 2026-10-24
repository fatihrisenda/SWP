import type { Prisma, Task, User } from '@prisma/client';
import { computeReminderAt, type DomainTask } from '@swp/shared';
import { randomUUID } from 'node:crypto';

type Tx = Prisma.TransactionClient;

/** Adapter dari record Prisma Task ke `DomainTask` yang dipakai fungsi murni di `@swp/shared`. */
export function toDomainTask(task: Task): DomainTask {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    importance: task.importance,
    difficulty: task.difficulty,
    createdAt: task.createdAt,
    startAt: task.startAt,
    endAt: task.endAt,
    deadlineAt: task.deadlineAt,
    durationMinutes: task.durationMinutes,
    routineDays: task.routineDays,
    routineStartMinute: task.routineStartMinute,
  };
}

/**
 * ReminderService.sync (Issue 029): batalkan semua reminder PENDING tugas ini lalu buat satu PENDING
 * baru bila relevan. Wajib dipanggil di dalam transaksi create/update/status tugas.
 */
export async function syncReminder(tx: Tx, task: Task, user: Pick<User, 'timezone'>, now: number = Date.now()): Promise<void> {
  await tx.reminder.updateMany({
    where: { taskId: task.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });

  const computed = computeReminderAt(toDomainTask(task), now, user.timezone);
  if (!computed) return;

  await tx.reminder.create({
    data: {
      id: randomUUID(),
      taskId: task.id,
      userId: task.userId,
      remindAt: new Date(computed.remindAt),
      eventAt: new Date(computed.eventAt),
      status: 'PENDING',
    },
  });
}

/** Dipakai saat user mengganti timezone: hitung ulang reminder untuk seluruh tugas ROUTINE-nya. */
export async function syncAllRoutineReminders(tx: Tx, userId: string, timezone: string, now: number = Date.now()): Promise<void> {
  const tasks = await tx.task.findMany({ where: { userId, type: 'ROUTINE', status: { not: 'DONE' } } });
  for (const task of tasks) {
    await syncReminder(tx, task, { timezone }, now);
  }
}
