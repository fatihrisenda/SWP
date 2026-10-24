import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import request from 'supertest';
import type { TestContext } from './helpers.js';
import { deadlineInput, fixedTimeInput, makeSession, makeUser, routineInput, setup, truncateAll } from './helpers.js';

const H = 3_600_000;
const D = 24 * H;

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setup();
});

beforeEach(async () => {
  await truncateAll(ctx.prisma);
});

afterEach(async () => {
  await truncateAll(ctx.prisma);
});

interface Student {
  id: string;
  cookie: string;
  kuliah: string;
  pribadi: string;
}

async function student(): Promise<Student> {
  const user = await makeUser(ctx);
  const token = await makeSession(ctx, user.id);
  const rows = await ctx.prisma.category.findMany({ where: { userId: user.id } });
  return {
    id: user.id,
    cookie: ctx.cookie(token),
    kuliah: rows.find((r) => r.type === 'KULIAH')!.id,
    pribadi: rows.find((r) => r.type === 'PRIBADI')!.id,
  };
}

describe('tugas: create (Issue 022, FR-01/FR-02)', () => {
  it('FIXED_TIME tersimpan lengkap dengan prioritas dan reminder H-24', async () => {
    const s = await student();
    const res = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(
      fixedTimeInput(s.kuliah, {
        startAt: new Date(Date.now() + 2 * D + 9 * H).toISOString(),
        endAt: new Date(Date.now() + 2 * D + 11 * H).toISOString(),
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Kelas Pemrograman',
      type: 'FIXED_TIME',
      status: 'TODO',
      importance: 3,
      difficulty: 2,
      category: { id: s.kuliah, type: 'KULIAH' },
    });
    expect(res.body.priority).toMatchObject({ score: expect.any(Number), label: expect.stringMatching('TOP|HIGH|MEDIUM|LOW') });
    expect(new Date(res.body.reminderAt as string).getTime()).toBeCloseTo(Date.now() + D + 9 * H, -6);
    expect(await ctx.prisma.reminder.count({ where: { userId: s.id, status: 'PENDING' } })).toBe(1);
  });

  it('DEADLINE menyimpan durationMinutes dari durationHours; ROUTINE menyimpan menit mulai + hari', async () => {
    const s = await student();
    const dl = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah));
    expect(dl.status).toBe(201);
    const dlRow = await ctx.prisma.task.findUniqueOrThrow({ where: { id: dl.body.id } });
    expect(dlRow.durationMinutes).toBe(120);
    expect(dlRow.startAt).toBeNull();

    const rt = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(routineInput(s.pribadi));
    expect(rt.status).toBe(201);
    const rtRow = await ctx.prisma.task.findUniqueOrThrow({ where: { id: rt.body.id } });
    expect(rtRow.routineStartMinute).toBe(6 * 60 + 30);
    expect(rtRow.routineDays).toEqual([1, 3, 5]);
    expect(rt.body.routineStartTime).toBe('06:30');
    expect(rt.body.durationHours).toBe(1);
  });

  it('validasi penugasan per tipe ditolak dengan 400 VALIDATION_ERROR', async () => {
    const s = await student();

    const missingDuration = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send({ ...deadlineInput(s.kuliah), durationHours: undefined });
    expect(missingDuration.status).toBe(400);

    const endBeforeStart = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(fixedTimeInput(s.kuliah, { endAt: new Date(Date.now() + H).toISOString(), startAt: new Date(Date.now() + 2 * H).toISOString() }));
    expect(endBeforeStart.status).toBe(400);
    expect(Object.keys(endBeforeStart.body.error.fields)).toContain('endAt');

    const badScale = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { importance: 6 }));
    expect(badScale.status).toBe(400);

    const badStep = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { durationHours: 0.7 }));
    expect(badStep.status).toBe(400);

    const duplicateDays = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(routineInput(s.kuliah, { routineDays: [1, 1, 2] }));
    expect(duplicateDays.status).toBe(400);

    const unknownField = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send({ ...fixedTimeInput(s.kuliah), userId: 'orang-lain' });
    expect(unknownField.status).toBe(400);

    const titleTooLong = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(deadlineInput(s.kuliah, { title: 'x'.repeat(101) }));
    expect(titleTooLong.status).toBe(400);

    expect(await ctx.prisma.task.count({ where: { userId: s.id } })).toBe(0);
  });

  it('kategori milik user lain saat membuat tugas → 404 (anti-IDOR relasi)', async () => {
    const a = await student();
    const b = await student();
    const res = await request(ctx.app).post('/api/v1/tasks').set('Cookie', a.cookie).send(deadlineInput(b.kuliah));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('tugas: list, filter, sort, paginasi (Issue 023, FR-01/FR-04)', () => {
  it('menerapkan filter status/type/scope/priority/q dan mengembalikan total sebelum paginasi', async () => {
    const s = await student();
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { title: 'Laporan Aljabar' }));
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(fixedTimeInput(s.pribadi, { title: 'Olahraga Sore', importance: 1, difficulty: 1 }));
    const done = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { title: 'Tugas Lama', importance: 5, difficulty: 5 }));
    await request(ctx.app).patch(`/api/v1/tasks/${done.body.id}/status`).set('Cookie', s.cookie).send({ status: 'DONE' });

    const all = await request(ctx.app).get('/api/v1/tasks').set('Cookie', s.cookie);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items).toHaveLength(3);

    const active = await request(ctx.app).get('/api/v1/tasks?status=active').set('Cookie', s.cookie);
    expect(active.body.total).toBe(2);
    expect(active.body.items.map((t: { id: string }) => t.id)).not.toContain(done.body.id);

    const doneOnly = await request(ctx.app).get('/api/v1/tasks?status=done').set('Cookie', s.cookie);
    expect(doneOnly.body.items.map((t: { id: string }) => t.id)).toEqual([done.body.id]);

    const kuliah = await request(ctx.app).get('/api/v1/tasks?scope=kuliah&status=active').set('Cookie', s.cookie);
    expect(kuliah.body.total).toBe(1);

    const byType = await request(ctx.app).get('/api/v1/tasks?type=FIXED_TIME').set('Cookie', s.cookie);
    expect(byType.body.items.map((t: { title: string }) => t.title)).toEqual(['Olahraga Sore']);

    const byCategory = await request(ctx.app).get(`/api/v1/tasks?categoryId=${s.pribadi}`).set('Cookie', s.cookie);
    expect(byCategory.body.total).toBe(1);

    const searched = await request(ctx.app).get('/api/v1/tasks?q=aljabar').set('Cookie', s.cookie);
    expect(searched.body.total).toBe(1);

    const wildcard = await request(ctx.app).get('/api/v1/tasks?q=%25').set('Cookie', s.cookie);
    expect(wildcard.body.total).toBe(0);

    const high = await request(ctx.app).get('/api/v1/tasks?priority=HIGH').set('Cookie', s.cookie);
    expect(high.body.items.every((t: { priority: { label: string } }) => t.priority.label === 'HIGH')).toBe(true);

    const paged = await request(ctx.app).get('/api/v1/tasks?limit=1&offset=1').set('Cookie', s.cookie);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.total).toBe(3);
  });

  it('sort=priority menempatkan DONE di bawah dan skor menurun; sort=newest memakai createdAt', async () => {
    const s = await student();
    const low = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { title: 'Ringan', importance: 1, difficulty: 1, deadlineAt: new Date(Date.now() + 30 * D).toISOString() }));
    const high = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { title: 'Berat', importance: 5, difficulty: 5, deadlineAt: new Date(Date.now() + 2 * H).toISOString() }));
    await request(ctx.app).patch(`/api/v1/tasks/${high.body.id}/status`).set('Cookie', s.cookie).send({ status: 'DONE' });

    const byPriority = await request(ctx.app).get('/api/v1/tasks?sort=priority').set('Cookie', s.cookie);
    const ids = byPriority.body.items.map((t: { id: string }) => t.id);
    expect(ids[ids.length - 1]).toBe(high.body.id);
    expect(ids[0]).toBe(low.body.id);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const teranyar = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { title: 'Baru Saja' }));
    const byNewest = await request(ctx.app).get('/api/v1/tasks?sort=newest').set('Cookie', s.cookie);
    expect(byNewest.body.items[0]).toMatchObject({ id: teranyar.body.id, title: 'Baru Saja' });

    const byDeadline = await request(ctx.app).get('/api/v1/tasks?sort=deadline&status=active').set('Cookie', s.cookie);
    expect(byDeadline.body.items.map((t: { title: string }) => t.title)).toEqual(['Baru Saja', 'Ringan']);
  });

  it('query tidak valid → 400 dengan fields; tugas user lain tidak pernah muncul', async () => {
    const a = await student();
    const b = await student();
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', b.cookie).send(deadlineInput(b.kuliah, { title: 'Rahasia B' }));

    const list = await request(ctx.app).get('/api/v1/tasks').set('Cookie', a.cookie);
    expect(list.body.items.every((t: { title: string }) => t.title !== 'Rahasia B')).toBe(true);

    const badSort = await request(ctx.app).get('/api/v1/tasks?sort=acak').set('Cookie', a.cookie);
    expect(badSort.status).toBe(400);
    expect(Object.keys(badSort.body.error.fields)).toContain('sort');

    const badLimit = await request(ctx.app).get('/api/v1/tasks?limit=5000').set('Cookie', a.cookie);
    expect(badLimit.status).toBe(400);
  });

  it('filter time=today hanya memuat tugas dengan acara hari ini', async () => {
    const s = await student();
    const jam20HariIni = DateTime.now().setZone('Asia/Jakarta').startOf('day').plus({ hours: 20 });
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(
        fixedTimeInput(s.kuliah, {
          title: 'Hari Ini',
          startAt: jam20HariIni.toISO()!,
          endAt: jam20HariIni.plus({ hours: 1 }).toISO()!,
        }),
      );
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(fixedTimeInput(s.kuliah, { title: 'Bulan Depan', startAt: new Date(Date.now() + 20 * D).toISOString(), endAt: new Date(Date.now() + 20 * D + H).toISOString() }));

    const today = await request(ctx.app).get('/api/v1/tasks?time=today').set('Cookie', s.cookie);
    expect(today.body.items.map((t: { title: string }) => t.title)).toEqual(['Hari Ini']);
  });
});

