import { useTranslation } from 'react-i18next';
import { difficultyModifier } from '@swp/shared';
import type { TaskDto } from '../lib/dto';
import { CategoryBadge } from './ui/CategoryBadge';
import { PriorityBadge } from './ui/PriorityBadge';
import { StatusBadge } from './ui/StatusBadge';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { describeDuration, fmtDateTime, fmtWeekdays } from '../lib/format';
import { describeTime } from './TaskItem';

export interface TaskDetailModalProps {
  task: TaskDto;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  timezone: string;
  locale: string;
}

/** Popup detail tugas (Issue 044 langkah 4) — termasuk rincian skor & reminder berikutnya. */
export function TaskDetailModal({ task, onClose, onEdit, onDelete, timezone, locale }: TaskDetailModalProps) {
  const { t } = useTranslation();
  const modifier = difficultyModifier(task.difficulty);
  const rows: Array<[string, string]> = [
    [t('tasks.detail.time'), describeTime(task, timezone, locale, t)],
    [t(`tasks.field.${task.type === 'FIXED_TIME' ? 'start' : task.type === 'DEADLINE' ? 'deadline' : 'days'}`), task.type === 'ROUTINE' ? fmtWeekdays(task.routineDays ?? [], locale, t) : task.type === 'FIXED_TIME' && task.startAt ? fmtDateTime(task.startAt, timezone, locale) : task.deadlineAt ? fmtDateTime(task.deadlineAt, timezone, locale) : '—'],
    [t('tasks.detail.duration'), describeDuration(task.durationHours, t)],
    [t('tasks.detail.category'), `${task.category.name} · ${t(`categoryType.${task.category.type}`)}`],
    [t('tasks.detail.importance'), t(`scale.importance.${task.importance}`)],
    [t('tasks.detail.difficulty'), t(`scale.difficulty.${task.difficulty}`)],
    [t('tasks.detail.score'), `= U ${task.priority.urgency.toFixed(1)} × I ${task.importance} × D ${modifier.toFixed(1)}`],
    [
      t('tasks.detail.reminder'),
      task.reminderAt ? fmtDateTime(task.reminderAt, timezone, locale) : t('tasks.detail.reminderNone'),
    ],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={task.title}
      testId="task-detail"
      footer={
        <>
          <Button variant="secondary" onClick={onEdit}>
            {t('tasks.detail.edit')}
          </Button>
          <Button variant="danger" onClick={onDelete}>
            {t('tasks.detail.delete')}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge name={task.category.name} color={task.category.color} />
        <PriorityBadge label={task.priority.label} score={task.priority.score} />
        <StatusBadge status={task.status} />
      </div>
      {task.description ? (
        <p className="mt-3 break-words whitespace-pre-wrap text-base">{task.description}</p>
      ) : (
        <p className="mt-3 text-label text-muted">{t('tasks.detail.noDescription')}</p>
      )}
      <dl className="mt-4 divide-y divide-line rounded-card border border-line">
        {rows.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-0.5 px-3 py-2">
            <dt className="text-badge font-semibold uppercase tracking-wide text-muted">{term}</dt>
            <dd className="break-words text-label">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
