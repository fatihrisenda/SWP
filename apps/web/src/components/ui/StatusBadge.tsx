import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@swp/shared';

const STYLES: Record<TaskStatus, string> = {
  TODO: 'bg-bg text-muted border border-line',
  IN_PROGRESS: 'bg-primary-light text-primary-dark',
  DONE: 'bg-[#DCFCE7] text-[#14532D]',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();
  return <span className={`badge ${STYLES[status]}`}>{t(`tasks.status.${status}`)}</span>;
}
