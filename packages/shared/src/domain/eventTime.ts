import type { DomainTask } from '../types.js';
import { nextOccurrence } from './routine.js';

/** Waktu acara yang relevan untuk urgency/reminder/konflik: FIXED→mulai, DEADLINE→deadline, ROUTINE→kemunculan berikutnya. */
export function eventTime(task: DomainTask, now: number, tz: string): number | null {
  if (task.type === 'FIXED_TIME') return task.startAt ? task.startAt.getTime() : null;
  if (task.type === 'DEADLINE') return task.deadlineAt ? task.deadlineAt.getTime() : null;
  return nextOccurrence(task, now, tz);
}

export { taskDurationHours } from './time.js';
