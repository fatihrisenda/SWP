import { describe, expect, it } from 'vitest';
import type { DomainTask } from '../types.js';
import { compareByPriority, isHighPriority, priority } from './priority.js';

const TZ = 'Asia/Jakarta';
// 2026-10-05 08:00 WIB (UTC+7) = 2026-10-05T01:00:00.000Z
const NOW = Date.UTC(2026, 9, 5, 1, 0, 0);
const H = 3_600_000;

function base(overrides: Partial<DomainTask>): DomainTask {
  return {
    id: 't1',
    type: 'DEADLINE',
    status: 'TODO',
    importance: 3,
    difficulty: 3,
    ...overrides,
  };
}

describe('priority engine (Issue 017 golden tests)', () => {
  it('DEADLINE +48h, durasi 2j, imp5 diff4 -> 44.5 TOP', () => {
    const task = base({
      type: 'DEADLINE',
      importance: 5,
      difficulty: 4,
      deadlineAt: new Date(NOW + 48 * H),
      durationMinutes: 120,
    });
    const p = priority(task, NOW, TZ);
    expect(p.score).toBeCloseTo(44.5, 1);
    expect(p.label).toBe('TOP');
  });

  it('FIXED mulai +24h, imp4 diff4 -> 39.6 TOP', () => {
    const task = base({
      type: 'FIXED_TIME',
      importance: 4,
      difficulty: 4,
      startAt: new Date(NOW + 24 * H),
      endAt: new Date(NOW + 25 * H),
    });
    const p = priority(task, NOW, TZ);
    expect(p.score).toBeCloseTo(39.6, 1);
    expect(p.label).toBe('TOP');
  });

  it('DEADLINE +120h, durasi 3j, imp4 diff3 -> 20.5 MEDIUM', () => {
    const task = base({
      type: 'DEADLINE',
      importance: 4,
      difficulty: 3,
      deadlineAt: new Date(NOW + 120 * H),
      durationMinutes: 180,
    });
    const p = priority(task, NOW, TZ);
    expect(p.score).toBeCloseTo(20.5, 1);
    expect(p.label).toBe('MEDIUM');
  });

  it('DEADLINE +480h, durasi 1j, imp2 diff1 -> 1.6 LOW (urgency clamp ke 1)', () => {
    const task = base({
      type: 'DEADLINE',
      importance: 2,
      difficulty: 1,
      deadlineAt: new Date(NOW + 480 * H),
      durationMinutes: 60,
    });
    const p = priority(task, NOW, TZ);
    expect(p.score).toBeCloseTo(1.6, 1);
    expect(p.label).toBe('LOW');
  });

  it('FIXED sudah berakhir, imp3 diff3 -> 3.0 LOW', () => {
    const task = base({
      type: 'FIXED_TIME',
      importance: 3,
      difficulty: 3,
      startAt: new Date(NOW - 2 * H),
      endAt: new Date(NOW - 1 * H),
    });
    const p = priority(task, NOW, TZ);
    expect(p.score).toBeCloseTo(3.0, 1);
    expect(p.label).toBe('LOW');
  });

  it('DEADLINE terlambat 5h, durasi 2j, imp3 diff3 -> 30.0 HIGH (urgency clamp ke 10)', () => {
    const task = base({
      type: 'DEADLINE',
      importance: 3,
      difficulty: 3,
      deadlineAt: new Date(NOW - 5 * H),
      durationMinutes: 120,
    });
    const p = priority(task, NOW, TZ);
    expect(p.score).toBeCloseTo(30.0, 1);
    expect(p.label).toBe('HIGH');
  });

  it('batas skor tepat 36 / 24 / 12 -> TOP / HIGH / MEDIUM', () => {
    // urgency=10, importance=4, modifier=0.9 -> score=36 tepat
    const top = base({ type: 'FIXED_TIME', importance: 4, difficulty: 2, startAt: new Date(NOW), endAt: new Date(NOW + H) });
    expect(priority(top, NOW, TZ).score).toBeCloseTo(36, 1);
    expect(priority(top, NOW, TZ).label).toBe('TOP');

    // urgency=10, importance=3, modifier=0.8 -> score=24 tepat
    const high = base({ type: 'FIXED_TIME', importance: 3, difficulty: 1, startAt: new Date(NOW), endAt: new Date(NOW + H) });
    expect(priority(high, NOW, TZ).score).toBeCloseTo(24, 1);
    expect(priority(high, NOW, TZ).label).toBe('HIGH');

    // urgency=10, importance=1.2*10=12 -> gunakan imp=1, diff=... cari kombinasi skor 12
    // 10 * importance * modifier = 12 -> importance=1.5 tidak valid int; gunakan diff utk uji batas MEDIUM dgn importance=2,modifier=0.6->tidak valid (min 0.8)
    // Pakai urgency lebih kecil: urgency=5, importance=3, modifier=0.8 -> 12 tepat
    const medium = base({
      type: 'DEADLINE',
      importance: 3,
      difficulty: 1,
      deadlineAt: new Date(NOW + (10 - 5) * 24 * H),
      durationMinutes: 0,
    });
    expect(priority(medium, NOW, TZ).score).toBeCloseTo(12, 1);
    expect(priority(medium, NOW, TZ).label).toBe('MEDIUM');
  });

  it('skor selalu dalam [0.8, 60]; menaikkan importance tidak pernah menurunkan skor', () => {
    for (let imp = 1; imp <= 5; imp++) {
      for (let diff = 1; diff <= 5; diff++) {
        const task = base({
          type: 'DEADLINE',
          importance: imp,
          difficulty: diff,
          deadlineAt: new Date(NOW + 10 * H),
          durationMinutes: 30,
        });
        const score = priority(task, NOW, TZ).score;
        expect(score).toBeGreaterThanOrEqual(0.8);
        expect(score).toBeLessThanOrEqual(60);
        if (imp < 5) {
          const next = priority(base({ ...task, importance: imp + 1 }), NOW, TZ).score;
          expect(next).toBeGreaterThanOrEqual(score);
        }
      }
    }
  });

  it('ROUTINE sedang berlangsung memakai kemunculan hari ini', () => {
    // hari ini (2026-10-05 = Senin) mulai jam 07:00 WIB, durasi 2 jam -> sedang berlangsung di jam 08:00
    const task = base({
      type: 'ROUTINE',
      importance: 3,
      difficulty: 3,
      routineDays: [1, 2, 3, 4, 5],
      routineStartMinute: 7 * 60,
      durationMinutes: 120,
    });
    const p = priority(task, NOW, TZ);
    // event sudah mulai 1 jam lalu -> hoursUntil negatif -> urgency clamp ke 10
    expect(p.urgency).toBe(10);
  });

  it('isHighPriority true untuk TOP/HIGH, false untuk MEDIUM/LOW', () => {
    const top = base({ type: 'FIXED_TIME', importance: 5, difficulty: 5, startAt: new Date(NOW), endAt: new Date(NOW + H) });
    const low = base({ type: 'DEADLINE', importance: 1, difficulty: 1, deadlineAt: new Date(NOW + 400 * H), durationMinutes: 30 });
    expect(isHighPriority(top, NOW, TZ)).toBe(true);
    expect(isHighPriority(low, NOW, TZ)).toBe(false);
  });

  it('compareByPriority: DONE selalu di bawah, lalu skor menurun', () => {
    const doneTop = base({ type: 'FIXED_TIME', status: 'DONE', importance: 5, difficulty: 5, startAt: new Date(NOW), endAt: new Date(NOW + H) });
    const activeLow = base({ type: 'DEADLINE', importance: 1, difficulty: 1, deadlineAt: new Date(NOW + 400 * H), durationMinutes: 30 });
    const activeHigh = base({ type: 'FIXED_TIME', importance: 5, difficulty: 5, startAt: new Date(NOW), endAt: new Date(NOW + H) });
    const sorted = [doneTop, activeLow, activeHigh].sort((a, b) => compareByPriority(a, b, NOW, TZ));
    expect(sorted.map((t) => t.id)).toEqual([activeHigh.id, activeLow.id, doneTop.id]);
  });
});
