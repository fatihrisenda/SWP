import type { InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Checkbox({ label, id, className = '', ...rest }: CheckboxProps) {
  return (
    <label htmlFor={id} className={`flex min-h-touch cursor-pointer items-center gap-2 text-base ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="h-5 w-5 shrink-0 rounded border-line accent-[#1D4ED8]"
        aria-describedby={rest['aria-describedby']}
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}
