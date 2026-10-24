import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

export interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** Input password dengan tombol lihat/sembunyikan yang aksesibel (D-26). */
export function PasswordInput({ invalid, className = '', id, ...rest }: PasswordInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={`min-h-touch w-full rounded-card border border-line bg-white px-3 pr-12 text-base text-ink placeholder:text-muted focus:border-primary ${className}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-pressed={visible}
        aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
        className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-card text-muted hover:bg-primary-xl hover:text-primary-dark"
      >
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
