import type { Prisma, Task } from '@prisma/client';
import type { TaskInput } from '@swp/shared';

type TaskWriteFields = Omit<Prisma.TaskUncheckedCreateInput, 'id' | 'userId' | 'status' | 'doneAt'>;

function minuteToHHmm(minute: number): string {
  const h = Math.floor(minute / 60)
    .toString()
    .padStart(2, '0');
  const m = (minute % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Konversi `TaskInput` (Zod, Bagian 6.3) ke kolom DB — selalu overwrite penuh field spesifik-tipe. */
export function taskInputToDbFields(input: TaskInput): TaskWriteFields {
  const common = {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    importance: input.importance,
    difficulty: input.difficulty,
  };

  if (input.type === 'FIXED_TIME') {
    return {
      ...common,
      type: 'FIXED_TIME',
      startAt: input.startAt,
      endAt: input.endAt,
      deadlineAt: null,
      durationMinutes: null,
      routineDays: [],
      routineStartMinute: null,
    };
  }

  if (input.type === 'DEADLINE') {
    return {
      ...common,
      type: 'DEADLINE',
      deadlineAt: input.deadlineAt,
      durationMinutes: Math.round(input.durationHours * 60),
      startAt: null,
      endAt: null,
      routineDays: [],
      routineStartMinute: null,
    };
  }

  const [hh, mm] = input.routineStartTime.split(':').map(Number);
  return {
    ...common,
    type: 'ROUTINE',
    routineDays: input.routineDays,
    routineStartMinute: (hh ?? 0) * 60 + (mm ?? 0),
    durationMinutes: Math.round(input.durationHours * 60),
    startAt: null,
    endAt: null,
    deadlineAt: null,
  };
}

/** Rekonstruksi bentuk `TaskInput` mentah (sebelum divalidasi ulang) dari baris DB — dipakai saat PATCH. */
export function taskToPseudoInput(task: Task): Record<string, unknown> {
  const common = {
    title: task.title,
    description: task.description ?? '',
    categoryId: task.categoryId,
    importance: task.importance,
    difficulty: task.difficulty,
  };

  if (task.type === 'FIXED_TIME') {
    return {
      type: 'FIXED_TIME',
      ...common,
      startAt: task.startAt?.toISOString(),
      endAt: task.endAt?.toISOString(),
    };
  }

  if (task.type === 'DEADLINE') {
    return {
      type: 'DEADLINE',
      ...common,
      deadlineAt: task.deadlineAt?.toISOString(),
      durationHours: (task.durationMinutes ?? 0) / 60,
    };
  }

  return {
    type: 'ROUTINE',
    ...common,
    routineDays: task.routineDays,
    routineStartTime: minuteToHHmm(task.routineStartMinute ?? 0),
    durationHours: (task.durationMinutes ?? 0) / 60,
  };
}
