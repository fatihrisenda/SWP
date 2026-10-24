/** Handler MSW dasar untuk uji komponen FE (Issue 061). Test dapat menambah/override via `server.use`. */
import { http, HttpResponse } from 'msw';
import { API_BASE } from '../src/lib/api';
import type { TaskDto } from '../src/lib/dto';
import { CATEGORY_ID, makeAdminUser, makeCategory, makeConflicts, makeDashboard, makeRecommendations, makeTask, makeUser } from './factories';

export const TEST_PASSWORD = 'PasswordKuat1';

interface Db {
  user: ReturnType<typeof makeUser>;
  categories: ReturnType<typeof makeCategory>[];
  tasks: TaskDto[];
  mood: number | null;
}

export function freshDb(): Db {
  return {
    user: makeUser(),
    categories: [
      makeCategory(),
      makeCategory({ id: CATEGORY_ID.praktikum, name: 'Praktikum', color: '#7C3AED', taskCount: 0 }),
      makeCategory({ id: CATEGORY_ID.olahraga, name: 'Olahraga', color: '#16A34A', type: 'PRIBADI', taskCount: 1 }),
    ],
    tasks: [makeTask()],
    mood: null,
  };
}

export const db = freshDb();

export function resetDb(): void {
  Object.assign(db, freshDb());
}

const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ error: { code, message, ...extra } }, { status });

export const handlers = [
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email !== db.user.email || body.password !== TEST_PASSWORD) {
      return fail(401, 'INVALID_CREDENTIALS', 'Email atau password tidak valid');
    }
    return HttpResponse.json({ user: db.user });
  }),

  http.post(`${API_BASE}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { name?: string; email?: string };
    return HttpResponse.json({ user: makeUser({ name: body.name ?? 'Budi Siswa', email: body.email ?? db.user.email }) }, { status: 201 });
  }),

  http.get(`${API_BASE}/auth/me`, () => HttpResponse.json({ user: db.user })),
  http.post(`${API_BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.patch(`${API_BASE}/me`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(db.user, body);
    return HttpResponse.json({ user: db.user });
  }),

  http.get(`${API_BASE}/categories`, () => HttpResponse.json(db.categories)),
  http.post(`${API_BASE}/categories`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    const category = makeCategory({ id: crypto.randomUUID(), ...body });
    db.categories.push(category);
    return HttpResponse.json(category, { status: 201 });
  }),
  http.patch(`${API_BASE}/categories/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, string>;
    const current = db.categories.find((item) => item.id === params.id) ?? db.categories[0];
    if (!current) return fail(404, 'NOT_FOUND', 'Kategori tidak ditemukan');
    Object.assign(current, body);
    return HttpResponse.json(current);
  }),
  http.delete(`${API_BASE}/categories/:id`, ({ params }) => {
    db.categories = db.categories.filter((item) => item.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE}/tasks`, () => HttpResponse.json({ items: db.tasks, total: db.tasks.length })),
  http.get(`${API_BASE}/tasks/analytics`, () => HttpResponse.json(makeDashboard().analytics)),
  http.get(`${API_BASE}/tasks/:id`, ({ params }) => {
    const task = db.tasks.find((item) => item.id === params.id);
    return task ? HttpResponse.json(task) : fail(404, 'NOT_FOUND', 'Tugas tidak ditemukan');
  }),
  http.post(`${API_BASE}/tasks`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const task = makeTask({ id: 'task-new', title: String(body.title ?? 'Tugas baru') });
    db.tasks.push(task);
    return HttpResponse.json(task, { status: 201 });
  }),
  http.patch(`${API_BASE}/tasks/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const current = db.tasks.find((item) => item.id === params.id) ?? db.tasks[0];
    if (!current) return fail(404, 'NOT_FOUND', 'Tugas tidak ditemukan');
    Object.assign(current, body);
    return HttpResponse.json(current);
  }),
  http.patch(`${API_BASE}/tasks/:id/status`, async ({ params, request }) => {
    const body = (await request.json()) as { status: TaskDto['status'] };
    const current = db.tasks.find((item) => item.id === params.id) ?? db.tasks[0];
    if (!current) return fail(404, 'NOT_FOUND', 'Tugas tidak ditemukan');
    current.status = body.status;
    return HttpResponse.json(current);
  }),
  http.delete(`${API_BASE}/tasks/:id`, ({ params }) => {
    db.tasks = db.tasks.filter((item) => item.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API_BASE}/tasks/conflicts`, () => HttpResponse.json(makeConflicts())),

  http.get(`${API_BASE}/dashboard`, () => HttpResponse.json(makeDashboard())),
  http.get(`${API_BASE}/moods/today`, () => HttpResponse.json({ level: db.mood })),
  http.get(`${API_BASE}/moods`, () =>
    HttpResponse.json(db.mood === null ? [] : [{ level: db.mood, at: new Date().toISOString() }]),
  ),
  http.post(`${API_BASE}/moods`, async ({ request }) => {
    const body = (await request.json()) as { level: number };
    db.mood = body.level;
    return HttpResponse.json({ level: body.level, at: new Date().toISOString() }, { status: 201 });
  }),
  http.get(`${API_BASE}/recommendations`, () => HttpResponse.json(makeRecommendations())),

  http.get(`${API_BASE}/push/public-key`, () => HttpResponse.json({ publicKey: null })),
  http.post(`${API_BASE}/push/subscriptions`, () => new HttpResponse(null, { status: 201 })),
  http.delete(`${API_BASE}/push/subscriptions`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/push/test`, () => HttpResponse.json({ sent: 1, failed: 0, totalSubscriptions: 1 })),

  http.get(`${API_BASE}/admin/stats`, () =>
    HttpResponse.json({ totalUsers: 2, totalMahasiswa: 1, totalSuperAdmin: 1 }),
  ),
  http.get(`${API_BASE}/admin/users`, () => HttpResponse.json([makeAdminUser()])),
];
