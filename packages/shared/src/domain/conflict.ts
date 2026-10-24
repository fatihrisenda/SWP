import { BUFFER_MINUTES, CONFLICT_HORIZON_DAYS, DAY_MS, DEFAULT_CAPACITY_HOURS, HOUR_MS } from '../constants.js';
import type { DomainTask } from '../types.js';
import { priority } from './priority.js';
import { occurrencesBetween } from './routine.js';
import { startOfDay, taskDurationHours } from './time.js';

const BUFFER_MS = BUFFER_MINUTES * 60_000;

/** Interval [start,end) milik tugas pada rentang [fromMs,toMs). Hanya FIXED_TIME & ROUTINE memakai slot waktu. */
export function taskIntervals(task: DomainTask, fromMs: number, toMs: number, tz: string): Array<[number, number]> {
  if (task.type === 'FIXED_TIME') {
    if (!task.startAt || !task.endAt) return [];
    const s = task.startAt.getTime();
    const e = task.endAt.getTime();
    return e > fromMs && s < toMs ? [[s, e]] : [];
  }
  if (task.type === 'ROUTINE') return occurrencesBetween(task, fromMs, toMs, tz);
  return [];
}

/** Beban (jam) pada satu hari: FIXED/ROUTINE dari interval; DEADLINE disebar rata dari hari ini s.d. hari deadline. */
export function dayLoad(dayStartMs: number, tasks: DomainTask[], now: number, tz: string): number {
  const dayEndMs = dayStartMs + DAY_MS;
  let hours = 0;
  for (const t of tasks) {
    if (t.status === 'DONE') continue;
    if (t.type === 'DEADLINE') {
      if (!t.deadlineAt) continue;
      const today = startOfDay(now, tz);
      const dlDay = startOfDay(t.deadlineAt.getTime(), tz);
      const lastDay = Math.max(today, dlDay);
      if (dayStartMs < today || dayStartMs > lastDay) continue;
      const days = Math.round((lastDay - today) / DAY_MS) + 1;
      hours += taskDurationHours(t) / days;
    } else {
      for (const [s, e] of taskIntervals(t, dayStartMs, dayEndMs, tz)) {
        hours += (Math.min(e, dayEndMs) - Math.max(s, dayStartMs)) / HOUR_MS;
      }
    }
  }
  return hours;
}

export interface ConflictResult {
  collisions: Array<{ task: DomainTask; start: number; end: number }>;
  buffers: Array<{ task: DomainTask; gapMinutes: number; start: number; end: number }>;
  overload: Array<{ dayStart: number; hours: number }>;
  suggestedSlot: { start: number; end: number } | null;
  lowPriorityCandidate: DomainTask | null;
  any: boolean;
}

/** Hanya untuk kandidat FIXED_TIME: geser mulai setelah penghalang terakhir + buffer, bulatkan ke 15 menit. */
export function suggestSlot(
  candidate: DomainTask,
  others: DomainTask[],
  _now: number,
  tz: string,
): { start: number; end: number } | null {
  if (candidate.type !== 'FIXED_TIME' || !candidate.startAt || !candidate.endAt) return null;
  const startMs = candidate.startAt.getTime();
  const duration = candidate.endAt.getTime() - startMs;
  const blockers = others.filter((o) => o.id !== candidate.id && o.status !== 'DONE' && o.type !== 'DEADLINE');

  let cursor = startMs;
  for (let i = 0; i < 24; i++) {
    const s = cursor;
    const e = cursor + duration;
    let blockerEnd: number | null = null;
    for (const o of blockers) {
      for (const [b1, b2] of taskIntervals(o, s - DAY_MS, e + DAY_MS, tz)) {
        if (s < b2 + BUFFER_MS && b1 - BUFFER_MS < e && (blockerEnd == null || b2 > blockerEnd)) {
          blockerEnd = b2;
        }
      }
    }
    if (blockerEnd == null) return cursor === startMs ? null : { start: s, end: e };
    cursor = Math.ceil((blockerEnd + BUFFER_MS) / (15 * 60_000)) * 15 * 60_000;
  }
  return null;
}

