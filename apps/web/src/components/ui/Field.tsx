import { useId } from 'react';
import type { ReactNode } from 'react';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Konten tambahan di baris label (mis. penghitung karakter). */
  labelAccessory?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label + hint + error dengan `aria-describedby` / `aria-invalid` (Issue 035). */
export function Field({ label, htmlFor, hint, error, required, labelAccessory, children }: FieldProps) {
  const autoId = useId();
  const id = htmlFor || autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined].filter((v): v is string => Boolean(v)).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-label font-semibold text-ink">
        <span>
          {label}
          {required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
        </span>
        {labelAccessory}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-label text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-label font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
