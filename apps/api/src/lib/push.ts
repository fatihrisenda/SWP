import net from 'node:net';
import webpush from 'web-push';
import { env } from '../config/env.js';

/** Allowlist layanan Web Push resmi (Issue 030 — anti-SSRF). */
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
  'notify.windows.com',
];

/**
 * Validasi endpoint push sebelum disimpan/dipakai: wajib `https:`, host bukan IP literal/localhost,
 * dan host harus termasuk (atau subdomain dari) salah satu layanan push resmi.
 */
export function isAllowedPushEndpoint(endpointUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(endpointUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const hostname = url.hostname.toLowerCase();
  if (net.isIP(hostname) !== 0) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  return ALLOWED_PUSH_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

let configured = false;

/** Konfigurasi VAPID sekali saja (lazy); mengembalikan false bila kunci belum diisi (dev tanpa push). */
export function ensureWebPushConfigured(): boolean {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface PushSubscriptionLike {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface SendPushResult {
  ok: boolean;
  statusCode?: number;
  expired?: boolean;
  error?: unknown;
}

/** Kirim satu notifikasi; dipanggil worker (Issue 031) & `/push/test` (Issue 030). */
export async function sendPushNotification(
  sub: PushSubscriptionLike,
  payload: object,
  options?: webpush.RequestOptions,
): Promise<SendPushResult> {
  if (!ensureWebPushConfigured()) {
    return { ok: false, error: new Error('VAPID_NOT_CONFIGURED') };
  }
  try {
    const res = await webpush.sendNotification(sub, JSON.stringify(payload), options);
    return { ok: true, statusCode: res.statusCode };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    return { ok: false, statusCode, expired: statusCode === 404 || statusCode === 410, error: err };
  }
}