describe('tugas: read, update, status, delete (Issue 024)', () => {
  it('GET /tasks/:id → 200 untuk milik sendiri, 404 untuk milik user lain / id tak dikenal', async () => {
    const a = await student();
    const b = await student();
    const created = await request(ctx.app).post('/api/v1/tasks').set('Cookie', a.cookie).send(deadlineInput(a.kuliah));

    expect((await request(ctx.app).get(`/api/v1/tasks/${created.body.id}`).set('Cookie', a.cookie)).status).toBe(200);
    expect((await request(ctx.app).get(`/api/v1/tasks/${created.body.id}`).set('Cookie', b.cookie)).status).toBe(404);
    expect((await request(ctx.app).get(`/api/v1/tasks/${crypto.randomUUID()}`).set('Cookie', a.cookie)).status).toBe(404);
  });

  it('PATCH mengubah waktu dan reminder dihitung ulang', async () => {
    const s = await student();
    const created = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(
      fixedTimeInput(s.kuliah, { startAt: new Date(Date.now() + 2 * D).toISOString(), endAt: new Date(Date.now() + 2 * D + H).toISOString() }),
    );
    const before = await ctx.prisma.reminder.findFirstOrThrow({ where: { taskId: created.body.id, status: 'PENDING' } });

    const mulaiBaru = new Date(Date.now() + 5 * D);
    const patched = await request(ctx.app)
      .patch(`/api/v1/tasks/${created.body.id}`)
      .set('Cookie', s.cookie)
      .send({ startAt: mulaiBaru.toISOString(), endAt: new Date(mulaiBaru.getTime() + H).toISOString() });
    expect(patched.status).toBe(200);
    expect(patched.body.startAt).toBe(mulaiBaru.toISOString());

    const after = await ctx.prisma.reminder.findFirstOrThrow({ where: { taskId: created.body.id, status: 'PENDING' } });
    expect(after.remindAt.getTime()).toBeGreaterThan(before.remindAt.getTime() + 2 * D - H);
    expect(await ctx.prisma.reminder.count({ where: { taskId: created.body.id, status: 'CANCELLED' } })).toBe(1);
  });

  it('PATCH dapat mengganti tipe (FIXED_TIME → DEADLINE) dan field tipe lama dibersihkan', async () => {
    const s = await student();
    const created = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(fixedTimeInput(s.kuliah));
    const res = await request(ctx.app)
      .patch(`/api/v1/tasks/${created.body.id}`)
      .set('Cookie', s.cookie)
      .send({ type: 'DEADLINE', deadlineAt: new Date(Date.now() + D).toISOString(), durationHours: 1.5 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ type: 'DEADLINE', title: 'Kelas Pemrograman', durationHours: 1.5 });
    const row = await ctx.prisma.task.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.startAt).toBeNull();
    expect(row.endAt).toBeNull();
    expect(row.durationMinutes).toBe(90);
  });

  it('PATCH dengan data tidak valid → 400 dan baris tidak berubah', async () => {
    const s = await student();
    const created = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah));
    const res = await request(ctx.app).patch(`/api/v1/tasks/${created.body.id}`).set('Cookie', s.cookie).send({ importance: 9 });
    expect(res.status).toBe(400);
    expect((await ctx.prisma.task.findUniqueOrThrow({ where: { id: created.body.id } })).importance).toBe(4);
  });

  it('siklus status TODO → IN_PROGRESS → DONE menyetel doneAt dan membatalkan reminder', async () => {
    const s = await student();
    const created = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah));

    const inProgress = await request(ctx.app).patch(`/api/v1/tasks/${created.body.id}/status`).set('Cookie', s.cookie).send({ status: 'IN_PROGRESS' });
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.status).toBe('IN_PROGRESS');
    expect(inProgress.body.reminderAt).not.toBeNull();

    const done = await request(ctx.app).patch(`/api/v1/tasks/${created.body.id}/status`).set('Cookie', s.cookie).send({ status: 'DONE' });
    expect(done.body.status).toBe('DONE');
    expect(done.body.reminderAt).toBeNull();
    const row = await ctx.prisma.task.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.doneAt).not.toBeNull();
    expect(await ctx.prisma.reminder.count({ where: { taskId: created.body.id, status: 'PENDING' } })).toBe(0);

    const bad = await request(ctx.app).patch(`/api/v1/tasks/${created.body.id}/status`).set('Cookie', s.cookie).send({ status: 'SELESAI' });
    expect(bad.status).toBe(400);

    const crossUser = await request(ctx.app).patch(`/api/v1/tasks/${created.body.id}/status`).set('Cookie', (await student()).cookie).send({ status: 'TODO' });
    expect(crossUser.status).toBe(404);
  });

  it('DELETE → 204 lalu 404; reminder ikutan terhapus (cascade)', async () => {
    const s = await student();
    const created = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah));
    const del = await request(ctx.app).delete(`/api/v1/tasks/${created.body.id}`).set('Cookie', s.cookie);
    expect(del.status).toBe(204);
    expect((await request(ctx.app).delete(`/api/v1/tasks/${created.body.id}`).set('Cookie', s.cookie)).status).toBe(404);
    expect(await ctx.prisma.reminder.count({ where: { taskId: created.body.id } })).toBe(0);
  });
});

