import { ListX, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNow } from '../lib/hooks';
import type { TaskDto } from '../lib/dto';
import type { TaskListQuery } from '../lib/taskQuery';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { TaskItem } from './TaskItem';

export interface TaskListProps {
  tasks: TaskDto[];
  total: number;
  query: TaskListQuery;
  onQueryChange: (patch: Partial<TaskListQuery>) => void;
  onToggleStatus: (task: TaskDto) => void;
  onOpen: (task: TaskDto) => void;
  onCreate: () => void;
  pendingIds?: string[];
  onLoadMore?: () => void;
  /** Filter waktu hanya di dashboard (FR-10.3). */
  showTimeFilter?: boolean;
  createLabelKey?: string;
}

/** Daftar tugas + action bar (search debounce 300 ms, dropdown prioritas/status/urut) — Issue 044. */
export function TaskList({
  tasks,
  total,
  query,
  onQueryChange,
  onToggleStatus,
  onOpen,
  onCreate,
  pendingIds = [],
  onLoadMore,
  showTimeFilter,
  createLabelKey = 'tasks.add',
}: TaskListProps) {
  const { t } = useTranslation();
  const now = useNow();

  return (
    <section aria-label={t('tasks.listLabel')} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            aria-label={t('tasks.search')}
            placeholder={t('tasks.searchPlaceholder')}
            className="pl-10"
            value={query.q}
            onChange={(event) => onQueryChange({ q: event.target.value, offset: 0 })}
          />
        </div>
        <Button icon={<Plus aria-hidden="true" size={18} />} onClick={onCreate}>
          {t(createLabelKey)}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-badge font-semibold text-muted">
          {t('tasks.filter.priority')}
          <Select
            aria-label={t('tasks.filter.priority')}
            value={query.priority ?? ''}
            onChange={(event) => onQueryChange({ priority: (event.target.value || undefined) as TaskListQuery['priority'], offset: 0 })}
          >
            <option value="">{t('filter.all')}</option>
            {(['TOP', 'HIGH', 'MEDIUM', 'LOW'] as const).map((label) => (
              <option key={label} value={label}>
                {t(`priority.${label}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-badge font-semibold text-muted">
          {t('tasks.filter.status')}
          <Select
            aria-label={t('tasks.filter.status')}
            value={query.status}
            onChange={(event) => onQueryChange({ status: event.target.value as TaskListQuery['status'], offset: 0 })}
          >
            <option value="all">{t('filter.all')}</option>
            <option value="active">{t('filter.active')}</option>
            <option value="done">{t('filter.done')}</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-badge font-semibold text-muted">
          {t('tasks.filter.sort')}
          <Select
            aria-label={t('tasks.filter.sort')}
            value={query.sort}
            onChange={(event) => onQueryChange({ sort: event.target.value as TaskListQuery['sort'], offset: 0 })}
          >
            <option value="priority">{t('sort.priority')}</option>
            <option value="deadline">{t('sort.deadline')}</option>
            <option value="newest">{t('sort.newest')}</option>
          </Select>
        </label>
        {showTimeFilter ? (
          <label className="flex flex-col gap-1 text-badge font-semibold text-muted">
            {t('tasks.filter.time')}
            <Select
              aria-label={t('tasks.filter.time')}
              value={query.time ?? ''}
              onChange={(event) => onQueryChange({ time: (event.target.value || undefined) as TaskListQuery['time'], offset: 0 })}
            >
              <option value="">{t('filter.all')}</option>
              <option value="today">{t('time.today')}</option>
              <option value="week">{t('time.week')}</option>
              <option value="month">{t('time.month')}</option>
            </Select>
          </label>
        ) : null}
      </div>

      <p className="text-badge text-muted">{t('tasks.triState.help')}</p>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListX}
          title={t('tasks.empty')}
          description={query.q || query.priority || query.categoryId ? t('tasks.emptyFiltered') : t('tasks.emptyHint')}
          action={
            <Button icon={<Plus aria-hidden="true" size={18} />} onClick={onCreate}>
              {t(createLabelKey)}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              now={now}
              statusPending={pendingIds.includes(task.id)}
              onToggleStatus={() => onToggleStatus(task)}
              onOpen={() => onOpen(task)}
            />
          ))}
        </ul>
      )}

      {tasks.length > 0 && total > tasks.length && onLoadMore ? (
        <Button variant="secondary" block onClick={onLoadMore}>
          {t('common.loadMore', { shown: tasks.length, total })}
        </Button>
      ) : null}
    </section>
  );
}
