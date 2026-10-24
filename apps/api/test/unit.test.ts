import { describe, expect, it } from 'vitest';
import { argon2id, hash } from 'argon2';
import { DateTime } from 'luxon';
import { escapeLikePattern, timeRangeMs } from '../src/lib/dateRange.js';
import { isAllowedPushEndpoint } from '../src/lib/push.js';
import { buildReminderPayload } from '../src/lib/notificationPayload.js';
import { signSessionToken, verifySessionToken } from '../src/lib/jwt.js';
import { toPublicUser } from '../src/lib/serializers.js';
import { taskInputToDbFields, taskToPseudoInput } from '../src/lib/taskInput.js';
import { toDomainTask } from '../src/lib/reminderService.js';
import { needsRehash } from '../src/lib/password.js';

const TZ = 'Asia/Jakarta';
const NOW = DateTime.fromObject({ year: 2026, month: 10, day: 5, hour: 8 }, { zone: TZ }).toMillis();

describe('dateRange', () => {
  it('escape karakter pola ILIKE', () => {
    expect(escapeLikePattern('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    expect(escapeLikePattern('biasa')).toBe('biasa');
  });

  it('time=today/week/month menghasilkan rentang [awal hari, akhir periode)', () => {
    const [todayStart, todayEnd] = timeRangeMs('today', NOW, TZ);
    expect(DateTime.fromMillis(todayStart, { zone: TZ }).toFormat('HH:mm')).toBe('00:00');
    expect(todayEnd - todayStart).toBeGreaterThan(86_399_000);
    expect(todayEnd - todayStart).toBeLessThan(86_400_000);

    const [, weekEnd] = timeRangeMs('week', NOW, TZ);
    expect(DateTime.fromMillis(weekEnd, { zone: TZ }).weekday).toBe(7);

    const [, monthEnd] = timeRangeMs('month', NOW, TZ);
    expect(DateTime.fromMillis(monthEnd, { zone: TZ }).day).toBe(31);
  });
});

describe('taskInput ↔ kolom DB', () => {
  it('tiap tipe mengisi hanya kolom yang relevan dan menghapus sisanya', () => {
    const fixed = taskInputToDbFields({
      type: 'FIXED_TIME',
      title: 'A',
      description: '',
      categoryId: 'c1',
      importance: 3,
      difficulty: 3,
      startAt: new Date(NOW),
      endAt: new Date(NOW + 3_600_000),
    });
    expect(fixed).toMatchObject({ type: 'FIXED_TIME', deadlineAt: null, routineDays: [], durationMinutes: null });

    const deadline = taskInputToDbFields({
      type: 'DEADLINE',
      title: 'A',
      description: '',
      categoryId: 'c1',
      importance: 3,
      difficulty: 3,
      deadlineAt: new Date(NOW),
      durationHours: 1.5,
    });
    expect(deadline).toMatchObject({ type: 'DEADLINE', durationMinutes: 90, startAt: null, routineDays: [] });

    const routine = taskInputToDbFields({
      type: 'ROUTINE',
      title: 'A',
      description: '',
      categoryId: 'c1',
      importance: 3,
      difficulty: 3,
      routineDays: [2, 4],
      routineStartTime: '23:05',
      durationHours: 0.5,
    });
    expect(routine).toMatchObject({ type: 'ROUTINE', routineDays: [2, 4], routineStartMinute: 23 * 60 + 5, durationMinutes: 30 });
  });

  it('round-trip DB → pseudo-input → kolom DB stabil', () => {
    const row = {
      id: 't1',
      userId: 'u1',
      categoryId: 'c1',
      title: 'Rutin',
      description: null,
      type: 'ROUTINE' as const,
      status: 'TODO' as const,
      importance: 2,
      difficulty: 4,
      startAt: null,
      endAt: null,
      deadlineAt: null,
      durationMinutes: 45,
      routineDays: [1, 2],
      routineStartMinute: 7 * 60 + 30,
      doneAt: null,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const pseudo = taskToPseudoInput(row);
    expect(pseudo).toMatchObject({ type: 'ROUTINE', routineStartTime: '07:30', durationHours: 0.75, description: '' });

    const fields = taskInputToDbFields({ ...pseudo, routineStartTime: '07:30' } as never);
    expect(fields).toMatchObject({ routineStartMinute: 450, durationMinutes: 45, routineDays: [1, 2] });
  });
});

describe('allowlist endpoint push (anti-SSRF)', () => {
  it.each([
    ['https://fcm.googleapis.com/fcm/send/abc', true],
    ['https://updates.push.services.mozilla.com/wpush/v2/abc', true],
    ['https://web.push.apple.com/abc', true],
    ['https://notify.windows.com/abc', true],
    ['http://fcm.googleapis.com/abc', false],
    ['https://fcm.googleapis.com.evil.example/abc', false],
    ['https://169.254.169.254/latest/meta-data', false],
    ['https://localhost:8080/push', false],
    ['https://not-allowlisted.example/push', false],
    ['bukan-url', false],
  ])('%s → %s', (endpoint, expected) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(expected);
  });
});

describe('payload notifikasi terlokalisasi (Issue 032)', () => {
  const task = toDomainTask({
    id: 't1',
    userId: 'u1',
    categoryId: 'c1',
    title: 'Laporan',
    description: null,
    type: 'DEADLINE',
    status: 'TODO',
    importance: 4,
    difficulty: 2,
    startAt: null,
    endAt: null,
    deadlineAt: new Date(NOW + 20 * 3_600_000),
    durationMinutes: 120,
    routineDays: [],
    routineStartMinute: null,
    doneAt: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
  });

  it('id: format 08.00, tag per tugas, tautan sesuai tipe kategori', () => {
    const payload = buildReminderPayload({
      task,
      taskTitle: 'Laporan Praktikum',
      category: { type: 'KULIAH' },
      eventAt: NOW + 20 * 3_600_000,
      timezone: TZ,
      locale: 'id',
      now: NOW,
    });
    expect(payload.title).toBe('⏰ Deadline besok: Laporan Praktikum');
    expect(payload.body).toContain('04.00');
    expect(payload.tag).toBe('task-t1');
    expect(payload.url).toBe('/tugas-kuliah?open=t1');
    expect(payload.taskId).toBe('t1');
  });

  it('en: format 08:00 dan judul bahasa Inggris; kategori PRIBADI mengarah ke /tugas-pribadi', () => {
    const payload = buildReminderPayload({
      task,
      taskTitle: 'Gym',
      category: { type: 'PRIBADI' },
      eventAt: NOW + 90 * 60_000,
      timezone: TZ,
      locale: 'en',
      now: NOW,
    });
    expect(payload.title).toBe('⏰ Deadline coming up soon: Gym');
    expect(payload.body).toMatch(/09:30/);
    expect(payload.url).toBe('/tugas-pribadi?open=t1');
  });
});

describe('jwt, serializer, dan rehash', () => {
  it('token yang ditandatangani sendiri terverifikasi; token asing ditolak', async () => {
    const exp = Math.floor((Date.now() + 60_000) / 1000);
    const token = await signSessionToken({ sub: 'user-1', sid: 'sess-1' }, exp);
    expect(await verifySessionToken(token)).toEqual({ sub: 'user-1', sid: 'sess-1' });
    expect(await verifySessionToken('abc.def.ghi')).toBeNull();
    expect(await verifySessionToken(token + 'x')).toBeNull();
    expect(await verifySessionToken(await signSessionToken({ sub: 'u', sid: 's' }, Math.floor(Date.now() / 1000) - 5))).toBeNull();
  });

  it('toPublicUser menyembunyikan passwordHash dan mengekspor hanya field aman', () => {
    const user = {
      id: 'u1',
      name: 'Budi',
      email: 'budi@mail.com',
      passwordHash: '$argon2id$rahasia',
      role: 'MAHASISWA' as const,
      timezone: TZ,
      locale: 'id',
      dailyCapacityHours: 8,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const publicUser = toPublicUser(user as never);
    expect(Object.keys(publicUser).sort()).toEqual(
      ['createdAt', 'dailyCapacityHours', 'email', 'id', 'locale', 'name', 'role', 'timezone'].sort(),
    );
    expect(publicUser.dailyCapacityHours).toBe(8);
    expect(publicUser.createdAt).toBe(new Date(NOW).toISOString());
  });

  it('needsRehash menandai hash dengan parameter lebih lemah dari env test', async () => {
    const weak = await hash('password123', { type: argon2id, memoryCost: 1024, timeCost: 2, parallelism: 1 });
    expect(needsRehash(weak)).toBe(true);
    expect(needsRehash('bukan-hash')).toBe(true);
  });
});
