/** UISW03 Dashboard (Issue 043): sapaan, 4 kartu analytics, mood, tugas terdekat, akses cepat, daftar tugas. */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BellRing, BrainCircuit, CalendarClock, CheckCircle2, Clock, GraduationCap, ListChecks, Tags, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@swp/shared';
import type { TaskListQuery } from '../lib/taskQuery';
import { nextStatus, parseTaskQuery, serializeTaskQuery } from '../lib/taskQuery';
import { useAuth } from '../lib/auth';
import { describeDuration, firstName, fmtDate, greetingKey, describeRemaining } from '../lib/format';
import { useNow } from '../lib/hooks';
import { useCategories, useDashboard, useTasks, useTodayMood, useAnalytics } from '../lib/queries';
import { useSetMood, useUpdateTaskStatus } from '../lib/mutations';
import { ErrorBlock, LoadingBlock } from '../components/AppLayout';
import { InstallNudge } from '../components/InstallPrompt';
import { MoodEmoji, MoodPicker } from '../components/MoodPicker';
import { TaskDetailDialog } from '../components/TaskDetailDialog';
import { TaskList } from '../components/TaskList';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { StatCard } from '../components/ui/StatCard';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const now = useNow();
  const query = parseTaskQuery(searchParams.toString());
  const dashboard = useDashboard();
  const tasks = useTasks(query);
  const mood = useTodayMood();
  const kuliah = useAnalytics('kuliah');
  const pribadi = useAnalytics('pribadi');
  const setMood = useSetMood();
  const updateStatus = useUpdateTaskStatus();

  const patchQuery = (patch: Partial<TaskListQuery>): void => {
    setSearchParams(serializeTaskQuery({ ...query, ...patch }), { replace: true });
  };

  const toggleStatus = async (taskId: string, current: TaskStatus): Promise<void> => {
    setPendingIds((ids) => [...ids, taskId]);
    try {
      await updateStatus.mutateAsync({ id: taskId, status: nextStatus(current) });
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== taskId));
    }
  };

  if (dashboard.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton lines={2} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} lines={3} />
          ))}
        </div>
        <Skeleton lines={4} />
      </div>
    );
  }

  const data = dashboard.data;
  if (dashboard.isError || !data || !user) {
    return <ErrorBlock onRetry={() => void dashboard.refetch()} />;
  }

  const tz = user.timezone;
  const locale = i18n.language;
  const analytics = data.analytics;
  const todayMood = mood.data?.level ?? null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-h1 font-bold">
            {t(`dash.greeting.${greetingKey(tz, now)}`)}, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-label text-muted">{fmtDate(now, tz, locale)}</p>
        </div>
        <Button icon={<ListChecks aria-hidden="true" size={18} />} onClick={() => navigate('/tugas/baru')}>
          {t('tasks.add')}
        </Button>
      </header>

      <InstallNudge />

      {data.dueWithin24h > 0 ? (
        <div role="status" className="card flex items-start gap-3 border-warn/40 bg-[#FFFBEB] p-3 text-label text-[#92400E]">
          <BellRing aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <p className="font-semibold">{t('dash.dueSoon', { count: data.dueWithin24h })}</p>
        </div>
      ) : null}

      <section aria-label={t('dash.analytics.title')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ListChecks} label={t('dash.analytics.total')} value={analytics.total} />
        <StatCard
          icon={Clock}
          label={t('dash.analytics.totalHours')}
          value={describeDuration(analytics.totalHours, t)}
          hint={t('dash.analytics.totalHoursHint')}
        />
        <StatCard
          icon={CalendarClock}
          label={t('dash.analytics.highPriority')}
          value={analytics.highPriority}
          tone="warn"
          hint={t('dash.analytics.highPriorityHint')}
        />
        <StatCard icon={CheckCircle2} label={t('dash.analytics.done')} value={analytics.done} tone="primary" hint={t('dash.analytics.doneHint')} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card as="section" ariaLabel={t('dash.nearest.title')} className="flex flex-col gap-3 p-4">
          <h2 className="text-h2 font-bold">{t('dash.nearest.title')}</h2>
          {data.nearest.length === 0 ? (
            <p className="text-label text-muted">{t('dash.nearest.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.nearest.map((item) => {
                const eventMs = new Date(item.eventAt).getTime();
                const remaining = describeRemaining(eventMs, now, t);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setDetailId(item.id)}
                      className="flex w-full items-start gap-3 rounded-card border border-line bg-white p-3 text-left hover:bg-primary-xl"
                    >
                      <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.category.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-base font-semibold">{item.title}</span>
                        <span className="mt-0.5 block text-badge text-muted">
                          {item.category.name} · {fmtDate(eventMs, tz, locale)}
                        </span>
                        <span className={`mt-1 block text-badge font-semibold ${remaining.overdue ? 'text-danger' : 'text-muted'}`}>
                          {remaining.text}
                        </span>
                      </span>
                      <PriorityBadge label={item.priority.label} size="sm" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card as="section" ariaLabel={t('rec.moodQuestion')} className="flex flex-col gap-3 p-4">
          {todayMood == null ? (
            <>
              <h2 className="text-h2 font-bold">{t('dash.mood.question')}</h2>
              <MoodPicker
                compact
                value={null}
                disabled={setMood.isPending}
                onChange={(level) => {
                  setMood.mutate(level, {
                    onSuccess: () => toast.success(t('dash.mood.saved')),
                    onError: () => toast.error(t('errors.generic')),
                  });
                }}
              />
              <p className="text-badge text-muted">{t('dash.mood.hint')}</p>
            </>
          ) : (
            <>
              <h2 className="text-h2 font-bold">
                {t('dash.mood.today', { label: t(`mood.label.${todayMood}`) })} <MoodEmoji level={todayMood} />
              </h2>
              {data.topPick ? (
                <p className="text-label text-muted">{t('dash.mood.topPick', { title: data.topPick.title })}</p>
              ) : (
                <p className="text-label text-muted">{t('dash.mood.noPick')}</p>
              )}
              <Button variant="secondary" icon={<BrainCircuit aria-hidden="true" size={18} />} onClick={() => navigate('/ai')}>
                {t('dash.mood.openAi')}
              </Button>
            </>
          )}
        </Card>
      </div>

      <section aria-label={t('dash.quick.title')} className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold">{t('dash.quick.title')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickLink to="/tugas-kuliah" icon={<GraduationCap aria-hidden="true" size={22} />} title={t('nav.kuliah')} count={kuliah.data?.active} />
          <QuickLink to="/tugas-pribadi" icon={<User aria-hidden="true" size={22} />} title={t('nav.pribadi')} count={pribadi.data?.active} />
          <QuickLink to="/ai" icon={<BrainCircuit aria-hidden="true" size={22} />} title={t('nav.ai')} />
          <QuickLink to="/kategori" icon={<Tags aria-hidden="true" size={22} />} title={t('nav.categories')} />
        </div>
      </section>

      <section aria-label={t('dash.all.title')} className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold">{t('dash.all.title')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-badge font-semibold text-muted">
            {t('dash.filter.category')}
            <FilterSelect labelKey="dash.filter.category" value={query.categoryId ?? ''} onChange={(value) => patchQuery({ categoryId: value || undefined, offset: 0 })}>
              <CategoryOptions />
            </FilterSelect>
          </label>
          <label className="flex flex-col gap-1 text-badge font-semibold text-muted">
            {t('tasks.filter.type')}
            <FilterSelect labelKey="tasks.filter.type" value={query.type ?? ''} onChange={(value) => patchQuery({ type: (value || undefined) as TaskListQuery['type'], offset: 0 })}>
              <option value="FIXED_TIME">{t('tasks.type.FIXED_TIME')}</option>
              <option value="DEADLINE">{t('tasks.type.DEADLINE')}</option>
              <option value="ROUTINE">{t('tasks.type.ROUTINE')}</option>
            </FilterSelect>
          </label>
        </div>

        {tasks.isLoading ? (
          <LoadingBlock />
        ) : tasks.isError ? (
          <ErrorBlock onRetry={() => void tasks.refetch()} />
        ) : (
          <TaskList
            tasks={tasks.data?.items ?? []}
            total={tasks.data?.total ?? 0}
            query={query}
            onQueryChange={patchQuery}
            showTimeFilter
            pendingIds={pendingIds}
            onToggleStatus={(task) => void toggleStatus(task.id, task.status)}
            onOpen={(task) => setDetailId(task.id)}
            onCreate={() => navigate('/tugas/baru')}
            onLoadMore={() => patchQuery({ offset: query.offset + query.limit })}
          />
        )}
      </section>

      {detailId ? <TaskDetailDialog taskId={detailId} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}

function QuickLink({ to, icon, title, count }: { to: string; icon: ReactNode; title: string; count?: number }) {
  const { t } = useTranslation();
  return (
    <Link to={to} className="card flex min-h-touch flex-col gap-1 p-3 hover:bg-primary-xl" aria-label={title}>
      <span className="flex items-center gap-2 text-primary-dark">
        {icon}
        <span className="text-base font-semibold">{title}</span>
      </span>
      {typeof count === 'number' ? <span className="text-badge text-muted">{t('dash.quick.activeCount', { count })}</span> : null}
    </Link>
  );
}

function FilterSelect({
  labelKey,
  value,
  onChange,
  children,
}: {
  labelKey: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Select aria-label={t(labelKey)} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{t('filter.all')}</option>
      {children}
    </Select>
  );
}

function CategoryOptions() {
  const categories = useCategories();
  return (
    <>
      {(categories.data ?? []).map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </>
  );
}
