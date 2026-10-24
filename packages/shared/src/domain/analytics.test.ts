import { describe, expect, it } from 'vitest';
import type { DomainTask } from '../types.js';
import { computeAnalytics } from './analytics.js';
import { localToUtc } from './time.js';

const TZ = 'Asia/Jakarta';
const NOW = localToUtc({ date: '2026-10-05', time: '08:00' }, TZ);
const H = 3_600_000;

describe('computeAnalytics (Issue 025, D-08)', () => {
  it('5 tugas (2 DONE, 2 HIGH aktif) menghasilkan angka sesuai D-08', () => {
    const tasks: DomainTask[] = [
      // DONE, tidak dihitung di totalHours/highPriority
      { id: '1', type: 'DEADLINE', status: 'DONE', importance: 5, difficulty: 5, deadlineAt: new Date(NOW + H), durationMinutes: 120 },
      { id: '2', type: 'DEADLINE', status: 'DONE', importance: 1, difficulty: 1, deadlineAt: new Date(NOW + H), durationMinutes: 60 },
      // Aktif, HIGH (urgency tinggi karena deadline dekat)
      { id: '3', type: 'DEADLINE', status: 'TODO', importance: 4, difficulty: 4, deadlineAt: new Date(NOW + 20 * H), durationMinutes: 60 },
      { id: '4', type: 'FIXED_TIME', status: 'IN_PROGRESS', importance: 4, difficulty: 4, startAt: new Date(NOW + H), endAt: new Date(NOW + 2 * H) },
      // Aktif, LOW
      { id: '5', type: 'DEADLINE', status: 'TODO', importance: 1, difficulty: 1, deadlineAt: new Date(NOW + 400 * H), durationMinutes: 30 },
    ];
    const a = computeAnalytics(tasks, NOW, TZ);
    expect(a.total).toBe(5);
    expect(a.done).toBe(2);
    expect(a.active).toBe(3);
    expect(a.highPriority).toBe(2);
    expect(a.totalHours).toBeCloseTo(1 + 1 + 0.5, 1);
  });

  it('tugas kosong', () => {
    expect(computeAnalytics([], NOW, TZ)).toEqual({ total: 0, done: 0, active: 0, totalHours: 0, highPriority: 0 });
  });
});
