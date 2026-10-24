/** Tipe DTO respons API (kontrak Bagian 6 issues.md). Server menyimpan tipe ini di apps/api;
 * `@swp/shared` tidak mengekspor DTO respons, jadi dideklarasikan lokal di web. */
import type { CategoryType, PriorityLabel, Role, TaskStatus, TaskType } from '@swp/shared';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
  locale: string;
  dailyCapacityHours: number;
  createdAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  color: string;
  type: CategoryType;
  taskCount?: number;
}

export interface PriorityDto {
  score: number;
  label: PriorityLabel;
  urgency: number;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  category: { id: string; name: string; color: string; type: CategoryType };
  importance: number;
  difficulty: number;
  startAt?: string;
  endAt?: string;
  deadlineAt?: string;
  routineDays?: number[];
  routineStartTime?: string;
  durationHours: number;
  nextEventAt: string | null;
  priority: PriorityDto;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListDto {
  items: TaskDto[];
  total: number;
}

export interface AnalyticsDto {
  total: number;
  done: number;
  active: number;
  totalHours: number;
  highPriority: number;
}

export interface DashboardNearestDto {
  id: string;
  title: string;
  category: { name: string; color: string };
  type: TaskType;
  eventAt: string;
  priority: PriorityDto;
  isOverdue: boolean;
}

export interface DashboardDto {
  analytics: AnalyticsDto;
  nearest: DashboardNearestDto[];
  dueWithin24h: number;
  mood: { level: number; at: string } | null;
  topPick: { taskId: string; title: string } | null;
}

export interface MoodDto {
  id?: string;
  level: number;
  at: string;
}

export interface TodayMoodDto {
  level: number | null;
  at?: string;
}

export interface RecommendationTaskDto {
  id: string;
  title: string;
  category: { id: string; name: string; color: string; type: CategoryType } | null;
  type: TaskType;
  eventAt: string | null;
  durationHours: number;
  difficulty: number;
  importance: number;
  priority: PriorityDto;
}

export interface RecommendationsDto {
  mood: number;
  energyKey: string;
  items: Array<{
    task: RecommendationTaskDto;
    matchPercent: number;
    reasonKey: string;
    reasonParams: Record<string, unknown>;
    isTopPick: boolean;
  }>;
  postpone: Array<{ task: RecommendationTaskDto; reasonKey: string; reasonParams: Record<string, unknown> }>;
  selfCare: { level: 1 | 2 | null; tipKeys: readonly string[] };
}

export interface ConflictOpponentDto {
  id: string;
  title: string;
  priority: PriorityDto;
}

export interface ConflictResultDto {
  collisions: Array<{ task: ConflictOpponentDto; start: string; end: string }>;
  buffers: Array<{ task: ConflictOpponentDto; gapMinutes: number; start: string; end: string }>;
  overload: Array<{ dayStart: string; hours: number }>;
  suggestedSlot: { start: string; end: string } | null;
  lowPriorityCandidate: ConflictOpponentDto | null;
  any: boolean;
}

export interface PushPublicKeyDto {
  publicKey: string | null;
}

export interface AdminStatsDto {
  totalUsers: number;
  totalMahasiswa: number;
  totalSuperAdmin: number;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}
