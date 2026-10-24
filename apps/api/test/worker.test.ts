import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('../src/lib/push.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/push.js')>();
  return { ...actual, sendPushNotification: sendMock };
});

import { processBatch, runDailyCleanup, startWorker } from '../src/worker/index.js';
import { makeSession, setup, truncateAll, type TestContext } from './helpers.js';

const H = 3_600_000;
const D = 86_400_000;

let ctx: TestContext;
let prisma: PrismaClient;
let now: number;

interface Fixture {
  userId: string;
  categoryId: string;
}

async function student(withSub = true): Promise<Fixture> {
  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Mahasiswa Worker',
      email: `worker${crypto.randomUUID()}@test.local`,
      passwordHash: '$argon2id$dummy',
      role: 'MAHASISWA',
      timezone: 'Asia/Jakarta',
    },
  });
  const category = await prisma.category.create({
    data: { id: crypto.randomUUID(), userId: user.id, name: 'Kuliah W', color: '#2563EB', type: 'KULIAH' },
  });
  if (withSub) {
    await prisma.pushSubscription.create({
      data: { id: crypto.randomUUID(), userId: user.id, endpoint: `https://fcm.googleapis.com/fcm/send/${user.id}`, p256dh: 'p', auth: 'a' },
    });
  }
  return { userId: user.id, categoryId: category.id };
}

async function task(f: Fixture, overrides: { type?: 'FIXED_TIME' | 'DEADLINE' | 'ROUTINE'; status?: 'TODO' | 'IN_PROGRESS' | 'DONE' } = {}) {
  const type = overrides.type ?? 'DEADLINE';
  return prisma.task.create({
    data: {
      id: crypto.randomUUID(),
      userId: f.userId,
      categoryId: f.categoryId,
      title: 'Tugas Worker',
      type,
      status: overrides.status ?? 'TODO',
      importance: 4,
      difficulty: 2,
      deadlineAt: type === 'DEADLINE' ? new Date(now + 2 * H) : null,
      durationMinutes: type === 'DEADLINE' ? 60 : 30,
      startAt: type === 'FIXED_TIME' ? new Date(now + H) : null,
      endAt: type === 'FIXED_TIME' ? new Date(now + 2 * H) : null,
      routineDays: type === 'ROUTINE' ? [1, 2, 3, 4, 5, 6, 7] : [],
      routineStartMinute: type === 'ROUTINE' ? 9 * 60 : null,
    },
  });
}

async function pendingReminder(taskId: string, f: Fixture, remindAt: Date, eventAt: Date) {
  return prisma.reminder.create({
    data: { id: crypto.randomUUID(), taskId, userId: f.userId, remindAt, eventAt, status: 'PENDING' },
  });
}

beforeAll(async () => {
  ctx = await setup();
  prisma = ctx.prisma;
});

beforeEach(async () => {
  await truncateAll(prisma);
  now = Date.now();
  sendMock.mockReset();
});

afterEach(async () => {
  await truncateAll(prisma);
});

