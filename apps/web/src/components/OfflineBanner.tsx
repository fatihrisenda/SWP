import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../lib/hooks';

/** Banner offline (Issue 051 langkah 3, D-17): hilang otomatis saat `online`. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-40 bg-warn px-4 py-2 text-label font-semibold text-white">
      <span className="flex items-center justify-center gap-2">
        <WifiOff aria-hidden="true" size={16} />
        {t('offline.banner')}
      </span>
    </div>
  );
}
