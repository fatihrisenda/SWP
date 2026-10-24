/** UISW04/UISW05 daftar tugas per scope (Issue 044): kartu analytics scope, action bar, daftar, popup detail. */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Clock, ListChecks, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@swp/shared';
import type { TaskScope } from '../lib/taskQuery';
import type { TaskListQuery } from '../lib/taskQuery';
import { nextStatus, parseTaskQuery, serializeTaskQuery } from '../lib/taskQuery';
import { describeDuration } from '../lib/format';
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/AppLayout';
import { TaskDetailDialog } from '../components/TaskDetailDialog';
import { TaskList } from '../components/TaskList';
import { useAnalytics, useTasks } from '../lib/queries';
import { useUpdateTaskStatus } from '../lib/mutations';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';

export interface TaskListPageProps {
  scope: Exclude<TaskScope, undefined>;
}

export function TaskListPage({ scope }: TaskListPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const query = parseTaskQuery(searchParams.toString(), scope);
  const tasks = useTasks(query);
  const analytics = useAnalytics(scope);
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

  const data = analytics.data;
  const createPath = `/tugas/baru?scope=${scope}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t(scope === 'kuliah' ? 'nav.kuliah' : 'nav.pribadi')}
        subtitle={t('tasks.activeCount', { count: data?.active ?? 0 })}
        actions={
          <Button icon={<Plus aria-hidden="true" size={18} />} onClick={() => navigate(createPath)}>
            {t('tasks.add')}
          </Button>
        }
      />

      <section aria-label={t('dash.analytics.title')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ListChecks} label={t('scope.analytics.total', { scope: t(scope === 'kuliah' ? 'nav.kuliah' : 'nav.pribadi') })} value={data?.total ?? 0} loading={analytics.isLoading} />
        <StatCard icon={Clock} label={t('dash.analytics.totalHours')} value={describeDuration(data?.totalHours ?? 0, t)} />
        <StatCard icon={CalendarClock} label={t('dash.analytics.highPriority')} value={data?.highPriority ?? 0} tone="warn" />
        <StatCard icon={CheckCircle2} label={t('scope.analytics.done', { scope: t(scope === 'kuliah' ? 'nav.kuliah' : 'nav.pribadi') })} value={data?.done ?? 0} tone="primary" />
      </section>

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
          pendingIds={pendingIds}
          onToggleStatus={(task) => void toggleStatus(task.id, task.status)}
          onOpen={(task) => setDetailId(task.id)}
          onCreate={() => navigate(createPath)}
          onLoadMore={() => patchQuery({ offset: query.offset + query.limit })}
        />
      )}

      {/* FAB mobile (Issue 044 langkah 2) */}
      <button
        type="button"
        onClick={() => navigate(createPath)}
        aria-label={t('tasks.add')}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-pill bg-primary-dark text-white shadow-raised lg:hidden"
      >
        <Plus aria-hidden="true" size={26} />
      </button>

      {detailId ? <TaskDetailDialog taskId={detailId} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}
