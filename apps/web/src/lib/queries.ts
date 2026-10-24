/** Data layer baca (Issue 037). Semua request lewat `apiFetch` (cookie sesi, timeout, error seragam). */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import type {
  AdminStatsDto,
  AdminUserDto,
  AnalyticsDto,
  CategoryDto,
  DashboardDto,
  MoodDto,
  RecommendationsDto,
  TaskDto,
  TaskListDto,
  TodayMoodDto,
  UserDto,
} from './dto';
import { qk } from './keys';
import { toApiQuery, type TaskListQuery } from './taskQuery';

export function useMe(enabled = true) {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => (await apiFetch<{ user: UserDto }>('/auth/me')).user,
    enabled,
    retry: false,
    staleTime: Infinity,
  });
}

export function useTasks(filter: TaskListQuery, enabled = true) {
  return useQuery({
    queryKey: qk.tasks(filter),
    queryFn: () => apiFetch<TaskListDto>('/tasks', { query: toApiQuery(filter) }),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

export function useTask(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.task(id ?? ''),
    queryFn: () => apiFetch<TaskDto>(`/tasks/${id}`),
    enabled: enabled && Boolean(id),
  });
}

export function useAnalytics(scope?: 'kuliah' | 'pribadi') {
  return useQuery({
    queryKey: qk.analytics(scope),
    queryFn: () => apiFetch<AnalyticsDto>('/tasks/analytics', { query: scope ? { scope } : undefined }),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => apiFetch<CategoryDto[]>('/categories'),
    enabled,
  });
}

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => apiFetch<DashboardDto>('/dashboard'),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useTodayMood(enabled = true) {
  return useQuery({
    queryKey: qk.todayMood,
    queryFn: () => apiFetch<TodayMoodDto>('/moods/today'),
    enabled,
  });
}

export function useMoodHistory(limit = 7, enabled = true) {
  return useQuery({
    queryKey: qk.moodHistory(limit),
    queryFn: () => apiFetch<MoodDto[]>('/moods', { query: { limit } }),
    enabled,
  });
}

export function useRecommendations(mood: number | undefined, enabled = true, signal?: AbortSignal) {
  return useQuery({
    queryKey: qk.recommendations(mood),
    queryFn: ({ signal: qSignal }) =>
      apiFetch<RecommendationsDto>('/recommendations', {
        query: mood ? { mood } : undefined,
        signal: qSignal ?? signal,
      }),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useAdminStats(enabled = true) {
  return useQuery({
    queryKey: qk.adminStats,
    queryFn: () => apiFetch<AdminStatsDto>('/admin/stats'),
    enabled,
  });
}

export function useAdminUsers(q: string, offset: number, enabled = true) {
  return useQuery({
    queryKey: qk.adminUsers(q, offset),
    queryFn: () => apiFetch<AdminUserDto[]>('/admin/users', { query: { q: q || undefined, limit: 50, offset } }),
    enabled,
    placeholderData: (previous) => previous,
  });
}
