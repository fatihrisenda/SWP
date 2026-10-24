import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestContext } from './helpers.js';
import { makeSession, makeUser, nextIp, PASSWORD, setup, truncateAll } from './helpers.js';

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

const ip = () => nextIp();
const register = (body: Record<string, unknown>, from = ip()) =>
  request(ctx.app).post('/api/v1/auth/register').set('X-Forwarded-For', from).send(body);
const login = (body: Record<string, unknown>, from = ip()) =>
  request(ctx.app).post('/api/v1/auth/login').set('X-Forwarded-For', from).send(body);
const tokenOf = (res: request.Response): string => res.headers['set-cookie']![0]!.split(';')[0]!.split('=')[1]!;

describe('auth: register (Issue 010)', () => {
  it('membuat MAHASISWA dengan 11 kategori default + cookie sesi, tanpa passwordHash di respons', async () => {
    const res = await register({
      name: 'Budi Santoso',
      email: 'Budi.Mail@Example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      timezone: 'Asia/Jakarta',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Budi Santoso', email: 'budi.mail@example.com', role: 'MAHASISWA' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toContain('swp_session=');

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'budi.mail@example.com' } });
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await ctx.prisma.category.count({ where: { userId: stored.id } })).toBe(11);

    const me = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(tokenOf(res)));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('budi.mail@example.com');
  });

  it('menolak input tidak valid dengan fields Zod', async () => {
    const short = await register({ name: 'Caca', email: 'pendek@example.com', password: 'abc1234', confirmPassword: 'abc1234' });
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(short.body.error.fields)).toContain('password');

    const mismatch = await register({
      name: 'Caca',
      email: 'beda@example.com',
      password: PASSWORD,
      confirmPassword: 'Password999!',
    });
    expect(mismatch.status).toBe(400);
    expect(Object.keys(mismatch.body.error.fields)).toContain('confirmPassword');

    const badEmail = await register({ name: 'Caca', email: 'bukan-email', password: PASSWORD, confirmPassword: PASSWORD });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('key `role` dari klien ditolak (.strict) dan tidak pernah menghasilkan SuperAdmin', async () => {
    const res = await register({
      name: 'Caca',
      email: 'extra@example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      role: 'SUPERADMIN',
    });
    expect(res.status).toBe(400);
    expect(await ctx.prisma.user.count({ where: { role: 'SUPERADMIN' } })).toBe(0);
  });

  it('email yang sama (case-insensitive) menghasilkan 409 EMAIL_TAKEN', async () => {
    const first = await register({
      name: 'Duplikat Satu',
      email: 'duplikat@example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    expect(first.status).toBe(201);

    const second = await register({
      name: 'Duplikat Dua',
      email: 'DUPLIKAT@example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_TAKEN');
    expect(second.body.error.message).toBe('Email sudah terdaftar');
  });
});

describe('auth: login (Issue 011)', () => {
  beforeEach(async () => {
    await makeUser(ctx, { name: 'Pemegang Kata Kunci' });
  });

  it('login benar → 200 { user } dan cookie HttpOnly SameSite=Lax tanpa Secure/Max-Age', async () => {
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'MAHASISWA' } });
    const res = await login({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.passwordHash).toBeUndefined();

    const setCookie = res.headers['set-cookie']![0]!;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toContain('Secure');
    expect(setCookie).not.toMatch(/Max-Age|Expires/i);
    expect(await ctx.prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it('remember=true → cookie persisten (Max-Age + Expires)', async () => {
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'MAHASISWA' } });
    const res = await login({ email: user.email, password: PASSWORD, remember: true });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']![0]).toMatch(/Max-Age=/i);
    const session = await ctx.prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 3_600_000);
  });

  it('login sukses membuat sesi baru (anti session fixation)', async () => {
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'MAHASISWA' } });
    await login({ email: user.email, password: PASSWORD });
    const second = await login({ email: user.email, password: PASSWORD });
    expect(second.status).toBe(200);
    expect(await ctx.prisma.session.count({ where: { userId: user.id } })).toBe(2);
  });

  it('pesan salah kredensial identik untuk email tak terdaftar dan password salah', async () => {
    const user = await ctx.prisma.user.findFirstOrThrow({ where: { role: 'MAHASISWA' } });
    const wrongPassword = await login({ email: user.email, password: 'SalahBanget1' });
    const unknownEmail = await login({ email: 'tidak.ada@example.com', password: 'SalahBanget1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email atau password tidak valid',
    });
    expect(await ctx.prisma.auditLog.count({ where: { action: 'LOGIN_FAIL' } })).toBe(2);
  });

  it('body login tidak valid → 400 VALIDATION_ERROR', async () => {
    const res = await login({ email: 'bukan-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('auth: sesi, logout, dan RBAC (Issue 012, 013)', () => {
  it('token JWT dengan secret salah → 401 dan cookie dihapus', async () => {
    const user = await makeUser(ctx);
    const { SignJWT } = await import('jose');
    const forged = await new SignJWT({ sub: user.id, sid: crypto.randomUUID() })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + 3_600_000) / 1000))
      .sign(new TextEncoder().encode('secret-salah-yang-panjang-ini-untuk-pengujian-0123456789'));

    const res = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(forged));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.headers['set-cookie']![0]).toMatch(/swp_session=;/);
  });

  it('token alg=none ditolak', async () => {
    const user = await makeUser(ctx);
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: user.id, sid: crypto.randomUUID() })).toString('base64url');
    const res = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(`${header}.${payload}.`));
    expect(res.status).toBe(401);
  });

  it('sesi revoked setelah logout → 401 walau JWT masih valid', async () => {
    const user = await makeUser(ctx);
    const token = await makeSession(ctx, user.id);

    expect((await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(token))).status).toBe(200);
    const out = await request(ctx.app).post('/api/v1/auth/logout').set('Cookie', ctx.cookie(token));
    expect(out.status).toBe(204);

    const reused = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(token));
    expect(reused.status).toBe(401);
    const again = await request(ctx.app).post('/api/v1/auth/logout').set('Cookie', ctx.cookie(token));
    expect(again.status).toBe(401);
  });

  it('sesi kedaluwarsa di DB → 401 walau JWT masih valid', async () => {
    const user = await makeUser(ctx);
    const token = await makeSession(ctx, user.id, { sessionTtlMs: -1000 });
    const res = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(token));
    expect(res.status).toBe(401);
  });

  it('sid yang tidak ada di DB → 401', async () => {
    const user = await makeUser(ctx);
    const { signSessionToken } = await import('../src/lib/jwt.js');
    const orphan = await signSessionToken({ sub: user.id, sid: crypto.randomUUID() }, Math.floor((Date.now() + 3_600_000) / 1000));
    const res = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(orphan));
    expect(res.status).toBe(401);
  });

  it('tanpa cookie → 401 pada seluruh endpoint yang butuh autentikasi', async () => {
    for (const path of [
      '/api/v1/auth/me',
      '/api/v1/tasks',
      '/api/v1/categories',
      '/api/v1/dashboard',
      '/api/v1/moods/today',
      '/api/v1/recommendations',
      '/api/v1/push/subscriptions',
      '/api/v1/admin/users',
    ]) {
      const res = await request(ctx.app).get(path);
      expect(res.status, path).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('role dibaca dari DB: mahasiswa ke /admin → 403 dan SuperAdmin ke /tasks → 403', async () => {
    const mahasiswa = await makeUser(ctx, { role: 'MAHASISWA' });
    const admin = await makeUser(ctx, { role: 'SUPERADMIN' });
    const mahasiswaToken = await makeSession(ctx, mahasiswa.id);
    const adminToken = await makeSession(ctx, admin.id);

    expect((await request(ctx.app).get('/api/v1/admin/users').set('Cookie', ctx.cookie(mahasiswaToken))).status).toBe(403);
    expect((await request(ctx.app).get('/api/v1/tasks').set('Cookie', ctx.cookie(adminToken))).status).toBe(403);
    expect((await request(ctx.app).get('/api/v1/admin/stats').set('Cookie', ctx.cookie(adminToken))).status).toBe(200);
  });

  it('PATCH /me memperbarui profil dan menolak kapasitas > 24 serta timezone invalid', async () => {
    const user = await makeUser(ctx);
    const token = await makeSession(ctx, user.id);

    const ok = await request(ctx.app)
      .patch('/api/v1/me')
      .set('Cookie', ctx.cookie(token))
      .send({ name: 'Nama Baru', locale: 'en', timezone: 'Asia/Makassar', dailyCapacityHours: 6 });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({
      name: 'Nama Baru',
      locale: 'en',
      timezone: 'Asia/Makassar',
      dailyCapacityHours: 6,
    });

    const badCapacity = await request(ctx.app)
      .patch('/api/v1/me')
      .set('Cookie', ctx.cookie(token))
      .send({ dailyCapacityHours: 30 });
    expect(badCapacity.status).toBe(400);

    const badTz = await request(ctx.app).patch('/api/v1/me').set('Cookie', ctx.cookie(token)).send({ timezone: 'Mars/Olympus' });
    expect(badTz.status).toBe(400);
    expect(badTz.body.error.fields).toMatchObject({ timezone: expect.any(String) });
  });

  it('tokenFor register: setelah register, /auth/me memakai cookie respons berhasil', async () => {
    const res = await register({ name: 'Sesi Baru', email: 'sesi.baru@example.com', password: PASSWORD, confirmPassword: PASSWORD });
    expect(res.status).toBe(201);
    const me = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', ctx.cookie(tokenOf(res)));
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('MAHASISWA');
  });
});
