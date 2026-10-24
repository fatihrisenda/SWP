import { describe, expect, it } from 'vitest';
import type { DomainTask } from '../types.js';
import { checkConflicts, dayLoad } from './conflict.js';
import { localToUtc } from './time.js';

const TZ = 'Asia/Jakarta';
const NOW = localToUtc({ date: '2026-10-05', time: '08:00' }, TZ); // Senin

let seq = 0;
function fixed(date: string, start: string, end: string, overrides: Partial<DomainTask> = {}): DomainTask {
  seq += 1;
  return {
    id: `fixed-${seq}`,
    type: 'FIXED_TIME',
    status: 'TODO',
    importance: 3,
    difficulty: 3,
    startAt: new Date(localToUtc({ date, time: start }, TZ)),
    endAt: new Date(localToUtc({ date, time: end }, TZ)),
    ...overrides,
  };
}

function deadline(date: string, time: string, durationMinutes: number, overrides: Partial<DomainTask> = {}): DomainTask {
  seq += 1;
  return {
    id: `deadline-${seq}`,
    type: 'DEADLINE',
    status: 'TODO',
    importance: 3,
    difficulty: 3,
    deadlineAt: new Date(localToUtc({ date, time }, TZ)),
    durationMinutes,
    ...overrides,
  };
}

function routine(days: number[], startMinute: number, durationMinutes: number, overrides: Partial<DomainTask> = {}): DomainTask {
  seq += 1;
  return {
    id: `routine-${seq}`,
    type: 'ROUTINE',
    status: 'TODO',
    importance: 3,
    difficulty: 3,
    routineDays: days,
    routineStartMinute: startMinute,
    durationMinutes,
    ...overrides,
  };
}

describe('conflict engine (Issue 018)', () => {
  it('tabrakan penuh terdeteksi + saran slot sesuai skenario Issue 046', () => {
    const quiz = fixed('2026-10-05', '09:00', '10:30');
    const rapat = fixed('2026-10-05', '10:15', '11:30');
    const result = checkConflicts(rapat, [quiz], NOW, TZ);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]?.task.id).toBe(quiz.id);
    expect(result.suggestedSlot).not.toBeNull();
    expect(result.suggestedSlot?.start).toBe(localToUtc({ date: '2026-10-05', time: '11:00' }, TZ));
    expect(result.suggestedSlot?.end).toBe(localToUtc({ date: '2026-10-05', time: '12:15' }, TZ));
  });

  it('tabrakan sebagian (overlap sebagian waktu)', () => {
    const a = fixed('2026-10-05', '09:00', '10:00');
    const b = fixed('2026-10-05', '09:30', '10:30');
    const result = checkConflicts(b, [a], NOW, TZ);
    expect(result.collisions).toHaveLength(1);
  });

  it('jarak 29 menit -> buffer; 30 menit -> tidak ada peringatan', () => {
    const a = fixed('2026-10-05', '09:00', '10:00');
    const b29 = fixed('2026-10-05', '10:29', '11:00');
    const r29 = checkConflicts(b29, [a], NOW, TZ);
    expect(r29.collisions).toHaveLength(0);
    expect(r29.buffers).toHaveLength(1);
    expect(r29.buffers[0]?.gapMinutes).toBe(29);

    const b30 = fixed('2026-10-06', '10:30', '11:00');
    const a2 = fixed('2026-10-06', '09:00', '10:00');
    const r30 = checkConflicts(b30, [a2], NOW, TZ);
    expect(r30.collisions).toHaveLength(0);
    expect(r30.buffers).toHaveLength(0);
  });

  it('routine vs fixed terdeteksi bentrok', () => {
    const rut = routine([1, 2, 3, 4, 5], 9 * 60, 60); // 09:00-10:00 Senin-Jumat
    const fx = fixed('2026-10-05', '09:30', '10:15');
    const result = checkConflicts(fx, [rut], NOW, TZ);
    expect(result.collisions.length).toBeGreaterThanOrEqual(1);
  });

  it('DEADLINE tidak pernah "bentrok" walau waktu sama', () => {
    const dl = deadline('2026-10-05', '09:30', 60);
    const fx = fixed('2026-10-05', '09:00', '10:00');
    const result = checkConflicts(fx, [dl], NOW, TZ);
    expect(result.collisions).toHaveLength(0);
    expect(result.buffers).toHaveLength(0);
  });

  it('overload tepat di kapasitas (tidak overload) vs +0.1 jam (overload)', () => {
    const exactly8 = fixed('2026-10-06', '00:00', '08:00');
    const r1 = checkConflicts(exactly8, [], NOW, TZ, 8);
    expect(r1.overload).toHaveLength(0);

    const over = fixed('2026-10-06', '00:00', '08:06');
    const r2 = checkConflicts(over, [], NOW, TZ, 8);
    expect(r2.overload).toHaveLength(1);
  });

  it('mengedit tugas tidak bentrok dengan dirinya sendiri (excludeTaskId)', () => {
    const task = fixed('2026-10-05', '09:00', '10:00');
    const result = checkConflicts(task, [task], NOW, TZ, 8, task.id);
    expect(result.collisions).toHaveLength(0);
  });

  it('saran slot melewati dua penghalang berturut-turut', () => {
    const b1 = fixed('2026-10-05', '09:00', '10:00');
    const b2 = fixed('2026-10-05', '10:30', '11:00'); // tepat setelah buffer blocker pertama
    const candidate = fixed('2026-10-05', '09:00', '09:30');
    const result = checkConflicts(candidate, [b1, b2], NOW, TZ);
    expect(result.suggestedSlot).not.toBeNull();
    expect(result.suggestedSlot!.start).toBeGreaterThanOrEqual(localToUtc({ date: '2026-10-05', time: '11:30' }, TZ));
  });

  it('tidak ada saran bila 24 iterasi habis', () => {
    // Penghalang routine setiap hari jam 00:00-23:59 selama lebih dari 24*durasi kandidat
    const blocker = routine([1, 2, 3, 4, 5, 6, 7], 0, 23 * 60 + 59);
    const candidate = fixed('2026-10-05', '09:00', '09:30');
    const result = checkConflicts(candidate, [blocker], NOW, TZ);
    expect(result.suggestedSlot).toBeNull();
  });

  it('dayLoad: DEADLINE disebar rata dari hari ini s.d. hari deadline', () => {
    const dl = deadline('2026-10-07', '12:00', 6 * 60); // 6 jam, 3 hari termasuk hari ini (5,6,7 Okt)
    const hoursToday = dayLoad(localToUtc({ date: '2026-10-05', time: '00:00' }, TZ), [dl], NOW, TZ);
    expect(hoursToday).toBeCloseTo(2, 5);
  });
});
