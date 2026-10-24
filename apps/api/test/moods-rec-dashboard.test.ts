import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
}

async function student(): Promise<Student> {
  const user = await makeUser(ctx);
  const token = await makeSession(ctx, user.id);
  const kuliah = (await ctx.prisma.category.findFirstOrThrow({ where: { userId: user.id, type: 'KULIAH' } })).id;
  return { id: user.id, cookie: ctx.cookie(token), kuliah };
}

describe('mood (Issue 026, FR-03)', () => {
  it('POST /moods menyimpan level dan mengembalikan entri; entri sama < 60 s dideduplikasi', async () => {
    const s = await student();
    const first = await request(ctx.app).post('/api/v1/moods').set('Cookie', s.cookie).send({ level: 4 });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ level: 4 });

    const second = await request(ctx.app).post('/api/v1/moods').set('Cookie', s.cookie).send({ level: 4 });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(await ctx.prisma.moodEntry.count({ where: { userId: s.id } })).toBe(1);

    const beda = await request(ctx.app).post('/api/v1/moods').set('Cookie', s.cookie).send({ level: 2 });
    expect(beda.status).toBe(201);
    expect(beda.body.id).not.toBe(first.body.id);
    expect((await request(ctx.app).get('/api/v1/moods/today').set('Cookie', s.cookie)).body.level).toBe(2);
  });

  it('level di luar 1..5, non-integer, dan key asing ditolak 400', async () => {
    const s = await student();
    for (const body of [{ level: 0 }, { level: 6 }, { level: 2.5 }, { level: 3, userId: 'x' }]) {
      const res = await request(ctx.app).post('/api/v1/moods').set('Cookie', s.cookie).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await ctx.prisma.moodEntry.count()).toBe(0);
  });

  it('GET /moods/today → { level: null } bila belum ada hari ini', async () => {
    const s = await student();
    const res = await request(ctx.app).get('/api/v1/moods/today').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ level: null });
  });

  it('GET /moods mengembalikan riwayat terbaru dan limit divalidasi', async () => {
    const s = await student();
    await ctx.prisma.moodEntry.createMany({
      data: [1, 2, 3, 4].map((level) => ({
        id: crypto.randomUUID(),
        userId: s.id,
        level,
        createdAt: new Date(Date.now() - (5 - level) * 60_000),
      })),
    });

    const res = await request(ctx.app).get('/api/v1/moods?limit=2').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].level).toBe(4);

    const tooBig = await request(ctx.app).get('/api/v1/moods?limit=99').set('Cookie', s.cookie);
    expect(tooBig.status).toBe(400);
  });

  it('mood user A tidak terlihat oleh user B', async () => {
    const a = await student();
    const b = await student();
    await request(ctx.app).post('/api/v1/moods').set('Cookie', a.cookie).send({ level: 5 });
    expect((await request(ctx.app).get('/api/v1/moods/today').set('Cookie', b.cookie)).body).toEqual({ level: null });
  });
});

describe('rekomendasi (Issue 027, FR-06/FR-08)', () => {
  it('tanpa mood hari ini dan tanpa query mood → 400 MOOD_REQUIRED', async () => {
    const s = await student();
    const res = await request(ctx.app).get('/api/v1/recommendations').set('Cookie', s.cookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MOOD_REQUIRED');
    expect(res.body.error.message).toBe('Isi mood hari ini terlebih dahulu');
  });

  it('?mood=5 memberi daftar dengan energi tinggi; energiKey sesuai level', async () => {
    const s = await student();
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.kuliah, { importance: 5, difficulty: 5, durationHours: 4, deadlineAt: new Date(Date.now() + 6 * H).toISOString() }));

    const res = await request(ctx.app).get('/api/v1/recommendations?mood=5').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body.mood).toBe(5);
    expect(res.body.energyKey).toBe('rec.energy.veryHigh');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ isTopPick: true, reasonKey: expect.any(String) });
    expect(res.body.items[0].task).toMatchObject({ title: 'Laporan Praktikum', category: { id: s.kuliah } });
    expect(res.body.selfCare).toMatchObject({ level: null, tipKeys: [] });
  });

  it('mood 1 (sangat rendah) → self-care tip keys dan tugas berat ditunda', async () => {
    const s = await student();
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(deadlineInput(s.kuliah, { title: 'Skripsi Berat', importance: 2, difficulty: 5, durationHours: 8, deadlineAt: new Date(Date.now() + 6 * D).toISOString() }));
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(deadlineInput(s.kuliah, { title: 'Kuis Ringan', importance: 3, difficulty: 1, durationHours: 0.5, deadlineAt: new Date(Date.now() + 3 * H).toISOString() }));

    const mood = await request(ctx.app).post('/api/v1/moods').set('Cookie', s.cookie).send({ level: 1 });
    expect(mood.status).toBe(201);

    const res = await request(ctx.app).get('/api/v1/recommendations').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body.energyKey).toBe('rec.energy.veryLow');
    expect(res.body.selfCare.level).toBe(1);
    expect(res.body.selfCare.tipKeys.length).toBeGreaterThan(0);
    expect(res.body.postpone.map((p: { task: { title: string } }) => p.task.title)).toContain('Skripsi Berat');
    expect(res.body.items.map((i: { task: { title: string } }) => i.task.title)).toContain('Kuis Ringan');
  });

  it('tanpa tugas aktif → items dan postpone kosong ( frontend menampilkan pesan SKPL )', async () => {
    const s = await student();
    const res = await request(ctx.app).get('/api/v1/recommendations?mood=3').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], postpone: [] });
  });

  it('query mood tidak valid → 400', async () => {
    const s = await student();
    expect((await request(ctx.app).get('/api/v1/recommendations?mood=9').set('Cookie', s.cookie)).status).toBe(400);
    expect((await request(ctx.app).get('/api/v1/recommendations?tugas=1').set('Cookie', s.cookie)).status).toBe(400);
  });
});

