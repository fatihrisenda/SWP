import { useTranslation } from 'react-i18next';
import { Download, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useInstall, type InstallChannel } from '../lib/install';
import { useToast } from './Toast';

/** Tombol "Pasang Aplikasi" + sheet instruksi iOS/manual (Issue 054). */
export function InstallButton({ variant = 'secondary', block = false }: { variant?: 'primary' | 'secondary' | 'ghost'; block?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const install = useInstall();
  const [showSheet, setShowSheet] = useState(false);

  // Sudah terpasang -> tidak ada ajakan sama sekali (AC 054 d).
  if (install.standalone) return null;

  const onClick = async () => {
    if (install.canPrompt) {
      const outcome = await install.install();
      if (outcome === 'accepted') toast.success(t('install.installed'));
      return;
    }
    setShowSheet(true);
  };

  return (
    <>
      <Button variant={variant} block={block} icon={<Download aria-hidden="true" size={18} />} onClick={() => void onClick()}>
        {t('install.button')}
      </Button>
      {showSheet ? (
        <InstallSheet channel={install.channel} onClose={() => setShowSheet(false)} />
      ) : null}
    </>
  );
}

export function InstallSheet({ channel, onClose }: { channel: InstallChannel; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open onClose={onClose} title={t('install.sheetTitle')} testId="install-sheet">
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-base">
        {channel === 'ios' ? (
          <>
            <li>{t('install.ios.step1')}</li>
            <li>{t('install.ios.step2')}</li>
            <li>{t('install.ios.step3')}</li>
          </>
        ) : (
          <>
            <li>{t('install.other.step1')}</li>
            <li>{t('install.other.step2')}</li>
          </>
        )}
      </ol>
      {channel === 'ios' ? (
        <p className="mt-3 flex items-start gap-2 rounded-card bg-primary-xl p-3 text-label text-primary-dark">
          <Smartphone aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          {t('install.ios.pushNote')}
        </p>
      ) : null}
    </Modal>
  );
}

/** Ajakan halus sekali per 30 hari, hanya setelah >= 1 tugas (Issue 054 langkah 5). */
export function InstallNudge() {
  const { t } = useTranslation();
  const install = useInstall();

  if (install.standalone || install.dismissed || !install.canPrompt) return null;

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-3" role="note">
      <p className="text-label text-muted">{t('install.nudge')}</p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={install.dismiss}>
          {t('install.nudgeDismiss')}
        </Button>
        <Button size="sm" onClick={() => void install.install()}>
          {t('install.button')}
        </Button>
      </div>
    </div>
  );
}
