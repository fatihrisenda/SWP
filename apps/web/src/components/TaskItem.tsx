import { useTranslation } from 'react-i18next';
import type { TaskDto } from '../lib/dto';
import { CategoryBadge } from './ui/CategoryBadge';
import { PriorityBadge } from './ui/PriorityBadge';
import { TriStateCheckbox } from './ui/TriStateCheckbox';
import { describeRemaining, fmtDateTime, fmtTime, fmtWeekdays } from '../lib/format';
import { useAuth } from '../lib/auth';

export interface TaskItemProps {
  task: TaskDto;
  now: number;
  onToggleStatus: () => void;
  onOpen: () => void;
  statusPending?: boolean;
}

/** Item daftar tugas (Issue 044 langkah 3): checkbox tri-state + judul + badge + waktu + prioritas. */
export function TaskItem({ task, now, onToggleStatus, onOpen, statusPending }: TaskItemProps) {
  const { t, i18n } = useTranslation();
  const tz = useAuth().user?.timezone ?? 'Asia/Jakarta';
  const eventMs = task.nextEventAt ? new Date(task.nextEventAt).getTime() : null;
  const remaining = eventMs == null ? null : describeRemaining(eventMs, now, t);
  const done = task.status === 'DONE';

  return (
    <li className={`card flex items-start gap-3 p-3 ${done ? 'opacity-60' : ''}`}>
      <TriStateCheckbox status={task.status} onChange={onToggleStatus} taskTitle={task.title} />
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('tasks.openDetail', { title: task.title })}
        className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
      >
        <span className={`break-words text-base font-bold leading-snug ${done ? 'line-through' : ''}`}>{task.title}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge name={task.category.name} color={task.category.color} />
          <span className="badge border border-line bg-bg text-muted">{t(`tasks.type.${task.type}`)}</span>
          <PriorityBadge label={task.priority.label} score={task.priority.score} size="sm" />
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-muted">
          <span>{describeTime(task, tz, i18n.language, t)}</span>
          {remaining ? (
            <span className={remaining.overdue && !done ? 'font-semibold text-top' : 'font-medium'}>
              {remaining.text}
              {statusPending ? ` · ${t('tasks.saving')}` : ''}
            </span>
          ) : statusPending ? (
            <span>{t('tasks.saving')}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function describeTime(
  task: TaskDto,
  tz: string,
  locale: string,
  t: (key: string, o?: Record<string, unknown>) => string,
): string {
  if (task.type === 'FIXED_TIME' && task.startAt && task.endAt) {
    return `${fmtTime(task.startAt, tz, locale)} – ${fmtTime(task.endAt, tz, locale)} · ${fmtDateTime(task.startAt, tz, locale)}`;
  }
  if (task.type === 'DEADLINE' && task.deadlineAt) {
    return `${t('tasks.deadlinePrefix')} ${fmtDateTime(task.deadlineAt, tz, locale)}`;
  }
  if (task.type === 'ROUTINE' && task.routineStartTime) {
    return `${fmtWeekdays(task.routineDays ?? [], locale, t)} · ${task.routineStartTime}`;
  }
  return t('tasks.noTime');
}
