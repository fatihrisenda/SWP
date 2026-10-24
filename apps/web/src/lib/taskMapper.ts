/** Pemetaan DTO <-> DomainTask (`@swp/shared`) untuk perhitungan lokal (pratinjau prioritas, sisa waktu). */
import type { DomainTask } from '@swp/shared';
import type { TaskDto } from './dto';
import { hhmmToMinutes } from './format';

export function dtoToDomain(task: TaskDto): DomainTask {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    importance: task.importance,
    difficulty: task.difficulty,
    startAt: task.startAt ? new Date(task.startAt) : null,
    endAt: task.endAt ? new Date(task.endAt) : null,
    deadlineAt: task.deadlineAt ? new Date(task.deadlineAt) : null,
    durationMinutes: Math.round((task.durationHours ?? 0) * 60),
    routineDays: task.routineDays ?? [],
    routineStartMinute: task.routineStartTime ? hhmmToMinutes(task.routineStartTime) : null,
  };
}

export function eventMs(task: TaskDto, fallbackIso?: string | null): number | null {
  const iso = task.nextEventAt ?? fallbackIso ?? null;
  return iso ? new Date(iso).getTime() : null;
}
