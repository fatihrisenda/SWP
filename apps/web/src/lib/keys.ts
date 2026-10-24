/** Kunci query terpusat (Issue 037 langkah 4). */
import type { TaskListQuery } from './taskQuery';

export const qk = {
  me: ['me'] as const,
  tasks: (filter: TaskListQuery) => ['tasks', filter] as const,
  tasksAll: ['tasks'] as const,
  task: (id: string) => ['task', id] as const,
  analytics: (scope: string | undefined) => ['analytics', scope ?? 'all'] as const,
  categories: ['categories'] as const,
  dashboard: ['dashboard'] as const,
  todayMood: ['moods', 'today'] as const,
  moodHistory: (limit: number) => ['moods', 'history', limit] as const,
  recommendations: (mood: number | undefined) => ['recommendations', mood ?? 'auto'] as const,
  pushKey: ['push', 'public-key'] as const,
  adminStats: ['admin', 'stats'] as const,
  adminUsers: (q: string, offset: number) => ['admin', 'users', q, offset] as const,
};

/** Setelah mutasi tugas/kategori/mood: refresh dashboard + daftar + rekomendasi (FR-02.5, FR-07.6). */
export const MUTATION_INVALIDATIONS = [
  qk.dashboard,
  qk.tasksAll,
  qk.categories,
  ['analytics'],
  ['recommendations'],
  ['task'],
  ['moods'],
] as const;
