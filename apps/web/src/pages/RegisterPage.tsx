import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { registerSchema } from '@swp/shared';
import { ApiError, apiFetch, isNetworkError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { UserDto } from '../lib/dto';
import { useDocumentTitle } from '../lib/hooks';
import { messageForField, serverFieldErrors, zodFieldErrors, type FieldErrors } from '../lib/validation';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';

/** Kekuatan password: indikator non-blokir (Issue 042). */
export function passwordStrength(value: string): 0 | 1 | 2 | 3 {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  return (score <= 0 ? 0 : score === 1 ? 1 : score === 2 ? 2 : 3) as 0 | 1 | 2 | 3;
}

/** UISW02 Register (Issue 042, D-01). */
export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { announceLogin } = useAuth();
  useDocumentTitle(t('auth.register.title'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const detectTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
    } catch {
      return 'Asia/Jakarta';
    }
  };

  const validate = (): boolean => {
    const parsed = registerSchema.safeParse({ name, email, password, confirmPassword });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues));
      return false;
    }
    setErrors({});
    return true;
  };

  const submit = async () => {
    if (busy || !validate()) return;
    setBusy(true);
    setBanner(undefined);
    try {
      const { user } = await apiFetch<{ user: UserDto }>('/auth/register', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim().toLowerCase(), password, confirmPassword, timezone: detectTimezone() },
      });
      announceLogin(user);
      toast.success(t('auth.register.success'));
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_TAKEN') setErrors({ email: 'auth.errors.emailTaken' });
        else if (err.fields) setErrors(serverFieldErrors(err.fields));
        else if (err.status === 429) setBanner(t('auth.register.rateLimited'));
        else setBanner(err.message);
      } else if (isNetworkError(err)) setBanner(t('errors.network'));
      else setBanner(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const strength = passwordStrength(password);

  return (
    <main id="main" className="flex min-h-[100vh] items-center justify-center bg-gradient-to-b from-primary-xl to-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-card bg-primary-dark shadow-card">
            <GraduationCap aria-hidden="true" size={34} className="text-white" />
          </span>
          <h1 className="text-h1 font-bold">{t('auth.register.title')}</h1>
        </div>

        <form
          className="card flex flex-col gap-4 p-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {banner ? (
            <p role="alert" className="rounded-card bg-[#FEF2F2] p-3 text-label font-semibold text-[#991B1B]">
              {banner}
            </p>
          ) : null}

          <Field label={t('auth.name')} htmlFor="register-name" required error={messageForField(errors, 'name', t)}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                autoComplete="name"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={validate}
              />
            )}
          </Field>

          <Field label={t('auth.email')} htmlFor="register-email" required error={messageForField(errors, 'email', t)}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={validate}
              />
            )}
          </Field>

          <Field
            label={t('auth.password')}
            htmlFor="register-password"
            required
            error={messageForField(errors, 'password', t)}
            hint={t('auth.register.passwordPlaceholder')}
            labelAccessory={
              password ? (
                <span className="text-badge font-semibold text-muted">{t(`auth.register.strength.${strength}`)}</span>
              ) : null
            }
          >
            {({ id, invalid, describedBy }) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                placeholder={t('auth.register.passwordPlaceholder')}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={validate}
              />
            )}
          </Field>

          <Field
            label={t('auth.register.confirmPassword')}
            htmlFor="register-confirm"
            required
            error={messageForField(errors, 'confirmPassword', t)}
          >
            {({ id, invalid, describedBy }) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={confirmPassword}
                onChange={(event) => setConfirm(event.target.value)}
                onBlur={validate}
              />
            )}
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate('/login')} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1" loading={busy} disabled={busy}>
              {t('auth.register.button')}
            </Button>
          </div>

          <p className="text-center text-label text-muted">
            {t('auth.register.hasAccount')}{' '}
            <Link to="/login" className="font-semibold text-primary-dark underline">
              {t('auth.register.loginLink')}
            </Link>
          </p>
          <p className="text-center text-badge">
            <Link to="/privasi" className="text-muted underline">
              {t('privacy.link')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
