import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface DropdownItem {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export interface DropdownMenuProps {
  items: DropdownItem[];
  /** Nama item yang dioperasikannya, untuk `aria-label` (Issue 040 langkah 5). */
  label: string;
}

/** Menu kebab (Edit/Hapus) yang bisa dioperasikan keyboard. */
export function DropdownMenu({ items, label }: DropdownMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>, direction: 1 | -1) => {
    if (!open) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    if (buttons.length === 0) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (current + direction + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === 'ArrowDown') moveFocus(event, 1);
        if (event.key === 'ArrowUp') moveFocus(event, -1);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('categories.actionsFor', { name: label })}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-11 w-11 items-center justify-center rounded-card border border-line bg-white text-muted hover:bg-primary-xl hover:text-primary-dark"
      >
        <MoreVertical aria-hidden="true" size={18} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t('categories.actionsFor', { name: label })}
          className="absolute right-0 top-12 z-30 w-44 overflow-hidden rounded-card border border-line bg-white py-1 shadow-raised"
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center px-4 py-3 text-left text-base hover:bg-primary-xl ${
                item.danger ? 'font-semibold text-danger' : 'text-ink'
              }`}
            >
              {item.label as ReactNode}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
