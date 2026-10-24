import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  'data-field'?: string;
}

export function Textarea({ invalid, className = '', rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`w-full rounded-card border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-muted focus:border-primary ${className}`}
      {...rest}
    />
  );
}
