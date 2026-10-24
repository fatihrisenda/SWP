import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  'data-field'?: string;
}

/** `select` native — pilihan paling kompatibel & aksesibel di browser batas bawah (D-16). */
export function Select({ invalid, className = '', children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={`min-h-touch w-full appearance-none rounded-card border border-line bg-white px-3 pr-10 text-base text-ink focus:border-primary ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}
