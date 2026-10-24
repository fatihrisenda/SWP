import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation();
  const text = label ?? t('common.loading');
  return (
    <span role="status" className="inline-flex items-center gap-2 text-label text-muted">
      <Loader2 aria-hidden="true" size={18} className="animate-spin" />
      <span>{text}</span>
    </span>
  );
}
