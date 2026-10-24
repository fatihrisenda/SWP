import { describe, expect, it } from 'vitest';
import type { DomainTask } from '../types.js';
import { computeReminderAt } from './reminder.js';
import { localToUtc } from './time.js';

const TZ = 'Asia/Jakarta';
const NOW = localToUtc({ date: '2026-10-05', time: '08:00' }, TZ);
const H = 3_600_000;

function deadlineTask(hoursUntil: number, overrides: Partial<DomainTask> = {}): DomainTask {
  return {
    id: 'd1',
    type: 'DEADLINE',
    status: 'TODO',
    importance: 3,
    difficulty: 3,
    deadlineAt: new Date(NOW + hoursUntil * H),
    durationMinutes: 60,
    ...overrides,
  };
}

describe('reminder calculator (Issue 020, D-11)', () => {
  it('dibuat 3 hari sebelum -> remind H-24', () => {
    const task = deadlineTask(72);
    const r = computeReminderAt(task, NOW, TZ);
    expect(r).not.toBeNull();
    expect(r!.remindAt).toBe(task.deadlineAt!.getTime() - 24 * H);
  });

  it('sisa 10 jam (< 24j) -> remind H-1', () => {
    const task = deadlineTask(10);
    const r = computeReminderAt(task, NOW, TZ);
    expect(r).not.toBeNull();
    expect(r!.remindAt).toBe(task.deadlineAt!.getTime() - H);
  });

  it('sisa 30 menit -> tidak ada reminder (null)', () => {
    const task = deadlineTask(0.5);
    const r = computeReminderAt(task, NOW, TZ);
    expect(r).toBeNull();
  });

  it('sudah lewat -> null', () => {
    const task = deadlineTask(-5);
    const r = computeReminderAt(task, NOW, TZ);
    expect(r).toBeNull();
  });

  it('status DONE -> null', () => {
    const task = deadlineTask(72, { status: 'DONE' });
    const r = computeReminderAt(task, NOW, TZ);
    expect(r).toBeNull();
  });

  it('ROUTINE: 30 menit sebelum kemunculan berikutnya', () => {
    const task: DomainTask = {
      id: 'r1',
      type: 'ROUTINE',
      status: 'TODO',
      importance: 3,
      difficulty: 3,
      routineDays: [3], // Rabu, 2026-10-07
      routineStartMinute: 19 * 60 + 30,
      durationMinutes: 60,
    };
    const r = computeReminderAt(task, NOW, TZ);
    expect(r).not.toBeNull();
    expect(r!.eventAt).toBe(localToUtc({ date: '2026-10-07', time: '19:30' }, TZ));
    expect(r!.remindAt).toBe(r!.eventAt - 30 * 60_000);
  });

  it('ROUTINE sedang berlangsung -> reminder untuk kemunculan berikutnya sesudahnya', () => {
    const task: DomainTask = {
      id: 'r2',
      type: 'ROUTINE',
      status: 'TODO',
      importance: 3,
      difficulty: 3,
      routineDays: [1, 2, 3, 4, 5], // termasuk Senin (hari ini)
      routineStartMinute: 7 * 60, // 07:00, now = 08:00 -> sedang berlangsung (durasi 2 jam)
      durationMinutes: 120,
    };
    const r = computeReminderAt(task, NOW, TZ);
    expect(r).not.toBeNull();
    // kemunculan hari ini sudah lewat remind window -> harus loncat ke esok hari (Selasa)
    expect(r!.eventAt).toBe(localToUtc({ date: '2026-10-06', time: '07:00' }, TZ));
  });
});
