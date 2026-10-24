import { describe, expect, it } from 'vitest';
import type { DomainTask } from '../types.js';
import { nextOccurrence, occurrencesBetween } from './routine.js';
import { localToUtc } from './time.js';

const TZ = 'Asia/Jakarta';

function routineTask(days: number[], startMinute: number, durationMinutes = 60): DomainTask {
  return {
    id: 'r1',
    type: 'ROUTINE',
    status: 'TODO',
    importance: 3,
    difficulty: 3,
    routineDays: days,
    routineStartMinute: startMinute,
    durationMinutes,
  };
}

describe('routine occurrences (Issue 016)', () => {
  it('"Senin 23:30" melewati batas hari UTC tetap benar', () => {
    const task = routineTask([1], 23 * 60 + 30, 60); // Senin 23:30 WIB (UTC+7) -> 16:30 UTC, tidak lewat tengah malam UTC sebenarnya
    const from = localToUtc({ date: '2026-10-05', time: '00:00' }, TZ);
    const ev = nextOccurrence(task, from, TZ);
    expect(ev).toBe(localToUtc({ date: '2026-10-05', time: '23:30' }, TZ));
  });

  it('kemunculan berikutnya untuk hari yang sama bila belum lewat', () => {
    const task = routineTask([3, 5], 19 * 60 + 30, 60); // Rabu & Jumat 19:30
    const from = localToUtc({ date: '2026-10-05', time: '08:00' }, TZ); // Senin
    const ev = nextOccurrence(task, from, TZ);
    expect(ev).toBe(localToUtc({ date: '2026-10-07', time: '19:30' }, TZ)); // Rabu terdekat
  });

  it('occurrencesBetween mengembalikan semua kemunculan dalam rentang', () => {
    const task = routineTask([1, 3, 5], 19 * 60, 60);
    const from = localToUtc({ date: '2026-10-05', time: '00:00' }, TZ);
    const to = localToUtc({ date: '2026-10-12', time: '00:00' }, TZ);
    const occ = occurrencesBetween(task, from, to, TZ);
    expect(occ).toHaveLength(3); // Senin, Rabu, Jumat dalam 1 minggu
  });
});
