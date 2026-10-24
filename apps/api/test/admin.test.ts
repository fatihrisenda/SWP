import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestContext } from './helpers.js';
import { deadlineInput, makeSession, makeUser, nextIp, PASSWORD, setup, truncateAll } from './helpers.js';

let ctx: TestContext;
let adminCookie: string;

beforeAll(async () => {
  ctx = await setup();
});

beforeEach(async () => {
  await truncateAll(ctx.prisma);
  const admin = await makeUser(ctx, { role: 'SUPERADMIN', name: 'Penjaga Sistem' });
  adminCookie = ctx.cookie(await makeSession(ctx, admin.id));
});

afterEach(async () => {
  await truncateAll(ctx.prisma);
});

const adminReq = { get: (p: string) => request(ctx.app).get(p).set('Cookie', adminCookie) };

describe('admin: statistik & daftar pengguna (Issue 033, FR-11)', () => {
  it('GET /admin/stats menghitung total, mahasiswa, dan superadmin', async () => {
    await makeUser(ctx);
    await makeUser(ctx);
    const res = await adminReq.get('/api/v1/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalUsers: 3, totalMahasiswa: 2, totalSuperAdmin: 1 });
  });

  it('GET /admin/users mendukung q, limit, offset dan tidak membocorkan passwordHash', async () => {
    const budi = await makeUser(ctx, { name: 'Budi Kurniawan' });
    const cita = await makeUser(ctx, { name: 'Cita Melati' });

    const all = await adminReq.get('/api/v1/admin/users');
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(3);
    expect(all.body[0].passwordHash).toBeUndefined();
    expect(all.body.map((u: { id: string }) => u.id)).toEqual([cita.id, budi.id, expect.any(String)]);

    const byName = await adminReq.get('/api/v1/admin/users?q=cita');
    expect(byName.body).toHaveLength(1);
    expect(byName.body[0]).toMatchObject({ name: 'Cita Melati', role: 'MAHASISWA' });

    const paged = await adminReq.get('/api/v1/admin/users?limit=1&offset=1');
    expect(paged.body).toHaveLength(1);

    const bad = await adminReq.get('/api/v1/admin/users?limit=9999');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('mahasiswa tidak bisa membuka /admin/* (403) walau sesi valid', async () => {
    const mahasiswa = await makeUser(ctx);
    const cookie = ctx.cookie(await makeSession(ctx, mahasiswa.id));
    for (const path of ['/api/v1/admin/stats', '/api/v1/admin/users']) {
      const res = await request(ctx.app).get(path).set('Cookie', cookie);
      expect(res.status, path).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });
});

describe('admin: CRUD pengguna', () => {
  it('POST /admin/users membuat MAHASISWA dengan 11 kategori default dan audit log', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Mahasiswa Baru', email: 'Baru@Test.local', password: PASSWORD, role: 'MAHASISWA' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Mahasiswa Baru', email: 'baru@test.local', role: 'MAHASISWA' });
    expect(res.body.passwordHash).toBeUndefined();

    const created = await ctx.prisma.user.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(created.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await ctx.prisma.category.count({ where: { userId: created.id } })).toBe(11);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'USER_CREATE' } })).toBe(1);
  });

  it('POST /admin/users dengan role SUPERADMIN tidak membuat kategori default', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Admin Kedua', email: 'admin2@test.local', password: PASSWORD, role: 'SUPERADMIN' });
    expect(res.status).toBe(201);
    expect(await ctx.prisma.category.count({ where: { userId: res.body.id } })).toBe(0);
  });

  it('validasi POST: email duplikat 409, password pendek 400, field wajib kurang 400', async () => {
    const existing = await makeUser(ctx);
    const conflict = await request(ctx.app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Kembar', email: existing.email.toUpperCase(), password: PASSWORD, role: 'MAHASISWA' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('EMAIL_TAKEN');

    const weak = await request(ctx.app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Lemah', email: 'lemah@test.local', password: '1234567', role: 'MAHASISWA' });
    expect(weak.status).toBe(400);
    expect(Object.keys(weak.body.error.fields)).toContain('password');

    const missing = await request(ctx.app).post('/api/v1/admin/users').set('Cookie', adminCookie).send({ name: 'Tanpa Email' });
    expect(missing.status).toBe(400);
  });

  it('PATCH mengubah nama/email, mengganti password memutus sesi lama, dan menulis audit log tanpa password', async () => {
    const target = await makeUser(ctx, { name: 'Akan Diubah' });
    const targetCookie = ctx.cookie(await makeSession(ctx, target.id));
    expect((await request(ctx.app).get('/api/v1/auth/me').set('Cookie', targetCookie)).status).toBe(200);

    const renamed = await request(ctx.app).patch(`/api/v1/admin/users/${target.id}`).set('Cookie', adminCookie).send({ name: 'Sudah Diubah' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Sudah Diubah');
    expect((await request(ctx.app).get('/api/v1/auth/me').set('Cookie', targetCookie)).status).toBe(200);

    const passChanged = await request(ctx.app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set('Cookie', adminCookie)
      .send({ password: 'PasswordBaru9!' });
    expect(passChanged.status).toBe(200);

    const revoked = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', targetCookie);
    expect(revoked.status).toBe(401);

    const loginNew = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: target.email, password: 'PasswordBaru9!' });
    expect(loginNew.status).toBe(200);

    const audits = await ctx.prisma.auditLog.findMany({ where: { action: 'USER_UPDATE' } });
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits.map((a) => a.meta))).not.toContain('PasswordBaru9');
  });

  it('PATCH role MAHASISWA → SUPERADMIN ikut memutus sesi dan kategori default tidak dibuat', async () => {
    const target = await makeUser(ctx);
    await makeSession(ctx, target.id);
    const res = await request(ctx.app).patch(`/api/v1/admin/users/${target.id}`).set('Cookie', adminCookie).send({ role: 'SUPERADMIN' });
    expect(res.body.role).toBe('SUPERADMIN');
    expect(await ctx.prisma.session.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
  });

  it('PATCH/DELETE id tak dikenal → 404', async () => {
    const id = crypto.randomUUID();
    expect((await request(ctx.app).patch(`/api/v1/admin/users/${id}`).set('Cookie', adminCookie).send({ name: 'Hantu' })).status).toBe(404);
    expect((await request(ctx.app).delete(`/api/v1/admin/users/${id}`).set('Cookie', adminCookie)).status).toBe(404);
  });

  it('DELETE menghapus cascading data milik user (tugas, kategori, sesi, mood)', async () => {
    const target = await makeUser(ctx);
    const cookie = ctx.cookie(await makeSession(ctx, target.id));
    const created = await request(ctx.app).post('/api/v1/tasks').set('Cookie', cookie).send(deadlineInput(await categoryId(target.id)));
    await request(ctx.app).post('/api/v1/moods').set('Cookie', cookie).send({ level: 3 });

    const del = await request(ctx.app).delete(`/api/v1/admin/users/${target.id}`).set('Cookie', adminCookie);
    expect(del.status).toBe(204);
    expect(await ctx.prisma.task.count({ where: { userId: target.id } })).toBe(0);
    expect(await ctx.prisma.category.count({ where: { userId: target.id } })).toBe(0);
    expect(await ctx.prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await ctx.prisma.moodEntry.count({ where: { userId: target.id } })).toBe(0);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'USER_DELETE', targetUserId: target.id } })).toBe(1);
    void created;
  });

  it('SuperAdmin tidak bisa menghapus dirinya sendiri (403)', async () => {
    const me = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'SUPERADMIN' } });
    const res = await request(ctx.app).delete(`/api/v1/admin/users/${me.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Tidak bisa menghapus akun sendiri');
  });

  it('SuperAdmin terakhir tidak bisa diturunkan (409 LAST_SUPERADMIN)', async () => {
    const last = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'SUPERADMIN' } });
    const demote = await request(ctx.app).patch(`/api/v1/admin/users/${last.id}`).set('Cookie', adminCookie).send({ role: 'MAHASISWA' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.code).toBe('LAST_SUPERADMIN');
    expect(await ctx.prisma.user.count({ where: { role: 'SUPERADMIN' } })).toBe(1);
  });

  it('menurunkan salah satu dari dua SuperAdmin yang tersisa diizinkan', async () => {
    const kedua = await makeUser(ctx, { role: 'SUPERADMIN', name: 'Admin Tiga' });
    const me = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'SUPERADMIN', id: { not: kedua.id } } });
    const res = await request(ctx.app).patch(`/api/v1/admin/users/${me.id}`).set('Cookie', adminCookie).send({ role: 'MAHASISWA' });
    expect(res.status).toBe(200);
    expect((await request(ctx.app).get('/api/v1/admin/stats').set('Cookie', adminCookie)).status).toBe(401);
    expect(await ctx.prisma.user.count({ where: { role: 'SUPERADMIN' } })).toBe(1);
  });

  it('dengan dua SuperAdmin, salah satunya boleh dihapus', async () => {
    const kedua = await makeUser(ctx, { role: 'SUPERADMIN', name: 'Admin Dua' });
    const res = await request(ctx.app).delete(`/api/v1/admin/users/${kedua.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
    expect(await ctx.prisma.user.count({ where: { role: 'SUPERADMIN' } })).toBe(1);
  });

  it('promote mahasiswa lalu demote superadmin kedua menjaga guard aktif', async () => {
    const mahasiswa = await makeUser(ctx);
    await request(ctx.app).patch(`/api/v1/admin/users/${mahasiswa.id}`).set('Cookie', adminCookie).send({ role: 'SUPERADMIN' });
    const admin = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'SUPERADMIN', id: { not: mahasiswa.id } } });

    const demote = await request(ctx.app).patch(`/api/v1/admin/users/${admin.id}`).set('Cookie', adminCookie).send({ role: 'MAHASISWA' });
    expect(demote.status).toBe(200);
    expect(await ctx.prisma.user.count({ where: { role: 'SUPERADMIN' } })).toBe(1);
  });
});

async function categoryId(userId: string): Promise<string> {
  return (await ctx.prisma.category.findFirstOrThrow({ where: { userId, type: 'KULIAH' } })).id;
}