describe('dashboard (Issue 028, FR-10)', () => {
  it('mengembalikan 4 kartu analytics, maksimal 4 tugas terdekat, mood, dan topPick', async () => {
    const s = await student();
    for (let i = 0; i < 6; i++) {
      await request(ctx.app)
        .post('/api/v1/tasks')
        .set('Cookie', s.cookie)
        .send(fixedTimeInput(s.kuliah, { title: `Jadwal ${i}`, startAt: new Date(Date.now() + (i + 1) * H).toISOString(), endAt: new Date(Date.now() + (i + 2) * H).toISOString() }));
    }
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(routineInput(s.kuliah, { title: 'Rutin Pagi' }));

    const res = await request(ctx.app).get('/api/v1/dashboard').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body.analytics).toMatchObject({ total: 7, done: 0, active: 7 });
    expect(res.body.nearest).toHaveLength(4);
    expect(res.body.nearest[0]).toMatchObject({ title: 'Jadwal 0' });
    expect(res.body.mood).toBeNull();
    expect(res.body.topPick).toBeNull();
    expect(res.body.dueWithin24h).toBe(6);
  });

  it('tugas DEADLINE yang sudah lewat ditandai isOverdue dan tetap masuk prioritas', async () => {
    const s = await student();
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(deadlineInput(s.kuliah, { title: 'Telat Banget', deadlineAt: new Date(Date.now() - 3 * H).toISOString() }));

    const res = await request(ctx.app).get('/api/v1/dashboard').set('Cookie', s.cookie);
    expect(res.body.nearest[0]).toMatchObject({ title: 'Telat Banget', isOverdue: true });
  });

  it('topPick terisi dari mood hari ini dan mengikuti rekomendasi rule-based', async () => {
    const s = await student();
    await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(deadlineInput(s.kuliah, { title: 'Penting', importance: 5, difficulty: 3, durationHours: 2, deadlineAt: new Date(Date.now() + 5 * H).toISOString() }));
    await request(ctx.app).post('/api/v1/moods').set('Cookie', s.cookie).send({ level: 4 });

    const res = await request(ctx.app).get('/api/v1/dashboard').set('Cookie', s.cookie);
    expect(res.body.mood).toMatchObject({ level: 4 });
    expect(res.body.topPick).toMatchObject({ title: 'Penting' });
    expect(res.body.topPick.taskId).toBeTypeOf('string');
  });

  it('dashboard hanya memuat data milik user itu sendiri', async () => {
    const a = await student();
    const b = await student();
    await request(ctx.app).post('/api/v1/tasks').set('Cookie', a.cookie).send(deadlineInput(a.kuliah, { title: 'Rahasia A' }));

    const res = await request(ctx.app).get('/api/v1/dashboard').set('Cookie', b.cookie);
    expect(res.body.analytics).toMatchObject({ total: 0, active: 0 });
    expect(res.body.nearest).toEqual([]);
  });

  it('menolak akses SuperAdmin (403) dan tanpa sesi (401)', async () => {
    const admin = await makeUser(ctx, { role: 'SUPERADMIN' });
    const adminCookie = ctx.cookie(await makeSession(ctx, admin.id));
    expect((await request(ctx.app).get('/api/v1/dashboard').set('Cookie', adminCookie)).status).toBe(403);
    expect((await request(ctx.app).get('/api/v1/dashboard')).status).toBe(401);
    expect((await request(ctx.app).get('/api/v1/recommendations')).status).toBe(401);
    expect((await request(ctx.app).post('/api/v1/moods').send({ level: 3 })).status).toBe(401);
  });
});
