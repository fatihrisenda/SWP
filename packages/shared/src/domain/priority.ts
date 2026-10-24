import { PRIORITY_THRESHOLDS } from '../constants.js';
import type { DomainTask, PriorityLabel } from '../types.js';
import { eventTime, taskDurationHours } from './eventTime.js';

const HOUR_MS = 3_600_000;

export interface Priority {
  score: number;
  label: PriorityLabel;
  urgency: number;
}

/** DifficultyModifier = 0.8 + (difficulty-1)*0.1 → 0.8..1.2 (SKPL 4.5.2-A). */
export function difficultyModifier(difficulty: number): number {
  return 0.8 + (difficulty - 1) * 0.1;
}

/**
 * Urgency (1..10, clamp):
 *  FIXED_TIME : 10 - hours_until_start/24 (sudah berakhir → 1)
 *  DEADLINE   : 10 - (hours_until_deadline - duration_hours)/24
 *  ROUTINE    : seperti FIXED_TIME memakai kemunculan berikutnya
 */
export function urgency(task: DomainTask, now: number, tz: string): number {
  if (task.type === 'FIXED_TIME' && task.endAt && task.endAt.getTime() < now) return 1;

  const ev = eventTime(task, now, tz);
  if (ev == null) return 1;

  const hoursUntil = (ev - now) / HOUR_MS;
  const raw = task.type === 'DEADLINE' ? 10 - (hoursUntil - taskDurationHours(task)) / 24 : 10 - hoursUntil / 24;
  return Math.min(10, Math.max(1, raw));
}

/** Priority = Urgency x Importance(1..5) x DifficultyModifier. Label pakai skor mentah (D-27). */
export function priority(task: DomainTask, now: number, tz: string): Priority {
  const u = urgency(task, now, tz);
  const mod = difficultyModifier(task.difficulty);
  const rawScore = u * task.importance * mod;
  const score = Math.round(rawScore * 10) / 10;

  let label: PriorityLabel;
  if (score >= PRIORITY_THRESHOLDS.TOP) label = 'TOP';
  else if (score >= PRIORITY_THRESHOLDS.HIGH) label = 'HIGH';
  else if (score >= PRIORITY_THRESHOLDS.MEDIUM) label = 'MEDIUM';
  else label = 'LOW';

  return { score, label, urgency: Math.round(u * 10) / 10 };
}

export function isHighPriority(task: DomainTask, now: number, tz: string): boolean {
  const { label } = priority(task, now, tz);
  return label === 'TOP' || label === 'HIGH';
}

/** Tugas DONE selalu paling bawah (UC #3 langkah 6); selain itu skor menurun. */
export function compareByPriority(a: DomainTask, b: DomainTask, now: number, tz: string): number {
  const doneA = a.status === 'DONE' ? 1 : 0;
  const doneB = b.status === 'DONE' ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;
  return priority(b, now, tz).score - priority(a, now, tz).score;
}

export { taskDurationHours, eventTime } from './eventTime.js';
