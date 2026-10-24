import { useTranslation } from 'react-i18next';
import { CATEGORY_PALETTE } from '@swp/shared';
import { Field } from './Field';

export interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  error?: string;
  id: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHex(raw: string): string {
  const candidate = raw.startsWith('#') ? raw : `#${raw}`;
  return HEX.test(candidate) ? candidate.toUpperCase() : '';
}

/** 12 swatch palet + input `type=color`/teks hex, selalu dinormalkan ke `#RRGGBB` (Issue 035/048). */
export function ColorPicker({ value, onChange, error, id }: ColorPickerProps) {
  const { t } = useTranslation();

  return (
    <Field label={t('categories.color')} htmlFor={id} error={error} required>
      {({ id: inputId, describedBy, invalid }) => (
        <div className="flex flex-col gap-3">
          <div role="group" aria-label={t('categories.palette')} className="flex flex-wrap gap-2">
            {CATEGORY_PALETTE.map((color) => {
              const selected = color.toUpperCase() === value.toUpperCase();
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange(color.toUpperCase())}
                  aria-pressed={selected}
                  aria-label={t('categories.pickColor', { color })}
                  className={`h-9 w-9 rounded-pill border-2 ${selected ? 'border-ink' : 'border-line'}`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={inputId}
              type="color"
              aria-describedby={describedBy}
              aria-label={t('categories.colorCustom')}
              value={HEX.test(value) ? value : '#2563EB'}
              onChange={(event) => onChange(normalizeHex(event.target.value) || event.target.value.toUpperCase())}
              className="h-11 w-11 cursor-pointer rounded-card border border-line bg-white p-1"
            />
            <input
              type="text"
              inputMode="text"
              maxLength={7}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              aria-label={t('categories.colorHex')}
              value={value}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              onBlur={(event) => {
                const normalized = normalizeHex(event.target.value);
                if (normalized) onChange(normalized);
              }}
              className="min-h-touch w-32 rounded-card border border-line bg-white px-3 text-base uppercase focus:border-primary"
            />
          </div>
        </div>
      )}
    </Field>
  );
}
