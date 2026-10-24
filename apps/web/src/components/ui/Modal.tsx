import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBackToClose } from '../../lib/hooks';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** `sticky` = klik latar tidak menutup (masih bisa Esc/Back/tombol tutup). */
  sticky?: boolean;
  size?: 'md' | 'lg' | 'sheet';
  /** `alertdialog` untuk konfirmasi destruktif. */
  role?: 'dialog' | 'alertdialog';
  testId?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/**
 * Dialog aksesibel (Issue 040 langkah 1): bottom-sheet di < 768 px, dialog tengah di >= 768 px,
 * fokus terjebak, Esc & Back menutup, fokus kembali ke pemicu, scroll latar dikunci.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  sticky,
  size = 'md',
  role = 'dialog',
  testId,
}: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const [mounted, setMounted] = useState(false);
  const { closeAndSyncHistory } = useBackToClose(open, onClose);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      const active = previouslyFocused.current;
      if (active instanceof HTMLElement && document.contains(active)) active.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndSyncHistory();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, mounted, closeAndSyncHistory]);

  if (!open || typeof document === 'undefined') return null;

  const width = size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (!sticky && event.target === event.currentTarget) closeAndSyncHistory();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={`${testId ?? 'swp-modal'}-title`}
        aria-describedby={description ? `${testId ?? 'swp-modal'}-desc` : undefined}
        tabIndex={-1}
        data-testid={testId}
        className={`card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-4 shadow-raised sm:rounded-card sm:p-5 ${width}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id={`${testId ?? 'swp-modal'}-title`} className="text-h2 font-bold">
              {title}
            </h2>
            {description ? (
              <p id={`${testId ?? 'swp-modal'}-desc`} className="mt-1 text-label text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={closeAndSyncHistory}
            aria-label={t('common.close')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card text-muted hover:bg-primary-xl hover:text-primary-dark"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
