import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
  sticky?: boolean;
}

interface ToastApi {
  push: (item: Omit<ToastItem, 'id'>) => number;
  success: (message: string, action?: ToastAction) => number;
  error: (message: string, action?: ToastAction) => number;
  info: (message: string, action?: ToastAction) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const AUTO_DISMISS_MS = 3500;

const STYLES: Record<ToastVariant, string> = {
  success: 'bg-[#14532D] text-white',
  error: 'bg-[#7F1D1D] text-white',
  info: 'bg-ink text-white',
};

/** Toast Radix-style manual (tanpa pustaka yang menyuntik <style> runtime — CSP, Issue 059). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((item: Omit<ToastItem, 'id'>) => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current.slice(-2), { ...item, id }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (message, action) => push({ message, variant: 'success', action }),
      error: (message, action) => push({ message, variant: 'error', action }),
      info: (message, action) => push({ message, variant: 'info', action }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label={t('notifications.region')}
        className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <ToastRow key={item.id} item={item} onDismiss={dismiss} autoHideMs={item.sticky ? 0 : AUTO_DISMISS_MS} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onDismiss, autoHideMs }: { item: ToastItem; onDismiss: (id: number) => void; autoHideMs: number }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (autoHideMs <= 0) return;
    const id = window.setTimeout(() => onDismiss(item.id), autoHideMs);
    return () => window.clearTimeout(id);
  }, [autoHideMs, item.id, onDismiss]);

  const Icon = item.variant === 'success' ? CheckCircle2 : item.variant === 'error' ? AlertTriangle : Info;

  return (
    <div className={`pointer-events-auto flex max-w-[520px] items-center gap-2 rounded-card px-3 py-2.5 shadow-raised ${STYLES[item.variant]}`}>
      <Icon aria-hidden="true" size={18} className="shrink-0" />
      <span className="text-label font-medium">{item.message}</span>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="ml-1 rounded border border-white/60 px-2 py-1 text-label font-semibold hover:bg-white/15"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={t('common.close')}
        className="ml-1 flex h-8 w-8 items-center justify-center rounded hover:bg-white/15"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return ctx;
}
