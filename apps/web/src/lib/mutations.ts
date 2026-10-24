/** Mutasi + invalidasi (Issue 037 langkah 4-6). */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryType, TaskStatus } from '@swp/shared';
import { apiFetch } from './api';
import type { CategoryDto, TaskDto, UserDto } from './dto';
import { MUTATION_INVALIDATIONS, qk } from './keys';

export function invalidateEverything(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const key of MUTATION_INVALIDATIONS) void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
}

function useInvalidateOnSettled() {
  const queryClient = useQueryClient();
  return () => invalidateEverything(queryClient);
}

export function useCreateTask() {
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: (body: unknown) => apiFetch<TaskDto>('/tasks', { method: 'POST', body }),
    onSettled,
  });
}

export function useUpdateTask() {
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      apiFetch<TaskDto>(`/tasks/${id}`, { method: 'PATCH', body }),
    onSettled,
  });
}

export function useDeleteTask() {
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSettled,
  });
}

/** Perubahan status bersifat optimistik dengan rollback bila gagal (Issue 037 langkah 5). */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiFetch<TaskDto>(`/tasks/${id}/status`, { method: 'PATCH', body: { status } }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: qk.tasksAll });
      const previous = queryClient.getQueriesData<{ items: TaskDto[]; total: number }>({ queryKey: qk.tasksAll });
      queryClient.setQueriesData<{ items: TaskDto[]; total: number }>({ queryKey: qk.tasksAll }, (old) =>
        old ? { ...old, items: old.items.map((task) => (task.id === id ? { ...task, status } : task)) } : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled,
  });
}

export interface CategoryInputBody {
  name: string;
  color: string;
  type: CategoryType;
}

export function useCreateCategory() {
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: (body: CategoryInputBody) => apiFetch<CategoryDto>('/categories', { method: 'POST', body }),
    onSettled,
  });
}

export function useUpdateCategory() {
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CategoryInputBody> }) =>
      apiFetch<CategoryDto>(`/categories/${id}`, { method: 'PATCH', body }),
    onSettled,
  });
}

export function useDeleteCategory() {
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      apiFetch<void>(`/categories/${id}`, { method: 'DELETE', query: reassignTo ? { reassignTo } : undefined }),
    onSettled,
  });
}

export function useSetMood() {
  const onSettled = useInvalidateOnSettled();
  return useMutation({
    mutationFn: (level: number) => apiFetch<{ level: number; at: string }>('/moods', { method: 'POST', body: { level } }),
    onSettled,
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch<{ user: UserDto }>('/me', { method: 'PATCH', body }),
    onSuccess: ({ user }) => queryClient.setQueryData(qk.me, user),
  });
}

export function useAdminCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string; role: string }) =>
      apiFetch<AdminUserDtoShape>('/admin/users', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useAdminUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch<AdminUserDtoShape>(`/admin/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

/** Bentuk respons admin user (dipakai agar tidak mengimpor tipe di tempat lain). */
type AdminUserDtoShape = Pick<UserDto, 'id' | 'name' | 'email' | 'role' | 'createdAt'>;