/**
 * Deteksi tabrakan, buffer < 30 menit, dan overcommitment harian (FR-04); mengembalikan saran slot &
 * kandidat tugas prioritas rendah untuk dihapus. `excludeTaskId` dipakai saat mengedit tugas (FR-04.6).
 */
export function checkConflicts(
  candidate: DomainTask,
  existing: DomainTask[],
  now: number,
  tz: string,
  capacityHours: number = DEFAULT_CAPACITY_HOURS,
  excludeTaskId?: string,
): ConflictResult {
  const others = existing.filter((t) => t.id !== candidate.id && t.id !== excludeTaskId && t.status !== 'DONE');
  const from = now;
  const to = now + CONFLICT_HORIZON_DAYS * DAY_MS;
  const mine = taskIntervals(candidate, from, to, tz);

  const collisions: ConflictResult['collisions'] = [];
  const buffers: ConflictResult['buffers'] = [];
  const seen = new Set<string>();

  for (const other of others) {
    if (other.type === 'DEADLINE') continue;
    const theirs = taskIntervals(other, from, to, tz);
    findOpponent: for (const [a1, a2] of mine) {
      for (const [b1, b2] of theirs) {
        if (a1 < b2 && b1 < a2) {
          if (!seen.has(other.id)) {
            collisions.push({ task: other, start: b1, end: b2 });
            seen.add(other.id);
          }
          break findOpponent;
        }
        const gap = a1 >= b2 ? a1 - b2 : b1 - a2;
        if (gap < BUFFER_MS && !seen.has(other.id)) {
          buffers.push({ task: other, gapMinutes: Math.round(gap / 60_000), start: b1, end: b2 });
          seen.add(other.id);
          break findOpponent;
        }
      }
    }
  }

  const all = [...others, candidate];
  const days = new Set<number>();
  if (candidate.type === 'DEADLINE' && candidate.deadlineAt) {
    const today = startOfDay(now, tz);
    const dl = startOfDay(candidate.deadlineAt.getTime(), tz);
    const last = Math.max(today, dl);
    for (let d = today; d <= last && days.size < CONFLICT_HORIZON_DAYS; d += DAY_MS) days.add(d);
  } else {
    for (const [s] of mine) days.add(startOfDay(s, tz));
  }

  const overload: ConflictResult['overload'] = [];
  for (const d of Array.from(days).sort((a, b) => a - b)) {
    const hours = dayLoad(d, all, now, tz);
    if (hours > capacityHours + 1e-6) overload.push({ dayStart: d, hours: Math.round(hours * 10) / 10 });
  }
  const overloadTop3 = overload.slice(0, 3);

  const suggestedSlot = suggestSlot(candidate, others, now, tz);

  const candScore = priority(candidate, now, tz).score;
  const lowest = (pool: DomainTask[]): DomainTask | null => {
    const lower = pool.filter((o) => priority(o, now, tz).score < candScore);
    if (!lower.length) return null;
    return lower.reduce((min, o) => (priority(o, now, tz).score < priority(min, now, tz).score ? o : min));
  };

  let lowPriorityCandidate = lowest([...collisions.map((c) => c.task), ...buffers.map((b) => b.task)]);
  if (!lowPriorityCandidate && overloadTop3.length) {
    const overloadDays = new Set(overloadTop3.map((o) => o.dayStart));
    const contributors = others.filter(
      (o) => o.type !== 'DEADLINE' && taskIntervals(o, from, to, tz).some(([s]) => overloadDays.has(startOfDay(s, tz))),
    );
    lowPriorityCandidate = lowest(contributors);
  }

  return {
    collisions,
    buffers,
    overload: overloadTop3,
    suggestedSlot,
    lowPriorityCandidate,
    any: collisions.length > 0 || buffers.length > 0 || overloadTop3.length > 0,
  };
}
