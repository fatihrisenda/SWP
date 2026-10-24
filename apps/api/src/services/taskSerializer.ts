import type { Category, Task } from '@prisma/client';
import { eventTime, priority, taskDurationHours } from '@swp/shared';
import { toDomainTask } from '../lib/reminderService.js';

export interface CategorySummary {
  id: string;
  name: string;
  color: string;
  type: Category['type'];
}

export interface TaskResponse {
  id: string;
  title: string;
  description: string;
  type: Task['type'];
  status: Task['status'];
  category: CategorySummary;
  importance: number;
  difficulty: number;
  startAt?: string;
  endAt?: string;
  deadlineAt?: string;
  routineDays?: number[];
  routineStartTime?: string;
  durationHours: number;
  nextEventAt: string | null;
  priority: { score: number; label: string; urgency: number };
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function minuteToHHmm(minute: number): string {
  const h = Math.floor(minute / 60)
    .toString()
    .padStart(2, '0');
  const m = (minute % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function serializeTask(
  task: Task,
  category: Category,
  now: number,
  tz: string,
  reminderAt: Date | null = null,
): TaskResponse {
  const domain = toDomainTask(task);
  const ev = eventTime(domain, now, tz);
  const p = priority(domain, now, tz);

  const base: TaskResponse = {
    id: task.id,
    title: task.title,
    description: task.description ?? '',
    type: task.type,
    status: task.status,
    category: { id: category.id, name: category.name, color: category.color, type: category.type },
    importance: task.importance,
    difficulty: task.difficulty,
    durationHours: Math.round(taskDurationHours(domain) * 100) / 100,
    nextEventAt: ev == null ? null : new Date(ev).toISOString(),
    priority: p,
    reminderAt: reminderAt ? reminderAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };

  if (task.type === 'FIXED_TIME') {
    base.startAt = task.startAt?.toISOString();
    base.endAt = task.endAt?.toISOString();
  } else if (task.type === 'DEADLINE') {
    base.deadlineAt = task.deadlineAt?.toISOString();
  } else {
    base.routineDays = task.routineDays;
    base.routineStartTime = task.routineStartMinute != null ? minuteToHHmm(task.routineStartMinute) : undefined;
  }

  return base;
}
