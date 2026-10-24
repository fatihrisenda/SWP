import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { ConflictResultDto } from '../lib/dto';
import { fmtDateTime } from '../lib/format';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export interface ConflictDialogProps {
  result: ConflictResultDto;
  timezone: string;
  locale: string;
  busy?: boolean;
  /** Pesan bila pengecekan konflik gagal (jangan diam-diam menyimpan). */
  error?: string;
  /** Sudah berapa kali saran dipakai berturut-turut (maks 3, Issue 046). */
  recheckCount?: number;
  maxRechecksReached?: boolean;
  onRetry: () => void;
  onUseSuggestion: () => void;
  onAdjust: () => void;
  onDeleteLowPriority: () => void;
  onSaveAnyway: () => void;
}

/** Dialog konflik jadwal (Issue 046) — port dari `showConflict()` lama. */
export function ConflictDialog({
  result,
  timezone,
  locale,
  busy,
  error,
  maxRechecksReached,
  onRetry,
  onUseSuggestion,
  onAdjust,
  onDeleteLowPriority,
  onSaveAnyway,
}: ConflictDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal open onClose={onAdjust} title={t('conflicts.title')} testId="conflict-dialog" sticky>
      {error ? (
        <div role="alert" className="mb-3 flex flex-col gap-2 rounded-card bg-[#FEF2F2] p-3 text-label text-[#991B1B]">
          <p className="font-semibold">{error}</p>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {maxRechecksReached ? (
        <p role="status" className="mb-3 rounded-card bg-[#FFF7ED] p-3 text-label font-semibold text-[#9A3412]">
          {t('conflicts.maxRechecks')}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2" aria-label={t('conflicts.listLabel')}>
        {result.collisions.map((collision) => (
          <li key={`c-${collision.task.id}`} className="flex items-start gap-2 rounded-card border border-line p-2.5 text-label">
            <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-high" />
            <span className="break-words">
              {t('conflicts.collides', {
                title: collision.task.title,
                time: `${fmtDateTime(collision.start, timezone, locale)} – ${fmtDateTime(collision.end, timezone, locale)}`,
              })}
            </span>
          </li>
        ))}
        {result.buffers.map((buffer) => (
          <li key={`b-${buffer.task.id}`} className="flex items-start gap-2 rounded-card border border-line p-2.5 text-label">
            <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-warn" />
            <span className="break-words">
              {t('conflicts.tightGap', { title: buffer.task.title, minutes: buffer.gapMinutes })}
            </span>
          </li>
        ))}
        {result.overload.map((load) => (
          <li key={`o-${load.dayStart}`} className="flex items-start gap-2 rounded-card border border-line p-2.5 text-label">
            <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-warn" />
            <span className="break-words">{t('conflicts.overload', { day: fmtDateTime(load.dayStart, timezone, locale), hours: load.hours })}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        {result.suggestedSlot ? (
          <Button
            block
            disabled={busy}
            loading={busy}
            onClick={onUseSuggestion}
          >
            {t('conflicts.useSuggestion', {
              time: fmtDateTime(result.suggestedSlot.start, timezone, locale),
            })}
          </Button>
        ) : null}
        <Button block variant="secondary" disabled={busy} onClick={onAdjust}>
          {t('conflicts.adjust')}
        </Button>
        {result.lowPriorityCandidate ? (
          <Button block variant="danger" disabled={busy} onClick={onDeleteLowPriority}>
            {t('conflicts.deleteLow', {
              title: result.lowPriorityCandidate.title,
              label: t(`priority.${result.lowPriorityCandidate.priority.label}`),
            })}
          </Button>
        ) : null}
        <Button block variant="ghost" disabled={busy} onClick={onSaveAnyway}>
          {t('conflicts.saveAnyway')}
        </Button>
      </div>
    </Modal>
  );
}
