import { afterEach, describe, expect, it, vi } from 'vitest';

const { sendNotificationMock, setVapidDetailsMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
}));

vi.mock('web-push', () => {
  const api = { sendNotification: sendNotificationMock, setVapidDetails: setVapidDetailsMock };
  return { default: api, ...api };
});

const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };

/**
 * VAPID dibaca dari `env` saat modul dimuat, dan status "sudah dikonfigurasi" disimpan di
 * variabel modul, jadi setiap kasus butuh graph modul yang baru.
 */
async function loadPush(vapid: 'kosong' | 'terisi') {
  vi.resetModules();
  vi.stubEnv('VAPID_PUBLIC_KEY', vapid === 'terisi' ? 'BPUBLIKTEST' : '');
  vi.stubEnv('VAPID_PRIVATE_KEY', vapid === 'terisi' ? 'PRIVATTEST' : '');
  return import('../src/lib/push.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  sendNotificationMock.mockReset();
  setVapidDetailsMock.mockReset();
});

describe('push: ensureWebPushConfigured (Issue 030)', () => {
  it('tanpa kunci VAPID tidak memanggil setVapidDetails dan mengembalikan false', async () => {
    const { ensureWebPushConfigured } = await loadPush('kosong');
    expect(ensureWebPushConfigured()).toBe(false);
    expect(setVapidDetailsMock).not.toHaveBeenCalled();
  });

  it('dengan kunci VAPID, setVapidDetails hanya dipanggil sekali walau dipanggil berulang', async () => {
    const { ensureWebPushConfigured } = await loadPush('terisi');
    expect(ensureWebPushConfigured()).toBe(true);
    expect(ensureWebPushConfigured()).toBe(true);
    expect(setVapidDetailsMock).toHaveBeenCalledTimes(1);
    expect(setVapidDetailsMock).toHaveBeenCalledWith(expect.any(String), 'BPUBLIKTEST', 'PRIVATTEST');
  });
});

describe('push: sendPushNotification (Issue 030/031)', () => {
  it('VAPID belum diisi → ok:false dengan error VAPID_NOT_CONFIGURED, tanpa panggilan jaringan', async () => {
    const { sendPushNotification } = await loadPush('kosong');
    const result = await sendPushNotification(sub, { title: 'x' });
    expect(result).toMatchObject({ ok: false });
    expect((result.error as Error).message).toBe('VAPID_NOT_CONFIGURED');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('kirim berhasil → ok:true beserta statusCode, payload diserialisasi jadi JSON', async () => {
    const { sendPushNotification } = await loadPush('terisi');
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });
    const result = await sendPushNotification(sub, { title: 'Belajar', body: 'Mulai 10:00' }, { TTL: 60 });
    expect(result).toEqual({ ok: true, statusCode: 201 });
    expect(sendNotificationMock).toHaveBeenCalledWith(sub, JSON.stringify({ title: 'Belajar', body: 'Mulai 10:00' }), { TTL: 60 });
  });

  it.each([
    [404, true],
    [410, true],
    [400, false],
    [500, false],
  ])('statusCode %i → expired:%j (subsripsi mati hanya untuk 404/410)', async (statusCode, expired) => {
    const { sendPushNotification } = await loadPush('terisi');
    sendNotificationMock.mockRejectedValue(Object.assign(new Error('push gagal'), { statusCode }));
    const result = await sendPushNotification(sub, { title: 'x' });
    expect(result).toMatchObject({ ok: false, statusCode, expired });
  });

  it('galat tanpa statusCode (mis. jaringan) tidak dianggap subsripsi kedaluwarsa', async () => {
    const { sendPushNotification } = await loadPush('terisi');
    sendNotificationMock.mockRejectedValue(new Error('ETIMEDOUT'));
    const result = await sendPushNotification(sub, { title: 'x' });
    expect(result).toMatchObject({ ok: false, expired: false });
    expect(result.error).toBeInstanceOf(Error);
  });
});
