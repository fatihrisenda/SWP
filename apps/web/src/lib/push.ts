/** Alur izin & langganan Web Push (Issue 055). */
import { apiFetch } from './api';

export type PushStatus = 'unsupported' | 'not-permission' | 'blocked' | 'active' | 'inactive' | 'needs-install';

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIosWithoutInstall(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
  return ios && !standalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code != null) bytes[i] = code;
  }
  return bytes;
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export async function currentEndpoint(): Promise<string | null> {
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

/** Harus dipanggil DARI handler klik (D-19: izin tidak diminta otomatis). */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const registration = await getRegistration();
  if (!registration) return 'unsupported';

  const { publicKey } = await apiFetch<{ publicKey: string | null }>('/push/public-key');
  if (!publicKey) return 'unsupported';

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await apiFetch('/push/subscriptions', {
    method: 'POST',
    body: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh') ?? new ArrayBuffer(0)),
        auth: arrayBufferToBase64Url(subscription.getKey('auth') ?? new ArrayBuffer(0)),
      },
      userAgent: navigator.userAgent.slice(0, 255),
    },
  });
  return 'granted';
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function disablePush(): Promise<void> {
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await apiFetch('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  }
}

/** Hapus langganan perangkat ini dari server saat logout (Issue 038 langkah 4). */
export async function unregisterDeviceSubscriptions(): Promise<void> {
  const endpoint = await currentEndpoint();
  if (!endpoint) return;
  await apiFetch('/push/subscriptions', { method: 'DELETE', body: { endpoint } }).catch(() => undefined);
}

/** Izin sudah granted tetapi server belum tahu langganan perangkat ini -> daftar ulang diam-diam. */
export async function resyncSubscriptionSilently(): Promise<void> {
  if (!pushSupported()) return;
  if (Notification.permission !== 'granted') return;
  const registration = await getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await apiFetch('/push/subscriptions', {
      method: 'POST',
      body: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh') ?? new ArrayBuffer(0)),
          auth: arrayBufferToBase64Url(subscription.getKey('auth') ?? new ArrayBuffer(0)),
        },
        userAgent: navigator.userAgent.slice(0, 255),
      },
    });
  } catch {
    /* diam: notifikasi bukan jalur kritis */
  }
}

export async function sendTestNotification(): Promise<{ sent: number; failed: number; totalSubscriptions: number }> {
  return apiFetch('/push/test', { method: 'POST', body: {} });
}
