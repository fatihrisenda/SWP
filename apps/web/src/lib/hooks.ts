/** Hook util umum (Issue 037 langkah 7, 040 langkah 4, 051). */
import { useEffect, useRef, useState } from 'react';

/** Memperbarui "waktu sekarang" tanpa refetch (teks relatif "2 hari lagi"). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · StudyWork Planner` : 'StudyWork Planner';
  }, [title]);
}

/** Scroll ke atas saat pindah rute (Issue 036). */
export function useScrollTopOnRouteChange(pathname: string): void {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Tombol Back (fisik Android / gesture / browser) menutup dialog, bukan meninggalkan halaman
 * (Issue 040 langkah 4). Saat ditutup manual -> history.back() agar riwayat bersih.
 */
export function useBackToClose(open: boolean, onClose: () => void): { closeAndSyncHistory: () => void } {
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ swpDialog: true }, '');
    const onPop = () => {
      // Popstate dari `closeAndSyncHistory()` sudah memanggil onClose sendiri.
      if (closingRef.current) return;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [open]);

  return {
    closeAndSyncHistory: () => {
      closingRef.current = true;
      window.history.back();
      onCloseRef.current();
      window.setTimeout(() => {
        closingRef.current = false;
      }, 250);
    },
  };
}

export function useIsDesktop(breakpointPx = 768): boolean {
  const query = `(min-width: ${breakpointPx}px)`;
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function useStandaloneMode(): boolean {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const m = window.matchMedia('(display-mode: standalone)');
    setStandalone(m.matches || nav.standalone === true);
    const handler = (event: MediaQueryListEvent) => setStandalone(event.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, []);
  return standalone;
}