describe('worker: processBatch (Issue 031)', () => {
  it('tidak melakukan apa pun saat tidak ada reminder jatuh tempo', async () => {
    const f = await student();
    const t = await task(f);
    await pendingReminder(t.id, f, new Date(now + H), new Date(now + 2 * H));

    expect(await processBatch(now)).toEqual({ processed: 0, sent: 0, failed: 0, expired: 0, cancelled: 0 });
    expect((await prisma.reminder.findFirstOrThrow({ where: { taskId: t.id } })).status).toBe('PENDING');
  });

  it('mengirim notifikasi untuk tugas aktif lalu menandai SENT dan mencatat lastSuccessAt', async () => {
    const f = await student();
    const t = await task(f);
    const r = await pendingReminder(t.id, f, new Date(now - 1000), new Date(now + 2 * H));
    sendMock.mockResolvedValue({ ok: true, statusCode: 201 });

    const result = await processBatch(now);
    expect(result).toMatchObject({ processed: 1, sent: 1, failed: 0 });

    const stored = await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } });
    expect(stored.status).toBe('SENT');
    expect(stored.sentAt).not.toBeNull();
    expect(await prisma.pushSubscription.count({ where: { userId: f.userId, lastSuccessAt: { not: null } } })).toBe(1);

    const payload = sendMock.mock.calls[0]![1] as { tag: string; url: string };
    expect(payload.tag).toBe(`task-${t.id}`);
    expect(payload.url).toBe(`/tugas-kuliah?open=${t.id}`);
    expect(sendMock.mock.calls[0]![2]).toMatchObject({ TTL: 7200 });
  });

  it('membatalkan reminder milik tugas yang sudah DONE', async () => {
    const f = await student();
    const t = await task(f, { status: 'DONE' });
    const r = await pendingReminder(t.id, f, new Date(now - 1000), new Date(now + 2 * H));

    expect(await processBatch(now)).toMatchObject({ processed: 1, cancelled: 1, sent: 0 });
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('CANCELLED');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('menandai EXPIRED bila waktu acara sudah lewat dan menjadwalkan ulang rutin berikutnya', async () => {
    const f = await student();
    const t = await task(f, { type: 'ROUTINE' });
    const r = await pendingReminder(t.id, f, new Date(now - 120_000), new Date(now - 60_000));

    expect(await processBatch(now)).toMatchObject({ expired: 1, sent: 0 });
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('EXPIRED');
    expect(await prisma.reminder.count({ where: { taskId: t.id, status: 'PENDING' } })).toBe(1);
  });

  it('gagal permanen NO_SUBSCRIPTION bila pengguna belum punya langganan push', async () => {
    const f = await student(false);
    const t = await task(f);
    const r = await pendingReminder(t.id, f, new Date(now - 1000), new Date(now + 2 * H));

    expect(await processBatch(now)).toMatchObject({ failed: 1, sent: 0 });
    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      status: 'FAILED',
      lastError: 'NO_SUBSCRIPTION',
    });
  });

  it('retry dengan backoff 1 menit lalu 5 menit, FAILED setelah percobaan ke-3', async () => {
    const f = await student();
    const t = await task(f);
    const r = await pendingReminder(t.id, f, new Date(now - 1000), new Date(now + 2 * H));
    sendMock.mockResolvedValue({ ok: false, statusCode: 500 });

    expect(await processBatch(now)).toMatchObject({ failed: 1 });
    let stored = await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } });
    expect(stored).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'SEND_FAILED' });
    expect(stored.remindAt.getTime()).toBeCloseTo(now + 60_000, -4);

    const due2 = stored.remindAt.getTime() + 1;
    await processBatch(due2);
    stored = await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } });
    expect(stored).toMatchObject({ status: 'PENDING', attempts: 2 });
    expect(stored.remindAt.getTime()).toBeCloseTo(due2 + 5 * 60_000, -4);

    await processBatch(stored.remindAt.getTime() + 1);
    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      lastError: 'SEND_FAILED',
    });
  });

  it('menghapus langganan yang melaporkan dirinya expired (410)', async () => {
    const f = await student();
    const t = await task(f);
    const r = await pendingReminder(t.id, f, new Date(now - 1000), new Date(now + 2 * H));
    sendMock.mockResolvedValue({ ok: false, statusCode: 410, expired: true });

    expect(await processBatch(now)).toMatchObject({ failed: 1 });
    expect(await prisma.pushSubscription.count({ where: { userId: f.userId } })).toBe(0);
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } })).attempts).toBe(1);
  });

  it('memuat ulang semua langganan user; satu berhasil cukup menandai SENT', async () => {
    const f = await student();
    await prisma.pushSubscription.create({
      data: { id: crypto.randomUUID(), userId: f.userId, endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`, p256dh: 'p', auth: 'a' },
    });
    const t = await task(f);
    const r = await pendingReminder(t.id, f, new Date(now - 1000), new Date(now + 2 * H));
    sendMock.mockResolvedValueOnce({ ok: false, statusCode: 500 }).mockResolvedValueOnce({ ok: true, statusCode: 201 });

    expect(await processBatch(now)).toMatchObject({ sent: 1, failed: 0 });
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('SENT');
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('memproses maksimal 50 reminder dalam satu iterasi (BATCH_SIZE)', async () => {
    const f = await student();
    sendMock.mockResolvedValue({ ok: true, statusCode: 201 });
    for (let i = 0; i < 55; i++) {
      const t = await task(f);
      await pendingReminder(t.id, f, new Date(now - 55 + i), new Date(now + 2 * H));
    }

    expect(await processBatch(now)).toMatchObject({ processed: 50, sent: 50 });
    expect(await prisma.reminder.count({ where: { status: 'PENDING' } })).toBe(5);
  });
});

describe('worker: pembersihan harian', () => {
  it('menghapus sesi >7 hari, reminder selesai >30 hari, dan mood >12 bulan', async () => {
    const f = await student();
    const t = await task(f);

    await prisma.session.create({ data: { id: crypto.randomUUID(), userId: f.userId, expiresAt: new Date(now - 8 * D) } });
    const freshSession = await prisma.session.create({ data: { id: crypto.randomUUID(), userId: f.userId, expiresAt: new Date(now + D) } });
    await prisma.reminder.create({
      data: { id: crypto.randomUUID(), taskId: t.id, userId: f.userId, remindAt: new Date(now), eventAt: new Date(now), status: 'SENT', createdAt: new Date(now - 40 * D) },
    });
    const freshReminder = await pendingReminder(t.id, f, new Date(now + H), new Date(now + 2 * H));
    await prisma.moodEntry.create({ data: { id: crypto.randomUUID(), userId: f.userId, level: 3, createdAt: new Date(now - 400 * D) } });
    const freshMood = await prisma.moodEntry.create({ data: { id: crypto.randomUUID(), userId: f.userId, level: 4 } });

    await runDailyCleanup(now);

    expect((await prisma.session.findFirstOrThrow()).id).toBe(freshSession.id);
    expect((await prisma.reminder.findFirstOrThrow()).id).toBe(freshReminder.id);
    expect((await prisma.moodEntry.findFirstOrThrow()).id).toBe(freshMood.id);
  });
});

describe('worker: loop startWorker/stop', () => {
  it('langsung memproses satu iterasi lalu berhenti setelah stop()', async () => {
    const f = await student();
    const t = await task(f);
    await pendingReminder(t.id, f, new Date(Date.now() - 1000), new Date(Date.now() + 2 * H));
    sendMock.mockResolvedValue({ ok: true, statusCode: 201 });

    const handle = startWorker();
    for (let i = 0; i < 40 && sendMock.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(sendMock).toHaveBeenCalledTimes(1);

    handle.stop();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe('endpoint /push/test memakai pengirim push (Issue 030)', () => {
  it('menghitung sent/failed/total sesuai hasil kirim per langganan', async () => {
    const user = await prisma.user.create({
      data: { id: crypto.randomUUID(), name: 'Uji Push', email: `push${crypto.randomUUID()}@test.local`, passwordHash: '$argon2id$dummy', role: 'MAHASISWA' },
    });
    const cookie = ctx.cookie(await makeSession(ctx, user.id));
    await prisma.pushSubscription.createMany({
      data: [
        { id: crypto.randomUUID(), userId: user.id, endpoint: `https://fcm.googleapis.com/fcm/send/ok-${crypto.randomUUID()}`, p256dh: 'p', auth: 'a' },
        { id: crypto.randomUUID(), userId: user.id, endpoint: `https://fcm.googleapis.com/fcm/send/gagal-${crypto.randomUUID()}`, p256dh: 'p', auth: 'a' },
      ],
    });
    sendMock.mockImplementationOnce(async () => ({ ok: true, statusCode: 201 }));
    sendMock.mockImplementationOnce(async () => ({ ok: false, statusCode: 410, expired: true }));

    const res = await request(ctx.app).post('/api/v1/push/test').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: 1, failed: 1, totalSubscriptions: 2 });
    expect(sendMock.mock.calls[0]![1]).toMatchObject({ tag: 'push-test' });
    expect(await prisma.pushSubscription.count({ where: { userId: user.id } })).toBe(1);
  });
});
