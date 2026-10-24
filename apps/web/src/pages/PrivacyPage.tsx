import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../lib/hooks';

/** Kebijakan Privasi (Issue 060) — terbuka tanpa login, ditautkan dari login/register/pengaturan. */
export function PrivacyPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('privacy.title'));
  const sections = ['data', 'purpose', 'storage', 'sharing', 'rights'] as const;

  return (
    <main id="main" className="mx-auto flex min-h-[100vh] max-w-content flex-col gap-4 bg-bg px-4 py-8">
      <h1 className="text-h1 font-bold">{t('privacy.title')}</h1>
      <p className="text-label text-muted">{t('privacy.updated')}</p>
      <div className="card flex flex-col gap-4 p-4">
        {sections.map((key) => (
          <section key={key}>
            <h2 className="text-base font-semibold">{t(`privacy.${key}.heading`)}</h2>
            <p className="mt-1 text-body text-muted">{t(`privacy.${key}.body`)}</p>
          </section>
        ))}
      </div>
      <p>
        <Link to="/login" className="text-primary-dark underline">
          {t('privacy.back')}
        </Link>
      </p>
    </main>
  );
}
