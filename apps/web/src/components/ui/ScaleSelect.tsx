import { useTranslation } from 'react-i18next';
import { Field } from './Field';
import { Select } from './Select';

export type ScaleKind = 'importance' | 'difficulty';

export interface ScaleSelectProps {
  kind: ScaleKind;
  value: number;
  onChange: (value: number) => void;
  label: string;
  error?: string;
  id: string;
}

/** Dropdown 1-5 berlabel (D-06): "3 - Sedang", "3 - Cukup Penting". */
export function ScaleSelect({ kind, value, onChange, label, error, id }: ScaleSelectProps) {
  const { t } = useTranslation();
  return (
    <Field label={label} htmlFor={id} error={error} required>
      {({ id: inputId, describedBy, invalid }) => (
        <Select
          id={inputId}
          aria-describedby={describedBy}
          invalid={invalid}
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={String(level)}>
              {t(`scale.${kind}.${level}`)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
