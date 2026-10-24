import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../lib/hooks';
import { EmptyState } from '../components/ui/EmptyState';

/** Halaman 404 (Issue 051 langkah 2) — URL ngawur tidak boleh menghasilkan layar putih. */
export function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('notFound.title'));
  return (
    <main id="main" className="flex min-h-[100vh] items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-md">
        <EmptyState
          icon={Compass}
          title={t('notFound.title')}
          description={t('notFound.body')}
          action={
            <Link
              to="/"
              className="inline-flex min-h-touch items-center rounded-card bg-primary-dark px-4 font-semibold text-white"
            >
              {t('notFound.home')}
            </Link>
          }
        />
      </div>
    </main>
  );
}
