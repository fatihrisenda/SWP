import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  'data-field'?: string;
}

const BASE =
  'min-h-touch w-full rounded-card border border-line bg-white px-3 text-base text-ink placeholder:text-muted focus:border-primary disabled:bg-bg';

export function Input({ invalid, className = '', ...rest }: InputProps) {
  return <input aria-invalid={invalid || undefined} className={`${BASE} ${className}`} {...rest} />;
}
