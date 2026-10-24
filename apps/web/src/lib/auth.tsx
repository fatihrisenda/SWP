/** State autentikasi + route guard (Issue 038). Sesi = cookie HttpOnly; tidak ada token di JS. */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Role } from '@swp/shared';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, UNAUTHORIZED_EVENT } from './api';
import { useMe } from './queries';
import { qk } from './keys';
import { clearDraft } from './draft';
import { resyncSubscriptionSilently, unregisterDeviceSubscriptions } from './push';
import { applyDocumentLang, getI18n } from './i18n';
import type { UserDto } from './dto';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: UserDto | null;
  status: AuthStatus;
  signOut: () => Promise<void>;
  announceLogin: (user: UserDto) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_CHANNEL = 'swp-auth';

/** Hanya terima path internal: diawali satu `/`, bukan `//` dan tanpa skema (anti open redirect). */
export function safeInternalPath(from: string | null | undefined): string | undefined {
  if (!from) return undefined;
  if (!from.startsWith('/')) return undefined;
  if (from.startsWith('//')) return undefined;
  if (/^\/\\\//.test(from)) return undefined;
  if (/^[a-z][a-z\d+\-.]*:/i.test(from.slice(1))) return undefined;
  try {
    const url = new URL(from, 'http://internal.invalid');
    if (url.origin !== 'http://internal.invalid') return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export function homeForRole(role: Role | undefined): string {
  return role === 'SUPERADMIN' ? '/admin' : '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const me = useMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const user = me.data ?? null;
  const status: AuthStatus = me.isLoading ? 'loading' : user ? 'authenticated' : 'anonymous';

  // Bahasa: `user.locale` menang atas localStorage/navigator (D-25).
  useEffect(() => {
    if (!user) return;
    const i18n = getI18n();
    if (i18n.language !== user.locale) {
      void i18n.changeLanguage(user.locale).then(() => applyDocumentLang(user.locale));
    }
  }, [user]);

  // 401 dari mana pun -> bersihkan cache & arahkan ke /login satu kali (Issue 037 langkah 2).
  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.clear();
      const target = location.pathname.startsWith('/login') ? '/login' : `/login?from=${encodeURIComponent(location.pathname + location.search)}`;
      navigate(target, { replace: true });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient, navigate, location.pathname, location.search]);

  // Sinkron lintas tab (Issue 038 langkah 5).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'LOGOUT') {
        queryClient.clear();
        navigate('/login', { replace: true });
      } else if (event.data?.type === 'LOGIN') {
        void queryClient.invalidateQueries({ queryKey: qk.me });
      }
    };
    return () => channel.close();
  }, [queryClient, navigate]);

  // Setelah boot dengan sesi aktif: pastikan langganan push perangkat ini terdaftar (Issue 055 langkah 6).
  useEffect(() => {
    if (!user) return;
    void resyncSubscriptionSilently().catch(() => undefined);
  }, [user]);

  const announceLogin = useCallback(
    (nextUser: UserDto) => {
      queryClient.setQueryData(qk.me, nextUser);
      if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel(AUTH_CHANNEL).postMessage({ type: 'LOGIN' });
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await unregisterDeviceSubscriptions().catch(() => undefined);
    await apiFetch<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearDraft(user?.id);
    queryClient.clear();
    if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel(AUTH_CHANNEL).postMessage({ type: 'LOGOUT' });
    navigate('/login', { replace: true });
    // Toast dikirim oleh pemanggil (drawer / sidebar / pengaturan) agar urutan jelas.
  }, [queryClient, navigate, user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, signOut, announceLogin }),
    [user, status, signOut, announceLogin],
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 bg-bg">
        <span className="flex h-16 w-16 items-center justify-center rounded-card bg-primary-dark">
          <GraduationCap aria-hidden="true" size={34} className="text-white" />
        </span>
        <p className="text-h2 font-bold text-ink">{t('app.name')}</p>
        <p role="status" className="text-label text-muted">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return null;
  if (!user) {
    const from = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?from=${from}`} replace />;
  }
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return null;
  if (user) {
    const from = safeInternalPath(new URLSearchParams(location.search).get('from'));
    return <Navigate to={from ?? homeForRole(user.role)} replace />;
  }
  return <>{children}</>;
}
