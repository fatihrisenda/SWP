import { useTranslation } from 'react-i18next';

const EMOJI: Record<number, string> = { 5: '😄', 4: '🙂', 3: '😐', 2: '😟', 1: '😢' };
const ORDER = [5, 4, 3, 2, 1];

export interface MoodPickerProps {
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
  /** `compact` dipakai di kartu dashboard (tanpa legenda besar). */
  compact?: boolean;
}

/** Input mood: 5 tombol emoji urut Sangat Baik -> Sangat Buruk, `role="radiogroup"` + label teks (Issue 047). */
export function MoodPicker({ value, onChange, disabled, compact }: MoodPickerProps) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t('rec.moodQuestion')}
      className={`flex gap-2 ${compact ? '' : 'flex-wrap justify-between'}`}
    >
      {ORDER.map((level) => {
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`mood.label.${level}`)}
            disabled={disabled}
            onClick={() => onChange(level)}
            className={`flex min-h-touch flex-1 flex-col items-center justify-center gap-1 rounded-card border-2 px-1 py-2 transition-colors disabled:opacity-50 ${
              selected ? 'border-primary-dark bg-primary-light' : 'border-line bg-white hover:bg-primary-xl'
            }`}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {EMOJI[level]}
            </span>
            <span className="text-badge font-semibold">{t(`mood.short.${level}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MoodEmoji({ level }: { level: number }) {
  return <span aria-hidden="true">{EMOJI[level] ?? '😐'}</span>;
}
