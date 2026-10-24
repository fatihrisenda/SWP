/** Cek konflik dry-run (Issue 046) — dipakai form tugas sebelum menyimpan. */
import { apiFetch } from './api';
import type { ConflictResultDto } from './dto';

export async function checkConflictApi(candidate: unknown, excludeTaskId?: string): Promise<ConflictResultDto> {
  return apiFetch<ConflictResultDto>('/tasks/conflicts', {
    method: 'POST',
    body: excludeTaskId ? { candidate, excludeTaskId } : { candidate },
  });
}

export const MAX_CONFLICT_RECHECKS = 3;
