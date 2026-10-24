import { REMINDER_LEAD_HOURS, ROUTINE_LEAD_MINUTES } from '../constants.js';
import type { DomainTask } from '../types.js';
import { eventTime, taskDurationHours } from './priority.js';
import { nextOccurrence } from './routine.js';

export interface ReminderComputation {
  remindAt: number;
  eventAt: number;
}

/**
 * Hitung kapan reminder berikutnya harus dikirim (D-11).
 * - DEADLINE/FIXED_TIME: H-24; bila < 1 menit lagi → H-1; bila masih < 1 menit lagi / sudah lewat → null.
 * - ROUTINE: 30 menit sebelum kemunculan berikutnya; bila sudah terlalu dekat/lewat → kemunculan sesudahnya.
 * - status DONE → null.
 */
export function computeReminderAt(task: DomainTask, now: number, tz: string): ReminderComputation | null {
  if (task.status === 'DONE') return null;

  if (task.type === 'ROUTINE') {
    const ev = nextOccurrence(task, now, tz);
    if (ev == null) return null;
    const remindAt = ev - ROUTINE_LEAD_MINUTES * 60_000;
    if (remindAt > now) return { remindAt, eventAt: ev };

    const durMs = taskDurationHours(task) * 3_600_000;
    const ev2 = nextOccurrence(task, ev + durMs, tz);
    if (ev2 == null) return null;
    const remindAt2 = ev2 - ROUTINE_LEAD_MINUTES * 60_000;
    return remindAt2 > now ? { remindAt: remindAt2, eventAt: ev2 } : null;
  }

  const ev = eventTime(task, now, tz);
  if (ev == null || ev < now) return null;

  const oneMinute = 60_000;
  let remindAt = ev - REMINDER_LEAD_HOURS * 3_600_000;
  if (remindAt < now + oneMinute) {
    remindAt = ev - 3_600_000;
    if (remindAt < now + oneMinute) return null;
  }
  return { remindAt, eventAt: ev };
}
