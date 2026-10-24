import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestContext } from './helpers.js';
import { deadlineInput, makeSession, makeUser, setup, truncateAll, twoUsers } from './helpers.js';

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

async function studentWithToken() {
  const user = await makeUser(ctx);
  const token = await makeSession(ctx, user.id);
  const cookie = ctx.cookie(token);
  const categoryId = (await ctx.prisma.category.findFirstOrThrow({ where: { userId: user.id, type: 'KULIAH' } })).id;
  return { user, cookie, categoryId };
}

describe('kategori (Issue 021, FR-07)', () => {
  it('GET /categories memuat milik user saja dengan taskCount', async () => {
    const a = await studentWithToken();
    const b = await studentWithToken();
    await ctx.prisma.task.create({
      data: { id: crypto.randomUUID(), userId: a.user.id, categoryId: a.categoryId, title: 'Tiga Tugas', importance: 3, difficulty: 2, type: 'DEADLINE', deadlineAt: new Date(Date.now() + 3_600_000), durationMinutes: 60 },
    });
    await ctx.prisma.task.create({
      data: { id: crypto.randomUUID(), userId: b.user.id, categoryId: (await ctx.prisma.category.findFirstOrThrow({ where: { userId: b.user.id } })).id, title: 'Punya B', importance: 2, difficulty: 2, type: 'DEADLINE', deadlineAt: new Date(Date.now() + 3_600_000), durationMinutes: 60 },
    });

    const res = await request(ctx.app).get('/api/v1/categories').set('Cookie', a.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((c: { userId?: string }) => c.userId === undefined)).toBe(true);
    const counts = Object.fromEntries(res.body.map((c: { name: string; taskCount: number }) => [c.name, c.taskCount]));
    expect(counts['Kuliah Uji']).toBe(1);
    expect(counts['Pribadi Uji']).toBe(0);
  });

  it('POST /categories membuat kategori baru (warna dinormalisasi uppercase)', async () => {
    const s = await studentWithToken();
    const res = await request(ctx.app).post('/api/v1/categories').set('Cookie', s.cookie).send({
      name: 'Riset',
      color: '#ff8800',
      type: 'PRIBADI',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Riset', color: '#FF8800', type: 'PRIBADI', taskCount: 0 });
  });

  it('validasi POST: warna salah, name kosong, key asing → 400 dengan fields', async () => {
    const s = await studentWithToken();
    const badColor = await request(ctx.app)
      .post('/api/v1/categories')
      .set('Cookie', s.cookie)
      .send({ name: 'Warna Salah', color: 'merah', type: 'KULIAH' });
    expect(badColor.status).toBe(400);
    expect(Object.keys(badColor.body.error.fields)).toContain('color');

    const emptyName = await request(ctx.app)
      .post('/api/v1/categories')
      .set('Cookie', s.cookie)
      .send({ name: '   ', color: '#123456', type: 'KULIAH' });
    expect(emptyName.status).toBe(400);

    const extraKey = await request(ctx.app)
      .post('/api/v1/categories')
      .set('Cookie', s.cookie)
      .send({ name: 'Asing', color: '#123456', type: 'KULIAH', userId: 'orang-lain' });
    expect(extraKey.status).toBe(400);
  });

  it('nama duplikat dalam type yang sama → 409 NAME_TAKEN; type berbeda boleh', async () => {
    const s = await studentWithToken();
    const first = await request(ctx.app).post('/api/v1/categories').set('Cookie', s.cookie).send({ name: 'Ganda', color: '#123456', type: 'KULIAH' });
    expect(first.status).toBe(201);

    const dup = await request(ctx.app).post('/api/v1/categories').set('Cookie', s.cookie).send({ name: 'ganda', color: '#ABCDEF', type: 'KULIAH' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('NAME_TAKEN');

    const otherType = await request(ctx.app).post('/api/v1/categories').set('Cookie', s.cookie).send({ name: 'Ganda', color: '#123456', type: 'PRIBADI' });
    expect(otherType.status).toBe(201);
  });

  it('PATCH /categories/:id mengubah sebagian field dan 404 untuk milik user lain', async () => {
    const a = await studentWithToken();
    const b = await studentWithToken();

    const ok = await request(ctx.app).patch(`/api/v1/categories/${a.categoryId}`).set('Cookie', a.cookie).send({ color: '#000000' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: a.categoryId, color: '#000000', name: 'Kuliah Uji' });

    const crossUser = await request(ctx.app).patch(`/api/v1/categories/${a.categoryId}`).set('Cookie', b.cookie).send({ color: '#111111' });
    expect(crossUser.status).toBe(404);

    const unknown = await request(ctx.app).patch(`/api/v1/categories/${crypto.randomUUID()}`).set('Cookie', a.cookie).send({ color: '#111111' });
    expect(unknown.status).toBe(404);
  });

  it('DELETE kategori kosong → 204; terpakai tanpa reassignTo → 409 CATEGORY_IN_USE + taskCount', async () => {
    const s = await studentWithToken();
    const created = await request(ctx.app).post('/api/v1/categories').set('Cookie', s.cookie).send({ name: 'Sementara', color: '#123456', type: 'KULIAH' });
    expect((await request(ctx.app).delete(`/api/v1/categories/${created.body.id}`).set('Cookie', s.cookie)).status).toBe(204);
    expect(await ctx.prisma.category.count({ where: { id: created.body.id } })).toBe(0);

    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.categoryId));
    const inUse = await request(ctx.app).delete(`/api/v1/categories/${s.categoryId}`).set('Cookie', s.cookie);
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe('CATEGORY_IN_USE');
  });

  it('DELETE dengan reassignTo memindahkan tugas lalu menghapus kategori', async () => {
    const s = await studentWithToken();
    const target = await request(ctx.app).post('/api/v1/categories').set('Cookie', s.cookie).send({ name: 'Pindahan', color: '#654321', type: 'KULIAH' });

    await request(ctx.app).post('/api/v1/tasks').set('Cookie', s.cookie).send(deadlineInput(s.categoryId));

    const del = await request(ctx.app).delete(`/api/v1/categories/${s.categoryId}?reassignTo=${target.body.id}`).set('Cookie', s.cookie);
    expect(del.status).toBe(204);
    expect(await ctx.prisma.category.count({ where: { id: s.categoryId } })).toBe(0);
    expect(await ctx.prisma.task.count({ where: { userId: s.user.id, categoryId: target.body.id } })).toBe(1);
  });

  it('reassignTo yang sama dengan kategori yang dihapus → 400; milik user lain → 404', async () => {
    const a = await studentWithToken();
    const b = await studentWithToken();
    await ctx.prisma.task.create({
      data: { id: crypto.randomUUID(), userId: a.user.id, categoryId: a.categoryId, title: 'Penghuni', importance: 3, difficulty: 3, type: 'DEADLINE', deadlineAt: new Date(Date.now() + 3_600_000), durationMinutes: 60 },
    });

    const self = await request(ctx.app).delete(`/api/v1/categories/${a.categoryId}?reassignTo=${a.categoryId}`).set('Cookie', a.cookie);
    expect(self.status).toBe(400);

    const foreign = await request(ctx.app).delete(`/api/v1/categories/${a.categoryId}?reassignTo=${b.categoryId}`).set('Cookie', a.cookie);
    expect(foreign.status).toBe(404);
    expect(await ctx.prisma.category.count({ where: { id: a.categoryId } })).toBe(1);
  });

  it('IDOR: user A tidak bisa GET/DELETE kategori milik B (404, bukan 403)', async () => {
    const { a, b } = await twoUsers(ctx);
    const aToken = await makeSession(ctx, a.id);
    const bCategory = (await ctx.prisma.category.findFirstOrThrow({ where: { userId: b.id } })).id;

    expect((await request(ctx.app).delete(`/api/v1/categories/${bCategory}`).set('Cookie', ctx.cookie(aToken))).status).toBe(404);
    expect(await ctx.prisma.category.count({ where: { id: bCategory } })).toBe(1);
  });

  it('membuat tugas dengan categoryId milik user lain → 404 dan tidak ada baris tugas', async () => {
    const { a, b } = await twoUsers(ctx);
    const aToken = await makeSession(ctx, a.id);
    const bCategory = (await ctx.prisma.category.findFirstOrThrow({ where: { userId: b.id } })).id;

    const res = await request(ctx.app).post('/api/v1/tasks').set('Cookie', ctx.cookie(aToken)).send(deadlineInput(bCategory));
    expect(res.status).toBe(404);
    expect(await ctx.prisma.task.count({ where: { userId: a.id } })).toBe(0);
  });
});
