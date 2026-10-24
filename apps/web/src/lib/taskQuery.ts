/** Filter daftar tugas <-> URL query (Issue 043/044: filter tersimpan di URL, refresh/Back tidak hilang). */
import type { PriorityLabel, TaskStatus, TaskType } from '@swp/shared';

export type TaskScope = 'kuliah' | 'pribadi' | undefined;
export type StatusFilter = 'active' | 'done' | 'all';
export type SortFilter = 'priority' | 'deadline' | 'newest';
export type TimeFilter = 'today' | 'week' | 'month' | undefined;

export interface TaskListQuery {
  scope: TaskScope;
  status: StatusFilter;
  priority?: PriorityLabel;
  type?: TaskType;
  categoryId?: string;
  time: TimeFilter;
  q: string;
  sort: SortFilter;
  limit: number;
  offset: number;
}

export const DEFAULT_TASK_QUERY: TaskListQuery = {
  scope: undefined,
  status: 'active',
  priority: undefined,
  type: undefined,
  categoryId: undefined,
  time: undefined,
  q: '',
  sort: 'priority',
  limit: 50,
  offset: 0,
};

const PRIORITIES: PriorityLabel[] = ['TOP', 'HIGH', 'MEDIUM', 'LOW'];
const TYPES: TaskType[] = ['FIXED_TIME', 'DEADLINE', 'ROUTINE'];

function enumOr<T extends string | undefined>(raw: string | null, allowed: NonNullable<T>[]): T | undefined {
  return allowed.includes(raw as NonNullable<T>) ? (raw as T) : undefined;
}

export function parseTaskQuery(search: string, scope?: TaskScope): TaskListQuery {
  const params = new URLSearchParams(search);
  const status = enumOr<StatusFilter>(params.get('status'), ['active', 'done', 'all']) ?? 'active';
  const sort = enumOr<SortFilter>(params.get('sort'), ['priority', 'deadline', 'newest']) ?? 'priority';
  const offsetRaw = Number(params.get('offset') ?? '0');
  return {
    scope: enumOr<TaskScope>(params.get('scope'), ['kuliah', 'pribadi']) ?? scope,
    status,
    priority: enumOr<PriorityLabel>(params.get('priority'), PRIORITIES),
    type: enumOr<TaskType>(params.get('type'), TYPES),
    categoryId: params.get('categoryId') ?? undefined,
    time: enumOr<TimeFilter>(params.get('time'), ['today', 'week', 'month']),
    q: params.get('q') ?? '',
    sort,
    limit: DEFAULT_TASK_QUERY.limit,
    offset: Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0,
  };
}

export function serializeTaskQuery(query: TaskListQuery): string {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.status !== DEFAULT_TASK_QUERY.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  if (query.type) params.set('type', query.type);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.time) params.set('time', query.time);
  if (query.q) params.set('q', query.q);
  if (query.sort !== DEFAULT_TASK_QUERY.sort) params.set('sort', query.sort);
  if (query.offset > 0) params.set('offset', String(query.offset));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Bentuk query untuk API: `status=all` valid, `scope` undefined tidak dikirim. */
export function toApiQuery(query: TaskListQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {
    status: query.status,
    sort: query.sort,
    limit: query.limit,
    offset: query.offset,
  };
  if (query.scope) out.scope = query.scope;
  if (query.priority) out.priority = query.priority;
  if (query.type) out.type = query.type;
  if (query.categoryId) out.categoryId = query.categoryId;
  if (query.time) out.time = query.time;
  if (query.q) out.q = query.q;
  return out;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'TODO' || value === 'IN_PROGRESS' || value === 'DONE';
}

/** Siklus tri-state (D-07): TODO -> IN_PROGRESS -> DONE -> TODO. */
export function nextStatus(status: TaskStatus): TaskStatus {
  if (status === 'TODO') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'DONE';
  return 'TODO';
}