describe('tugas: konflik & analytics (Issue 025, FR-04)', () => {
  it('mendeteksi tabrakan FIXED_TIME dan memberi saran slot', async () => {
    const s = await student();
    const start = Date.now() + D + 9 * H;
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(fixedTimeInput(s.kuliah, { title: 'Ketemu Dosen', startAt: new Date(start).toISOString(), endAt: new Date(start + 2 * H).toISOString() }));

    const res = await request(ctx.app)
      .post('/api/v1/tasks/conflicts')
      .set('Cookie', s.cookie)
      .send({ candidate: fixedTimeInput(s.kuliah, { title: 'Bentrok', startAt: new Date(start + H).toISOString(), endAt: new Date(start + 3 * H).toISOString() }) });

    expect(res.status).toBe(200);
    expect(res.body.any).toBe(true);
    expect(res.body.collisions).toHaveLength(1);
    expect(res.body.collisions[0].task).toMatchObject({ title: 'Ketemu Dosen' });
    expect(res.body.suggestedSlot).not.toBeNull();
    expect(new Date(res.body.suggestedSlot.start).getTime()).toBeGreaterThanOrEqual(start + 2 * H);
  });

  it('memperingatkan jeda istirahat < 30 menit (buffer)', async () => {
    const s = await student();
    const start = Date.now() + D + 9 * H;
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(fixedTimeInput(s.kuliah, { title: 'Sebelumnya', startAt: new Date(start).toISOString(), endAt: new Date(start + H).toISOString() }));

    const res = await request(ctx.app)
      .post('/api/v1/tasks/conflicts')
      .set('Cookie', s.cookie)
      .send({
        candidate: fixedTimeInput(s.kuliah, {
          title: 'Setelahnya',
          startAt: new Date(start + H + 10 * 60_000).toISOString(),
          endAt: new Date(start + H + 70 * 60_000).toISOString(),
        }),
      });

    expect(res.body.collisions).toHaveLength(0);
    expect(res.body.buffers).toHaveLength(1);
    expect(res.body.buffers[0].gapMinutes).toBeLessThan(30);
    expect(res.body.any).toBe(true);
  });

  it('melaporkan overcommitment > kapasitas harian dan lowPriorityCandidate', async () => {
    const user = await makeUser(ctx, { dailyCapacityHours: 2 });
    const token = await makeSession(ctx, user.id);
    const cookie = ctx.cookie(token);
    const kuliah = (await ctx.prisma.category.findFirstOrThrow({ where: { userId: user.id, type: 'KULIAH' } })).id;
    const start = Date.now() + D + 9 * H;
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', cookie)
      .send(fixedTimeInput(kuliah, { title: 'Padat', importance: 5, difficulty: 5, startAt: new Date(start).toISOString(), endAt: new Date(start + 6 * H).toISOString() }));

    const res = await request(ctx.app)
      .post('/api/v1/tasks/conflicts')
      .set('Cookie', cookie)
      .send({ candidate: fixedTimeInput(kuliah, { title: 'Tambah', startAt: new Date(start + 7 * H).toISOString(), endAt: new Date(start + 8 * H).toISOString() }) });

    expect(res.status).toBe(200);
    expect(res.body.overload.length).toBeGreaterThan(0);
    expect(res.body.overload[0].hours).toBeGreaterThan(2);
  });

  it('excludeTaskId mengabaikan tugas yang sedang diedit saat cek konflik', async () => {
    const s = await student();
    const start = Date.now() + D + 9 * H;
    const created = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(fixedTimeInput(s.kuliah, { startAt: new Date(start).toISOString(), endAt: new Date(start + 2 * H).toISOString() }));

    const res = await request(ctx.app)
      .post('/api/v1/tasks/conflicts')
      .set('Cookie', s.cookie)
      .send({
        candidate: fixedTimeInput(s.kuliah, { startAt: new Date(start).toISOString(), endAt: new Date(start + 2 * H).toISOString() }),
        excludeTaskId: created.body.id,
      });

    expect(res.body.collisions).toHaveLength(0);
    expect(res.body.any).toBe(false);
  });

  it('conflict check dengan kategori milik user lain → 404; kandidat tidak valid → 400', async () => {
    const a = await student();
    const b = await student();
    const foreign = await request(ctx.app)
      .post('/api/v1/tasks/conflicts')
      .set('Cookie', a.cookie)
      .send({ candidate: fixedTimeInput(b.kuliah) });
    expect(foreign.status).toBe(404);

    const invalid = await request(ctx.app).post('/api/v1/tasks/conflicts').set('Cookie', a.cookie).send({ candidate: { type: 'DEADLINE' } });
    expect(invalid.status).toBe(400);
  });

  it('GET /tasks/analytics menghitung total/done/active/jam/prioritas tinggi dan respect scope', async () => {
    const s = await student();
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { importance: 5, difficulty: 5, durationHours: 3 }));
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.pribadi, { durationHours: 1 }));
    const done = await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { durationHours: 2 }));
    await request(ctx.app).patch(`/api/v1/tasks/${done.body.id}/status`).set('Cookie', s.cookie).send({ status: 'DONE' });

    const all = await request(ctx.app).get('/api/v1/tasks/analytics').set('Cookie', s.cookie);
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ total: 3, done: 1, active: 2, totalHours: 4, highPriority: expect.any(Number) });

    const kuliah = await request(ctx.app).get('/api/v1/tasks/analytics?scope=kuliah').set('Cookie', s.cookie);
    expect(kuliah.body.total).toBe(2);
  });
});
