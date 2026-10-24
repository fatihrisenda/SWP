/** Layout responsif mobile-first (Issue 036): TopBar+BottomNav+Drawer < 1024 px, sidebar kiri >= 1024 px. */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BrainCircuit,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Tags,
  User,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Role } from '@swp/shared';
import { useAuth } from '../lib/auth';
import { useConfirm } from '../lib/confirm';
import { useDocumentTitle, useScrollTopOnRouteChange } from '../lib/hooks';
import { changeLanguage } from '../lib/i18n';
import { useUpdateMe } from '../lib/mutations';
import { OfflineBanner } from './OfflineBanner';
import { InstallButton } from './InstallPrompt';
import { useToast } from './Toast';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

interface NavEntry {
  to: string;
  labelKey: string;
  icon: typeof Home;
  roles: Role[];
  bottom?: boolean;
}

const NAV: NavEntry[] = [
  { to: '/', labelKey: 'nav.home', icon: Home, roles: ['MAHASISWA'], bottom: true },
  { to: '/tugas-kuliah', labelKey: 'nav.kuliah', icon: GraduationCap, roles: ['MAHASISWA'], bottom: true },
  { to: '/tugas-pribadi', labelKey: 'nav.pribadi', icon: User, roles: ['MAHASISWA'], bottom: true },
  { to: '/ai', labelKey: 'nav.ai', icon: BrainCircuit, roles: ['MAHASISWA'], bottom: true },
  { to: '/kategori', labelKey: 'nav.categories', icon: Tags, roles: ['MAHASISWA'], bottom: true },
  { to: '/admin', labelKey: 'nav.admin', icon: LayoutDashboard, roles: ['SUPERADMIN'], bottom: true },
  { to: '/pengaturan', labelKey: 'nav.settings', icon: Settings, roles: ['MAHASISWA', 'SUPERADMIN'] },
];

