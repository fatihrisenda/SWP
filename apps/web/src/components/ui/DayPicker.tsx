import { useTranslation } from 'react-i18next';

export interface DayPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
  error?: string;
  legend: string;
}

const ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

/** Tujuh checkbox Senin-Minggu (ISO 1=Senin) dalam satu grup berlabel (Issue 035). */
export function DayPicker({ value, onChange, error, legend }: DayPickerProps) {
  const { t } = useTranslation();

  const toggle = (day: number) => {
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? 'day-picker-error' : undefined}>
      <legend className="text-label font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((day) => {
          const checked = value.includes(day);
          return (
            <label
              key={day}
              className={`flex min-h-touch cursor-pointer items-center gap-1.5 rounded-pill border px-3 text-label font-semibold ${
                checked ? 'border-primary-dark bg-primary-light text-primary-dark' : 'border-line bg-white text-ink'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(day)}
                className="h-4 w-4 accent-[#1D4ED8]"
                aria-label={t(`time.days.long${day}`)}
              />
              <span aria-hidden="true">{t(`time.days.short${day}`)}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id="day-picker-error" role="alert" className="text-label font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
