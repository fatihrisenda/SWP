import { Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@swp/shared';

export interface TriStateCheckboxProps {
  status: TaskStatus;
  onChange: (next: TaskStatus) => void;
  /** Judul tugas untuk label yang dibacakan pembaca layar. */
  taskTitle: string;
}

/**
 * Checkbox tri-state (D-07 / UC #3): TODO -> IN_PROGRESS -> DONE -> TODO.
 * `role="checkbox"` + `aria-checked="mixed"` agar status dibacakan ("belum", "sedang", "selesai").
 */
export function TriStateCheckbox({ status, onChange, taskTitle }: TriStateCheckboxProps) {
  const { t } = useTranslation();
  const ariaChecked = status === 'DONE' ? 'true' : status === 'IN_PROGRESS' ? 'mixed' : 'false';

  const cycle = () => {
    const next: TaskStatus = status === 'TODO' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
    onChange(next);
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaChecked}
      aria-label={t('tasks.statusLabel', { title: taskTitle, status: t(`tasks.status.${status}`) })}
      onClick={cycle}
      title={t('tasks.triState.hint')}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card border-2 border-primary text-primary-dark transition-colors hover:bg-primary-xl"
    >
      {status === 'DONE' ? (
        <Check size={22} aria-hidden="true" />
      ) : status === 'IN_PROGRESS' ? (
        <Minus size={22} aria-hidden="true" />
      ) : null}
    </button>
  );
}
