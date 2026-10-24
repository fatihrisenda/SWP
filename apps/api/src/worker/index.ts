import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Prisma } from '@prisma/client';
import { eventTime, taskDurationHours, type Locale } from '@swp/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { syncReminder, toDomainTask } from '../lib/reminderService.js';
import { buildReminderPayload } from '../lib/notificationPayload.js';
import { sendPushNotification } from '../lib/push.js';

const BATCH_SIZE = 50;
const RETRY_DELAYS_MINUTES = [1, 5, 15];
const ALIVE_FILE = process.env.WORKER_ALIVE_FILE ?? '/tmp/worker.alive';

export interface BatchResult {
  processed: number;
  sent: number;
  failed: number;
  expired: number;
  cancelled: number;
}

/**
 * Satu iterasi worker (Issue 031): ambil s.d. 50 reminder jatuh tempo dengan
 * `SELECT ... FOR UPDATE SKIP LOCKED` agar aman dijalankan lebih dari satu instance sekaligus.
 */
export async function processBatch(now: number = Date.now()): Promise<BatchResult> {
  const result: BatchResult = { processed: 0, sent: 0, failed: 0, expired: 0, cancelled: 0 };

  await prisma.$transaction(
    async (tx) => {
      const due = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM reminders WHERE status = 'PENDING' AND remind_at <= ${new Date(now)} ORDER BY remind_at LIMIT ${BATCH_SIZE} FOR UPDATE SKIP LOCKED`,
      );

      for (const row of due) {
        result.processed += 1;
        const reminder = await tx.reminder.findUnique({
          where: { id: row.id },
          include: { task: { include: { category: true } }, user: true },
        });
        if (!reminder) continue;

        const { task, user } = reminder;
        if (!task || task.status === 'DONE') {
          await tx.reminder.update({ where: { id: reminder.id }, data: { status: 'CANCELLED' } });
          result.cancelled += 1;
          continue;
        }

        if (reminder.eventAt.getTime() < now) {
          await tx.reminder.update({ where: { id: reminder.id }, data: { status: 'EXPIRED' } });
          result.expired += 1;
          if (task.type === 'ROUTINE') {
            const durMs = taskDurationHours(toDomainTask(task)) * 3_600_000;
            await syncReminder(tx, task, user, reminder.eventAt.getTime() + durMs);
          }
          continue;
        }

        const subs = await tx.pushSubscription.findMany({ where: { userId: user.id } });
        if (subs.length === 0) {
          await tx.reminder.update({
            where: { id: reminder.id },
            data: { status: 'FAILED', lastError: 'NO_SUBSCRIPTION' },
          });
          result.failed += 1;
          continue;
        }

        const domainTask = toDomainTask(task);
        const payload = buildReminderPayload({
          task: domainTask,
          taskTitle: task.title,
          category: task.category,
          eventAt: eventTime(domainTask, now, user.timezone) ?? reminder.eventAt.getTime(),
          timezone: user.timezone,
          locale: (user.locale === 'en' ? 'en' : 'id') as Locale,
          now,
        });
        const ttlSeconds = Math.min(24 * 3600, Math.max(0, Math.round((reminder.eventAt.getTime() - now) / 1000)));

        let anySuccess = false;
        for (const sub of subs) {
          const sendResult = await sendPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: ttlSeconds, urgency: 'normal' },
          );
          if (sendResult.ok) {
            anySuccess = true;
            await tx.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date(now) } });
          } else if (sendResult.expired) {
            await tx.pushSubscription.delete({ where: { id: sub.id } });
          }
        }

        if (anySuccess) {
          await tx.reminder.update({ where: { id: reminder.id }, data: { status: 'SENT', sentAt: new Date(now) } });
          result.sent += 1;
          if (task.type === 'ROUTINE') {
            const durMs = taskDurationHours(domainTask) * 3_600_000;
            await syncReminder(tx, task, user, reminder.eventAt.getTime() + durMs);
          }
        } else {
          const attempts = reminder.attempts + 1;
          if (attempts >= 3) {
            await tx.reminder.update({
              where: { id: reminder.id },
              data: { status: 'FAILED', attempts, lastError: 'SEND_FAILED' },
            });
          } else {
            const delayMin = RETRY_DELAYS_MINUTES[attempts - 1] ?? 15;
            await tx.reminder.update({
              where: { id: reminder.id },
              data: { attempts, remindAt: new Date(now + delayMin * 60_000), lastError: 'SEND_FAILED' },
            });
          }
          result.failed += 1;
        }
      }
    },
    { timeout: 20_000 },
  );

  return result;
}

/** Pembersihan harian (Issue 031 langkah 5): sesi/reminder/mood kedaluwarsa. */
export async function runDailyCleanup(now: number = Date.now()): Promise<void> {
  const sevenDaysAgo = new Date(now - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000);
  const twelveMonthsAgo = new Date(now - 365 * 86_400_000);

  await prisma.session.deleteMany({ where: { expiresAt: { lt: sevenDaysAgo } } });
  await prisma.reminder.deleteMany({
    where: { status: { in: ['SENT', 'CANCELLED', 'FAILED', 'EXPIRED'] }, createdAt: { lt: thirtyDaysAgo } },
  });
  await prisma.moodEntry.deleteMany({ where: { createdAt: { lt: twelveMonthsAgo } } });
}

function touchAliveFile(): void {
  try {
    fs.writeFileSync(ALIVE_FILE, String(Date.now()));
  } catch {
    // Best-effort healthcheck file; tidak fatal bila gagal ditulis (mis. filesystem read-only).
  }
}

let stopping = false;
let lastCleanupDay = '';

async function runIteration(): Promise<void> {
  try {
    const result = await processBatch();
    logger.info(result, 'reminder worker iteration complete');

    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastCleanupDay) {
      lastCleanupDay = today;
      await runDailyCleanup();
    }
    touchAliveFile();
  } catch (err) {
    logger.error({ err }, 'worker iteration failed');
  }
}

export function startWorker(): { stop: () => void } {
  stopping = false;
  let timer: NodeJS.Timeout | undefined;

  const loop = (): void => {
    if (stopping) return;
    runIteration()
      .catch((err: unknown) => logger.error({ err }, 'worker iteration crashed'))
      .finally(() => {
        if (!stopping) timer = setTimeout(loop, env.REMINDER_POLL_SECONDS * 1000);
      });
  };
  loop();

  return {
    stop: () => {
      stopping = true;
      if (timer) clearTimeout(timer);
    },
  };
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMainModule) {
  const handle = startWorker();
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Worker shutting down gracefully');
    handle.stop();
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
