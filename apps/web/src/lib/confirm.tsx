import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

export interface ConfirmOptions {
  title: string;
  text: string;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Pengganti `window.confirm()` (Issue 040 langkah 2) — dialog aksesibel, bisa dittest. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);
  const lastFocus = useRef<Element | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        lastFocus.current = document.activeElement;
        setState({ options, resolve });
      }),
    [],
  );

  const settle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
    if (lastFocus.current instanceof HTMLElement && document.contains(lastFocus.current)) lastFocus.current.focus();
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state ? (
        <Modal
          open
          role="alertdialog"
          sticky
          size="md"
          testId="confirm-dialog"
          title={state.options.title}
          onClose={() => settle(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => settle(false)}>
                {state.options.cancelLabel ?? t('common.cancel')}
              </Button>
              <Button variant={state.options.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {state.options.okLabel ?? t('common.confirm')}
              </Button>
            </>
          }
        >
          <p className="break-words text-base">{state.options.text}</p>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm harus dipakai di dalam ConfirmProvider');
  return ctx;
}
