import { describe, expect, it } from 'vitest';
import { categoryInputSchema } from './category.js';
import { taskInputSchema } from './task.js';

const uuid = '11111111-1111-1111-1111-111111111111';

describe('taskInputSchema (Issue 015)', () => {
  it('menerima DEADLINE valid', () => {
    const r = taskInputSchema.safeParse({
      type: 'DEADLINE',
      title: 'Laporan Praktikum',
      categoryId: uuid,
      importance: 4,
      difficulty: 3,
      deadlineAt: '2026-10-08T13:00:00.000Z',
      durationHours: 3,
    });
    expect(r.success).toBe(true);
  });

  it('menerima FIXED_TIME valid', () => {
    const r = taskInputSchema.safeParse({
      type: 'FIXED_TIME',
      title: 'Quiz Matdis',
      categoryId: uuid,
      importance: 4,
      difficulty: 4,
      startAt: '2026-10-07T02:00:00.000Z',
      endAt: '2026-10-07T03:30:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('menerima ROUTINE valid', () => {
    const r = taskInputSchema.safeParse({
      type: 'ROUTINE',
      title: 'Review Strategi Algoritma',
      categoryId: uuid,
      importance: 3,
      difficulty: 2,
      routineDays: [1, 3, 5],
      routineStartTime: '19:30',
      durationHours: 1,
    });
    expect(r.success).toBe(true);
  });

  it.each([
    ['judul kosong', { type: 'DEADLINE', title: '', categoryId: uuid, importance: 3, difficulty: 3, deadlineAt: '2026-10-08T13:00:00.000Z', durationHours: 1 }],
    ['importance di luar 1-5', { type: 'DEADLINE', title: 'x', categoryId: uuid, importance: 6, difficulty: 3, deadlineAt: '2026-10-08T13:00:00.000Z', durationHours: 1 }],
    ['endAt <= startAt', { type: 'FIXED_TIME', title: 'x', categoryId: uuid, importance: 3, difficulty: 3, startAt: '2026-10-07T03:00:00.000Z', endAt: '2026-10-07T02:00:00.000Z' }],
    ['durationHours DEADLINE < 0.5', { type: 'DEADLINE', title: 'x', categoryId: uuid, importance: 3, difficulty: 3, deadlineAt: '2026-10-08T13:00:00.000Z', durationHours: 0.2 }],
    ['routineDays berisi 0', { type: 'ROUTINE', title: 'x', categoryId: uuid, importance: 3, difficulty: 3, routineDays: [0], routineStartTime: '19:30', durationHours: 1 }],
    ['routineDays berisi 8', { type: 'ROUTINE', title: 'x', categoryId: uuid, importance: 3, difficulty: 3, routineDays: [8], routineStartTime: '19:30', durationHours: 1 }],
    ['routineDays duplikat', { type: 'ROUTINE', title: 'x', categoryId: uuid, importance: 3, difficulty: 3, routineDays: [1, 1], routineStartTime: '19:30', durationHours: 1 }],
    ['kunci tak dikenal (role)', { type: 'DEADLINE', title: 'x', categoryId: uuid, importance: 3, difficulty: 3, deadlineAt: '2026-10-08T13:00:00.000Z', durationHours: 1, role: 'SUPERADMIN' }],
  ] as const)('menolak: %s', (_label, input) => {
    const r = taskInputSchema.safeParse(input);
    expect(r.success).toBe(false);
  });
});

describe('categoryInputSchema', () => {
  it('menormalkan warna ke uppercase', () => {
    const r = categoryInputSchema.parse({ name: 'Olahraga', color: '#ff0000', type: 'PRIBADI' });
    expect(r.color).toBe('#FF0000');
  });

  it.each([['red'], ['javascript:alert(1)'], ['#12345'], ['#gggggg']])('menolak warna invalid: %s', (color) => {
    const r = categoryInputSchema.safeParse({ name: 'X', color, type: 'PRIBADI' });
    expect(r.success).toBe(false);
  });
});
