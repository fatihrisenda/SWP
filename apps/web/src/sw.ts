/// <reference lib="webworker" />
/**
 * Service Worker (Issue 053) — Workbox `injectManifest`.
 *
 * Aturan penting:
 * - Hanya shell (html/js/css/ikon ber-hash) yang di-precache. `/api/*` TIDAK PERNAH
 *   di-cache: datanya pribadi dan bisa terbaca di perangkat bersama setelah logout.
 * - Tidak ada `clientsClaim()`: aktivasi menunggu keputusan pengguna (Issue 056),
 *   supaya form yang sedang diisi tidak hilang karena reload mendadak.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Fallback SPA untuk navigasi — kecuali /api (jangan pernah sajikan index.html untuk API).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('push', (event) => {
  const payload = (event.data?.json() ?? {}) as { title?: unknown; body?: unknown; tag?: unknown; url?: unknown };
  // WAJIB selalu showNotification: Safari/iOS mencabut izin bila push "diam-diam".
  event.waitUntil(
    self.registration.showNotification(typeof payload.title === 'string' ? payload.title : 'StudyWork Planner', {
      body: typeof payload.body === 'string' ? payload.body : undefined,
      tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: typeof payload.url === 'string' ? payload.url : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | undefined;
  const target = new URL(typeof data?.url === 'string' ? data.url : '/', self.location.origin);
  if (target.origin !== self.location.origin) return; // tolak URL luar
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = windows[0];
      if (win) {
        await win.focus();
        if ('navigate' in win) await win.navigate(target.href);
      } else {
        await self.clients.openWindow(target.href);
      }
    })(),
  );
});

/** Langganan kedaluwarsa di sisi push service: daftar ulang diam-diam lalu laporkan ke server. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: event.oldSubscription?.options.applicationServerKey ?? null,
        });
        await reportSubscription(subscription);
      } catch {
        // Offline, izin dicabut, atau VAPID key hilang: status shownya akan diperbaiki
        // halaman Pengaturan saat dibuka kembali (resync diam-diam di sisi klien).
      }
    })(),
  );
});

async function reportSubscription(subscription: PushSubscription): Promise<void> {
  const key = (name: PushEncryptionKeyName): string => base64Url(subscription.getKey(name) ?? new ArrayBuffer(0));
  const response = await fetch('/api/v1/push/subscriptions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh: key('p256dh'), auth: key('auth') },
      userAgent: self.navigator?.userAgent.slice(0, 255) ?? '',
    }),
  });
  if (!response.ok) throw new Error(`gagal melaporkan langganan push: ${response.status}`);
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
