import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestContext } from './helpers.js';
import { deadlineInput, makeSession, makeUser, nextIp, PASSWORD, setup, truncateAll } from './helpers.js';

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

async function student() {
  const user = await makeUser(ctx);
  const cookie = ctx.cookie(await makeSession(ctx, user.id));
  const categoryId = (await ctx.prisma.category.findFirstOrThrow({ where: { userId: user.id, type: 'KULIAH' } })).id;
  return { user, cookie, categoryId };
}

describe('fondasi HTTP (Issue 006, 009)', () => {
  it('healthz/readyz publik tanpa autentikasi', async () => {
    expect((await request(ctx.app).get('/api/v1/healthz')).body).toEqual({ status: 'ok' });
    const ready = await request(ctx.app).get('/api/v1/readyz');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: 'ok' });
  });

  it('route tak dikenal → 404 format error standar', async () => {
    const res = await request(ctx.app).get('/api/v1/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.error.message).toContain('GET /api/v1/tidak-ada');
  });

  it('tidak ada X-Powered-By, ada CSP ketat dan Cache-Control no-store', async () => {
    const res = await request(ctx.app).get('/api/v1/healthz');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('method yang tidak diizinkan pada rute yang diketahui → 404', async () => {
    const res = await request(ctx.app).put('/api/v1/healthz');
    expect(res.status).toBe(404);
  });
});

describe('validasi konten & ukuran body (Issue 009)', () => {
  it('Content-Type non-JSON pada method mutasi → 415', async () => {
    const s = await student();
    const res = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .set('Content-Type', 'text/plain')
      .send('bukan json');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('JSON rusak → 400 VALIDATION_ERROR, bukan 500', async () => {
    const s = await student();
    const res = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .set('Content-Type', 'application/json')
      .send('{"type":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('body > 100 KB → 413 PAYLOAD_TOO_LARGE', async () => {
    const s = await student();
    const res = await request(ctx.app)
      .post('/api/v1/tasks')
      .set('Cookie', s.cookie)
      .send(deadlineInput(s.categoryId, { description: 'x'.repeat(120_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('anti-CSRF lewat Origin / Sec-Fetch-Site (Issue 009, 013)', () => {
  it('Origin yang bukan APP_ORIGIN → 403 dan state tidak berubah', async () => {
    const s = await student();
    const res = await request(ctx.app)
      .post('/api/v1/categories')
      .set('Cookie', s.cookie)
      .set('Origin', 'https://penyerang.example')
      .send({ name: 'Suntikan', color: '#123456', type: 'KULIAH' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await ctx.prisma.category.count({ where: { userId: s.user.id, name: 'Suntikan' } })).toBe(0);
  });

  it('Origin sesuai APP_ORIGIN (.env.test) diterima', async () => {
    const s = await student();
    const res = await request(ctx.app)
      .post('/api/v1/categories')
      .set('Cookie', s.cookie)
      .set('Origin', 'http://localhost:5173')
      .send({ name: 'Sah', color: '#123456', type: 'KULIAH' });
    expect(res.status).toBe(201);
  });

  it('Sec-Fetch-Site: cross-site → 403; same-origin → lolos', async () => {
    const s = await student();
    const blocked = await request(ctx.app)
      .post('/api/v1/categories')
      .set('Cookie', s.cookie)
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ name: 'Lintas', color: '#123456', type: 'KULIAH' });
    expect(blocked.status).toBe(403);

    const allowed = await request(ctx.app)
      .post('/api/v1/categories')
      .set('Cookie', s.cookie)
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ name: 'Sama', color: '#123456', type: 'KULIAH' });
    expect(allowed.status).toBe(201);
  });

  it('request GET tidak memerlukan Origin', async () => {
    const s = await student();
    const res = await request(ctx.app).get('/api/v1/categories').set('Cookie', s.cookie).set('Origin', 'https://penyerang.example');
    expect(res.status).toBe(200);
  });
});

describe('throttling login/register (Issue 014)', () => {
  it('6 login salah beruntun dari IP+email yang sama → permintaan ke-6 dapat 429', async () => {
    const target = await makeUser(ctx);
    const from = nextIp();
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(
        await request(ctx.app)
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', from)
          .send({ email: target.email, password: `SalahBanget${i}` }),
      );
    }
    expect(attempts.slice(0, 5).every((r) => r.status === 401)).toBe(true);
    const sixth = attempts[5]!;
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('RATE_LIMITED');
    expect(sixth.headers['retry-after']).toBeDefined();
  });

  it('login benar dari IP lain untuk email yang sama tetap bisa', async () => {
    const target = await makeUser(ctx);
    const from = nextIp();
    for (let i = 0; i < 6; i++) {
      await request(ctx.app).post('/api/v1/auth/login').set('X-Forwarded-For', from).send({ email: target.email, password: 'SalahBanget' });
    }
    const lain = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: target.email, password: PASSWORD });
    expect(lain.status).toBe(200);
  });

  it('register lebih dari 5/jam dari IP yang sama → 429', async () => {
    const from = nextIp();
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(
        await request(ctx.app)
          .post('/api/v1/auth/register')
          .set('X-Forwarded-For', from)
          .send({ name: `Mahasiswa ${i}`, email: `throttle${i}@test.local`, password: PASSWORD, confirmPassword: PASSWORD }),
      );
    }
    expect(results.slice(0, 5).every((r) => r.status === 201)).toBe(true);
    expect(results[5]!.status).toBe(429);
  });
});

describe('web push: validasi endpoint & kunci publik (Issue 030)', () => {
  it('GET /push/public-key → null saat VAPID belum dikonfigurasi', async () => {
    const s = await student();
    const res = await request(ctx.app).get('/api/v1/push/public-key').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: null });
  });

  it('endpoint di luar allowlist / http / IP literal / localhost ditolak 400', async () => {
    const s = await student();
    const rejected = [
      'http://fcm.googleapis.com/v1/abc',
      'https://penyerang.example/v1/abc',
      'https://127.0.0.1/v1/abc',
      'https://localhost:9000/v1/abc',
      'bukan-url',
    ];
    for (const endpoint of rejected) {
      const res = await request(ctx.app)
        .post('/api/v1/push/subscriptions')
        .set('Cookie', s.cookie)
        .send({ endpoint, keys: { p256dh: 'kunci', auth: 'auth' } });
      expect(res.status, endpoint).toBe(400);
      // URL yang sama sekali tidak parseable dihentikan Zod lebih dulu; sisanya oleh allowlist.
      expect(['INVALID_ENDPOINT', 'VALIDATION_ERROR'], endpoint).toContain(res.body.error.code);
    }
    expect(await ctx.prisma.pushSubscription.count()).toBe(0);
  });

  it('endpoint resmi diterima, subscribe ulang memindahkan kepemilikan, unsubscribe → 204', async () => {
    const a = await student();
    const b = await student();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/token-abc';

    expect(
      (
        await request(ctx.app)
          .post('/api/v1/push/subscriptions')
          .set('Cookie', a.cookie)
          .send({ endpoint, keys: { p256dh: 'p1', auth: 'a1' }, userAgent: 'Vitest' })
      ).status,
    ).toBe(200);
    expect(await ctx.prisma.pushSubscription.count({ where: { userId: a.user.id } })).toBe(1);

    expect(
      (
        await request(ctx.app)
          .post('/api/v1/push/subscriptions')
          .set('Cookie', b.cookie)
          .send({ endpoint, keys: { p256dh: 'p2', auth: 'a2' } })
      ).status,
    ).toBe(200);
    const row = await ctx.prisma.pushSubscription.findFirstOrThrow({ where: { endpoint } });
    expect(row.userId).toBe(b.user.id);

    const unsub = await request(ctx.app).delete('/api/v1/push/subscriptions').set('Cookie', b.cookie).send({ endpoint });
    expect(unsub.status).toBe(204);
    expect(await ctx.prisma.pushSubscription.count()).toBe(0);

    const unsubLagi = await request(ctx.app).delete('/api/v1/push/subscriptions').set('Cookie', a.cookie).send({ endpoint });
    expect(unsubLagi.status).toBe(204);
  });

  it('maksimal 10 langganan per user: yang tertua di-out', async () => {
    const s = await student();
    for (let i = 0; i < 10; i++) {
      await ctx.prisma.pushSubscription.create({
        data: {
          id: crypto.randomUUID(),
          userId: s.user.id,
          endpoint: `https://fcm.googleapis.com/fcm/send/lam-${i}`,
          p256dh: 'p',
          auth: 'a',
          createdAt: new Date(Date.now() - (11 - i) * 60_000),
        },
      });
    }
    await request(ctx.app)
      .post('/api/v1/push/subscriptions')
      .set('Cookie', s.cookie)
      .send({ endpoint: 'https://updates.push.services.mozilla.com/wpush/baru', keys: { p256dh: 'p', auth: 'a' } });

    const remaining = await ctx.prisma.pushSubscription.findMany({ where: { userId: s.user.id }, orderBy: { createdAt: 'asc' } });
    expect(remaining).toHaveLength(10);
    expect(remaining[0]!.endpoint).toBe('https://fcm.googleapis.com/fcm/send/lam-1');
  });

  it('/push/test tanpa langganan → 0 terkirim dan dibatasi 5/menit per user', async () => {
    const s = await student();
    for (let i = 0; i < 6; i++) {
      const res = await request(ctx.app).post('/api/v1/push/test').set('Cookie', s.cookie);
      if (i < 5) expect(res.status, String(i)).toBe(200);
      else expect(res.status).toBe(429);
    }
    const ok = await request(ctx.app).post('/api/v1/push/test').set('Cookie', (await student()).cookie);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ sent: 0, failed: 0, totalSubscriptions: 0 });
  });

  it('endpoint push milik user lain tidak bisa di-unsubscribe (deleteMany dipfilter userId)', async () => {
    const a = await student();
    const b = await student();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/milik-a';
    await ctx.prisma.pushSubscription.create({ data: { id: crypto.randomUUID(), userId: a.user.id, endpoint, p256dh: 'p', auth: 'a' } });

    await request(ctx.app).delete('/api/v1/push/subscriptions').set('Cookie', b.cookie).send({ endpoint });
    expect(await ctx.prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
  });
});
