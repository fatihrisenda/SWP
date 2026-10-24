/** Halaman Pengaturan (Issue 050): profil, bahasa, zona waktu, kapasitas harian, notifikasi (055), pasang (054), tentang. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, LogOut, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { LIMITS } from '@swp/shared';
import { LanguageSwitcher, PageHeader } from '../components/AppLayout';
import { InstallButton } from '../components/InstallPrompt';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useConfirm } from '../lib/confirm';
import { useUpdateMe } from '../lib/mutations';
import {
  currentEndpoint,
  disablePush,
  enablePush,
  isIosWithoutInstall,
  pushSupported,
  sendTestNotification,
  type PushStatus,
} from '../lib/push';

/** Daftar pendek WIB/WITA/WIT + "Lainnya…" untuk pencarian IANA (Issue 050 langkah 3). */
const COMMON_ZONES = [
  { value: 'Asia/Jakarta', labelKey: 'settings.timezone.wib' },
  { value: 'Asia/Makassar', labelKey: 'settings.timezone.wita' },
  { value: 'Asia/Jayapura', labelKey: 'settings.timezone.wit' },
] as const;

const OTHER_VALUE = '__other__';

function ianaTimezones(): string[] {
  const finder = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof finder !== 'function') return [];
  try {
    return finder('timeZone');
  } catch {
    return [];
  }
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="flex flex-col gap-4">
        <ProfileCard key={user?.id ?? 'anon'} />
        <Card as="section" ariaLabel={t('settings.language.title')}>
          <LanguageSwitcher />
        </Card>
        <NotificationsCard />
        <InstallCard />
        <AboutCard />
      </div>
    </div>
  );
}

function ProfileCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const updateMe = useUpdateMe();
  const [name, setName] = useState(user?.name ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Asia/Jakarta');
  const [capacity, setCapacity] = useState(String(user?.dailyCapacityHours ?? 8));
  const [nameError, setNameError] = useState<string | undefined>();
  const [timezoneError, setTimezoneError] = useState<string | undefined>();
  const [capacityError, setCapacityError] = useState<string | undefined>();

  // Setelah PATCH berhasil, `user` berubah -> isian mengikuti nilai server.
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setTimezone(user.timezone);
    setCapacity(String(user.dailyCapacityHours));
  }, [user]);

  const allZones = useMemo(() => ianaTimezones(), []);
  const [zoneSearch, setZoneSearch] = useState('');
  // `timezone` saja tidak cukup untuk tahu apakah pengguna memilih "Lainnya…" karena
  // pilihan itu tidak mengubah nilai zona — tanpa flag ini, daftar IANA tidak pernah muncul.
  const [pickOther, setPickOther] = useState(false);
  const isCommon = !pickOther && COMMON_ZONES.some((zone) => zone.value === timezone);
  const zoneMatches = useMemo(() => {
    const needle = zoneSearch.trim().toLowerCase();
    const list = (needle ? allZones.filter((zone) => zone.toLowerCase().includes(needle)) : allZones).slice(0, 120);
    // Zona aktif harus tetap tampil terpilih walau tidak masuk 120 opsi pertama.
    if (!list.includes(timezone)) list.unshift(timezone);
    return list;
  }, [allZones, zoneSearch, timezone]);

  const onSave = async () => {
    setNameError(undefined);
    setTimezoneError(undefined);
    setCapacityError(undefined);
    const trimmed = name.trim();
    if (trimmed.length < LIMITS.userName.min || trimmed.length > LIMITS.userName.max) {
      setNameError(t('settings.errors.name'));
      return;
    }
    const hours = Number(capacity);
    if (!Number.isFinite(hours) || hours < 1 || hours > 24) {
      setCapacityError(t('settings.errors.capacity'));
      return;
    }
    try {
      await updateMe.mutateAsync({ name: trimmed, timezone, dailyCapacityHours: hours });
      toast.success(t('settings.saved'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        if (error.fields?.timezone) setTimezoneError(t('settings.errors.timezone'));
        if (error.fields?.dailyCapacityHours) setCapacityError(t('settings.errors.capacity'));
        if (error.fields?.name) setNameError(t('settings.errors.name'));
      }
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <Card as="section" ariaLabel={t('settings.profile.heading')}>
      <h2 className="text-h2 font-bold">{t('settings.profile.heading')}</h2>
      <div className="mt-3 flex flex-col gap-4">
        <Field label={t('settings.profile.name')} htmlFor="settings-name" error={nameError} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={name}
              maxLength={LIMITS.userName.max}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-ink">{t('settings.profile.email')}</span>
          <p className="break-all rounded-card border border-line bg-bg px-3 py-2 text-base text-muted">{user?.email}</p>
        </div>

        <Field
          label={t('settings.timezone.label')}
          htmlFor="settings-timezone"
          hint={t('settings.timezone.hint')}
          error={timezoneError}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={isCommon ? timezone : OTHER_VALUE}
              onChange={(event) => {
                const next = event.target.value;
                setPickOther(next === OTHER_VALUE);
                setTimezone(next === OTHER_VALUE ? timezone : next);
                if (next === OTHER_VALUE) setTimezoneError(undefined);
              }}
            >
              {COMMON_ZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {t(zone.labelKey)} · {zone.value}
                </option>
              ))}
              <option value={OTHER_VALUE}>{t('settings.timezone.other')}</option>
            </Select>
          )}
        </Field>

        {!isCommon || zoneSearch ? (
          <div className="flex flex-col gap-3">
            <Field label={t('settings.timezone.search')} htmlFor="settings-zone-search">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={zoneSearch}
                  placeholder="Asia/Makassar, Europe/London, …"
                  onChange={(event) => setZoneSearch(event.target.value)}
                />
              )}
            </Field>
            <Select
              aria-label={t('settings.timezone.search')}
              // Daftar hanya menampung 120 opsi; zona aktif bisa berada di luar irisan itu,
              // jadi pilih placeholder kecuali zona tersebut memang sedang tampil.
              value={zoneMatches.includes(timezone) ? timezone : ''}
              onChange={(event) => {
                setTimezone(event.target.value);
                setPickOther(!COMMON_ZONES.some((zone) => zone.value === event.target.value));
                setTimezoneError(undefined);
              }}
            >
              <option value="" disabled>
                {t('settings.timezone.otherPick')}
              </option>
              {zoneMatches.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <Field
          label={t('settings.capacity.label')}
          htmlFor="settings-capacity"
          hint={t('settings.capacity.hint')}
          error={capacityError}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              type="number"
              inputMode="decimal"
              min={1}
              max={24}
              step={0.5}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
          )}
        </Field>

        <div>
          <Button
            icon={<Save aria-hidden="true" size={18} />}
            loading={updateMe.isPending}
            onClick={() => void onSave()}
          >
            {t('settings.save')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function notificationStatus(permission: NotificationPermission, endpoint: string | null): PushStatus {
  if (!pushSupported()) return 'unsupported';
  if (isIosWithoutInstall()) return 'needs-install';
  if (permission === 'denied') return 'blocked';
  if (endpoint) return 'active';
  return permission === 'granted' ? 'inactive' : 'not-permission';
}

function readPermission(): NotificationPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'default';
  return Notification.permission;
}

function NotificationsCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [permission, setPermission] = useState<NotificationPermission>(readPermission);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setPermission(readPermission());
    setEndpoint(await currentEndpoint());
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  const status = notificationStatus(permission, endpoint);

  const onEnable = async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      if (result === 'granted') toast.success(t('notifications.enabled'));
      else if (result === 'denied') toast.error(t('notifications.status.blocked'));
      else toast.error(t('notifications.status.unsupported'));
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('notifications.enableFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      await disablePush();
      toast.success(t('notifications.disabled'));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      const result = await sendTestNotification();
      if (result.sent > 0) toast.success(t('notifications.test.sent', { count: result.sent }));
      else toast.info(t('notifications.test.none'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('notifications.test.failed'));
    } finally {
      setBusy(false);
    }
  };

  const actionable = status === 'active' || status === 'inactive' || status === 'not-permission';

  return (
    <Card as="section" ariaLabel={t('notifications.heading')}>
      <h2 className="text-h2 font-bold">{t('notifications.heading')}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={`badge ${status === 'active' ? 'bg-ok/15 text-ok' : status === 'blocked' || status === 'unsupported' ? 'bg-danger/15 text-danger' : 'bg-bg text-muted'}`}
        >
          {t(`notifications.status.${status}`)}
        </span>
        <Button size="sm" variant="ghost" icon={<RefreshCw aria-hidden="true" size={16} />} onClick={() => void refresh()}>
          {t('common.refresh')}
        </Button>
      </div>
      <p role="status" className="mt-2 text-label text-muted">
        {t(`notifications.hint.${status}`)}
      </p>

      {status === 'needs-install' ? (
        <div className="mt-3">
          <InstallButton />
        </div>
      ) : null}

      {actionable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {status === 'active' ? (
            <Button
              variant="secondary"
              icon={<BellOff aria-hidden="true" size={18} />}
              loading={busy}
              onClick={() => void onDisable()}
            >
              {t('notifications.disable')}
            </Button>
          ) : (
            <Button
              icon={<Bell aria-hidden="true" size={18} />}
              loading={busy}
              onClick={() => void onEnable()}
            >
              {t('notifications.enable')}
            </Button>
          )}
          {status === 'active' ? (
            <Button variant="secondary" loading={busy} onClick={() => void onTest()}>
              {t('notifications.test.button')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function InstallCard() {
  const { t } = useTranslation();
  return (
    <Card as="section" ariaLabel={t('install.heading')}>
      <h2 className="text-h2 font-bold">{t('install.heading')}</h2>
      <p className="mt-1 text-label text-muted">{t('install.hint')}</p>
      <div className="mt-3">
        <InstallButton />
      </div>
    </Card>
  );
}

function AboutCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { signOut } = useAuth();
  const confirm = useConfirm();

  const onLogout = async () => {
    const ok = await confirm({
      title: t('logout.title'),
      text: t('logout.question'),
      okLabel: t('logout.confirm'),
      danger: true,
    });
    if (!ok) return;
    await signOut();
    toast.info(t('logout.done'));
  };

  return (
    <Card as="section" ariaLabel={t('settings.about.heading')}>
      <h2 className="text-h2 font-bold">{t('settings.about.heading')}</h2>
      <dl className="mt-2 divide-y divide-line">
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-label text-muted">{t('settings.about.version')}</dt>
          <dd className="text-label font-semibold">{__APP_VERSION__}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-label text-muted">{t('privacy.title')}</dt>
          <dd>
            <Link to="/privasi" className="flex items-center gap-1 text-label font-semibold text-primary-dark underline">
              <ShieldCheck aria-hidden="true" size={16} />
              {t('settings.about.privacy')}
            </Link>
          </dd>
        </div>
      </dl>
      <Button
        variant="danger"
        className="mt-3"
        icon={<LogOut aria-hidden="true" size={18} />}
        onClick={() => void onLogout()}
      >
        {t('common.logout')}
      </Button>
    </Card>
  );
}