export function AppLayout({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useScrollTopOnRouteChange(location.pathname);
  useDocumentTitle(t(titleKey));

  const entries = NAV.filter((entry) => user && entry.roles.includes(user.role));
  const bottomEntries = entries.filter((entry) => entry.bottom);

  return (
    <div className="flex min-h-[100vh] flex-col lg:flex-row">
      <a href="#main" className="skip-link">
        {t('layout.skip')}
      </a>
      <Sidebar entries={entries} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={t(titleKey)} onOpenDrawer={() => setDrawerOpen(true)} showDrawerButton={Boolean(user)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-content flex-1 px-4 pb-28 pt-4 lg:pb-10">
          <OfflineBanner />
          <Outlet />
        </main>
        <BottomNav entries={bottomEntries} />
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} entries={entries} />
    </div>
  );
}

function Sidebar({ entries }: { entries: NavEntry[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const confirm = useConfirm();
  if (!user) return null;

  const onLogout = async () => {
    const ok = await confirm({ title: t('logout.title'), text: t('logout.question'), okLabel: t('logout.confirm'), danger: true });
    if (!ok) return;
    await signOut();
    toast.info(t('logout.done'));
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white lg:flex lg:h-screen lg:sticky lg:top-0">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-card bg-primary-dark">
          <GraduationCap aria-hidden="true" size={20} className="text-white" />
        </span>
        <span className="text-h2 font-bold">{t('app.name')}</span>
      </div>
      <nav aria-label={t('layout.mainNav')} className="flex flex-1 flex-col gap-1 px-3">
        {entries.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.to === '/' || entry.to === '/admin'}
            className={({ isActive }) =>
              `flex min-h-touch items-center gap-3 rounded-card px-3 text-base font-medium ${
                isActive ? 'bg-primary-light text-primary-dark' : 'text-ink hover:bg-primary-xl'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <entry.icon aria-hidden="true" size={18} />
                <span>{t(entry.labelKey)}</span>
                {isActive ? <span className="sr-only">{t('layout.current')}</span> : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-card bg-bg p-3">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <p className="truncate text-label font-semibold">{user.name}</p>
            <p className="truncate text-badge text-muted">{user.email}</p>
            <span className="badge mt-1 bg-primary-light text-primary-dark">{t(`roles.${user.role}`)}</span>
          </div>
        </div>
        <Button variant="ghost" block className="mt-2" icon={<LogOut aria-hidden="true" size={18} />} onClick={() => void onLogout()}>
          {t('common.logout')}
        </Button>
      </div>
    </aside>
  );
}

function TopBar({ title, onOpenDrawer, showDrawerButton }: { title: string; onOpenDrawer: () => void; showDrawerButton: boolean }) {
  const { t } = useTranslation();
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center gap-2 bg-primary-dark px-2 py-2 text-white lg:hidden">
      {showDrawerButton ? (
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label={t('layout.openMenu')}
          className="flex h-11 w-11 items-center justify-center rounded-card hover:bg-white/15"
        >
          <Menu aria-hidden="true" size={22} />
        </button>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate text-h2 font-bold">{title}</h1>
    </header>
  );
}

function BottomNav({ entries }: { entries: NavEntry[] }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('layout.bottomNav')}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white lg:hidden"
    >
      {entries.map((entry) => (
        <NavLink
          key={entry.to}
          to={entry.to}
          end={entry.to === '/' || entry.to === '/admin'}
          className={({ isActive }) =>
            `flex min-h-touch flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-badge font-semibold ${
              isActive ? 'text-primary-dark' : 'text-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <entry.icon aria-hidden="true" size={20} />
              <span className="truncate">{t(entry.labelKey)}</span>
              {isActive ? <span className="sr-only">{t('layout.current')}</span> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Drawer({ open, onClose, entries }: { open: boolean; onClose: () => void; entries: NavEntry[] }) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const trigger = triggerRef.current;
      if (trigger instanceof HTMLElement && document.contains(trigger)) trigger.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex lg:hidden" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/45" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('layout.menu')}
        tabIndex={-1}
        className="safe-bottom relative flex h-full w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto bg-white p-3 shadow-raised"
      >
        <div className="flex items-center justify-between">
          <p className="text-h2 font-bold">{t('app.name')}</p>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center rounded-card text-muted hover:bg-primary-xl">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <DrawerProfile onNavigate={onClose} />
        <nav aria-label={t('layout.mainNav')} className="flex flex-col gap-1">
          {entries.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              onClick={onClose}
              end={entry.to === '/' || entry.to === '/admin'}
              className={({ isActive }) =>
                `flex min-h-touch items-center gap-3 rounded-card px-3 text-base font-medium ${
                  isActive ? 'bg-primary-light text-primary-dark' : 'text-ink hover:bg-primary-xl'
                }`
              }
            >
              <entry.icon aria-hidden="true" size={18} />
              {t(entry.labelKey)}
            </NavLink>
          ))}
        </nav>
        <LanguageSwitcher />
        <div className="mt-2">
          <InstallButton block />
        </div>
        <LogoutItem />
      </div>
    </div>
  );
}

function DrawerProfile({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 rounded-card bg-bg p-3">
      <Avatar name={user.name} />
      <div className="min-w-0">
        <p className="truncate text-label font-semibold">{user.name}</p>
        <p className="truncate text-badge text-muted">{user.email}</p>
        <button type="button" className="mt-1 text-badge font-semibold text-primary-dark underline" onClick={onNavigate}>
          {t('layout.openSettings')}
        </button>
      </div>
    </div>
  );
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const { user } = useAuth();
  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-label font-semibold text-muted">{t('settings.language.title')}</p>
      <div className="flex gap-2">
        {(['id', 'en'] as const).map((lang) => {
          const active = (user?.locale ?? i18n.language).slice(0, 2) === lang;
          return (
            <button
              key={lang}
              type="button"
              aria-pressed={active}
              onClick={() => {
                void changeLanguage(lang);
                if (user) updateMe.mutate({ locale: lang });
              }}
              className={`min-h-touch flex-1 rounded-card border px-3 text-label font-semibold ${
                active ? 'border-primary-dark bg-primary-light text-primary-dark' : 'border-line bg-white'
              }`}
            >
              {t(`settings.language.${lang}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogoutItem() {
  const { t } = useTranslation();
  const toast = useToast();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  return (
    <Button
      variant="danger"
      block
      className="mt-3"
      icon={<LogOut aria-hidden="true" size={18} />}
      onClick={async () => {
        const ok = await confirm({ title: t('logout.title'), text: t('logout.question'), okLabel: t('logout.confirm'), danger: true });
        if (!ok) return;
        await signOut();
        toast.info(t('logout.done'));
      }}
    >
      {t('common.logout')}
    </Button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-h1 font-bold lg:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-label text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function LoadingBlock() {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center py-10">
      <Spinner label={t('common.loading')} />
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="card flex flex-col gap-3 border-danger/40 bg-white p-4">
      <p className="text-base font-semibold text-danger">{message ?? t('errors.loadFailed')}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
