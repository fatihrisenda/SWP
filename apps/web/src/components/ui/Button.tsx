import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-dark text-white hover:bg-primary active:bg-primary-dark disabled:bg-primary/50',
  secondary: 'bg-white text-primary-dark border border-primary hover:bg-primary-xl disabled:text-muted',
  danger: 'bg-danger text-white hover:bg-red-700 disabled:bg-danger/50',
  ghost: 'bg-transparent text-ink hover:bg-primary-xl disabled:text-muted',
};

/** Tombol aksesibel, target sentuh >= 44 px, state `loading` dengan label yang dibacakan. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-card font-semibold transition-colors ${
        size === 'sm' ? 'px-3 text-label' : 'px-4 text-base'
      } ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden="true" size={18} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
