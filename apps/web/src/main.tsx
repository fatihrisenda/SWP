import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/Toast';
import { AuthProvider } from './lib/auth';
import { ConfirmProvider } from './lib/confirm';
import { initI18n } from './lib/i18n';
import { createQueryClient } from './lib/queryClient';

const queryClient = createQueryClient();
initI18n();

/**
 * Pembaruan aplikasi (Issue 056): tawarkan reload, jangan pernah memuat ulang sendiri
 * karena form tugas bisa sedang diisi. Cek berkala saat fokus + tiap 60 menit.
 */
function ServiceWorkerUpdates() {
  const { t } = useTranslation();
  const toast = useToast();
  const waitingRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const offeredRef = useRef(false);

  useEffect(() => {
    const reloadUpdate = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (offeredRef.current) return;
        offeredRef.current = true;
        toast.push({
          variant: 'info',
          sticky: true,
          message: t('update.available'),
          action: {
            label: t('update.reload'),
            onClick: () => {
              waitingRef.current?.postMessage({ type: 'SKIP_WAITING' });
              void reloadUpdate();
            },
          },
        });
      },
      onOfflineReady() {
        toast.success(t('update.offlineReady'));
      },
      onRegisteredSW(_url, registration) {
        registrationRef.current = registration ?? null;
        if (!registration) return;
        waitingRef.current = registration.waiting;
        registration.installing?.addEventListener('statechange', () => {
          waitingRef.current = registration.waiting;
        });
      },
      onRegisterError(error) {
        console.error('[swp] service worker gagal terdaftar', error);
      },
    });

    const check = (): void => void registrationRef.current?.update().catch(() => undefined);
    const interval = window.setInterval(check, 60 * 60_000);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', check);
    };
  }, [toast, t]);

  return null;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemen #root tidak ada di index.html');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <AuthProvider>
                <ServiceWorkerUpdates />
                <App />
              </AuthProvider>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
