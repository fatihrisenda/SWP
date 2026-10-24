import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { loginSchema } from '@swp/shared';
import { ApiError, apiFetch, isNetworkError } from '../lib/api';
import { homeForRole, safeInternalPath, useAuth } from '../lib/auth';
import type { UserDto } from '../lib/dto';
import { useDocumentTitle } from '../lib/hooks';
import { messageForField, zodFieldErrors, type FieldErrors } from '../lib/validation';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';

/** UISW01 Login (Issue 041). */
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { announceLogin } = useAuth();
  useDocumentTitle(t('auth.login.title'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const parsed = loginSchema.safeParse({ email, password, remember });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues));
      return false;
    }
    setErrors({});
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    setBanner(undefined);
    try {
      const { user } = await apiFetch<{ user: UserDto }>('/auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password, remember },
      });
      announceLogin(user);
      toast.success(t('auth.login.success'));
      const from = safeInternalPath(new URLSearchParams(location.search).get('from'));
      navigate(from ?? homeForRole(user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS' || err.status === 401) setBanner(t('auth.login.invalid'));
        else if (err.status === 429) {
          const minutes = Math.max(1, Math.ceil((err.retryAfterSeconds ?? 60) / 60));
          setBanner(t('auth.login.rateLimited', { minutes }));
        } else setBanner(err.message);
      } else if (isNetworkError(err)) {
        setBanner(t('errors.network'));
      } else {
        setBanner(t('errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main" className="flex min-h-[100vh] items-center justify-center bg-gradient-to-b from-primary-xl to-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-card bg-primary-dark shadow-card">
            <GraduationCap aria-hidden="true" size={34} className="text-white" />
          </span>
          <h1 className="text-h1 font-bold">{t('app.name')}</h1>
          <p className="text-label text-muted">{t('auth.login.subtitle')}</p>
        </div>

        <form
          className="card flex flex-col gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          {banner ? (
            <p role="alert" className="rounded-card bg-[#FEF2F2] p-3 text-label font-semibold text-[#991B1B]">
              {banner}
            </p>
          ) : null}

          <Field label={t('auth.email')} htmlFor="login-email" required error={messageForField(errors, 'email', t)}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder={t('auth.emailPlaceholder')}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => validate()}
              />
            )}
          </Field>

          <Field label={t('auth.password')} htmlFor="login-password" required error={messageForField(errors, 'password', t)}>
            {({ id, invalid, describedBy }) => (
              <PasswordInput
                id={id}
                autoComplete="current-password"
                placeholder={t('auth.login.passwordPlaceholder')}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => validate()}
              />
            )}
          </Field>

          <Checkbox id="remember" label={t('auth.remember')} checked={remember} onChange={(event) => setRemember(event.target.checked)} />

          <Button type="submit" block loading={busy} disabled={busy}>
            {t('auth.login.button')}
          </Button>

          <p className="text-center text-label text-muted">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="font-semibold text-primary-dark underline">
              {t('auth.register.button')}
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
