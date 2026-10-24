import { useTranslation } from 'react-i18next';
import { Field } from './Field';

export interface DateTimeFieldProps {
  label: string;
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  error?: string;
  hint?: string;
  idBase: string;
  /** Batas bawah/atas untuk tanggal (YYYY-MM-DD) — opsional. */
  minDate?: string;
}

/**
 * Gabungan `type=date` + `type=time` (D-36): `datetime-local` tidak tersedia di Firefox < 93,
 * sedangkan batas bawah proyek adalah Firefox 88.
 */
export function DateTimeField({ label, date, time, onChange, error, hint, idBase, minDate }: DateTimeFieldProps) {
  const { t } = useTranslation();
  return (
    <Field label={label} htmlFor={`${idBase}-date`} error={error} hint={hint} required>
      {({ describedBy, invalid }) => (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${idBase}-date`}
            type="date"
            inputMode="numeric"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label={t('tasks.form.dateLabel', { label })}
            value={date}
            min={minDate}
            onChange={(event) => onChange({ date: event.target.value, time })}
            className="min-h-touch w-full rounded-card border border-line bg-white px-3 text-base focus:border-primary sm:w-[58%]"
          />
          <input
            id={`${idBase}-time`}
            type="time"
            inputMode="numeric"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label={t('tasks.form.timeLabel', { label })}
            value={time}
            onChange={(event) => onChange({ date, time: event.target.value })}
            className="min-h-touch w-full rounded-card border border-line bg-white px-3 text-base focus:border-primary sm:w-[38%]"
          />
        </div>
      )}
    </Field>
  );
}
