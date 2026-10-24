/** UX pemasangan aplikasi (Issue 054). */
import { useCallback, useEffect, useState } from 'react';
import { useStandaloneMode } from './hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'swp_install_dismiss_at';
const THROTTLE_MS = 30 * 24 * 60 * 60 * 1000;

function readDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < THROTTLE_MS;
  } catch {
    return false;
  }
}

export type InstallChannel = 'chromium' | 'ios' | 'manual';

export interface InstallState {
  canPrompt: boolean;
  channel: InstallChannel;
  standalone: boolean;
  dismissed: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: () => void;
}

export function useInstall(): InstallState {
  const standalone = useStandaloneMode();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setDeferred(null);
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* abaikan */
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'dismissed') {
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setDismissed(true);
      } catch {
        /* abaikan */
      }
    }
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* abaikan */
    }
    setDismissed(true);
  }, []);

  return {
    canPrompt: deferred != null,
    channel: deferred ? 'chromium' : isIos ? 'ios' : 'manual',
    standalone,
    dismissed,
    install,
    dismiss,
  };
}
