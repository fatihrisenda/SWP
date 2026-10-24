import { DateTime } from 'luxon';
import type { DomainTask } from '../types.js';
import { taskDurationHours } from './time.js';

/**
 * Kemunculan berikutnya (atau yang sedang berlangsung) dari tugas ROUTINE, >= `fromMs`.
 * Kemunculan yang sedang berlangsung dihitung (perilaku kode lama): `start + durasi > from`.
 */
export function nextOccurrence(task: DomainTask, fromMs: number, tz: string): number | null {
  const days = task.routineDays;
  if (!days?.length || task.routineStartMinute == null) return null;
  const durMs = taskDurationHours(task) * 3_600_000;
  const hour = Math.floor(task.routineStartMinute / 60);
  const minute = task.routineStartMinute % 60;
  const startDay = DateTime.fromMillis(fromMs, { zone: tz }).startOf('day');

  for (let i = 0; i < 8; i++) {
    const day = startDay.plus({ days: i });
    if (!days.includes(day.weekday)) continue;
    const startMs = day.set({ hour, minute, second: 0, millisecond: 0 }).toMillis();
    if (startMs + durMs > fromMs) return startMs;
  }
  return null;
}

/** Semua kemunculan [start,end) yang beririsan dengan [fromMs, toMs). */
export function occurrencesBetween(
  task: DomainTask,
  fromMs: number,
  toMs: number,
  tz: string,
): Array<[number, number]> {
  const days = task.routineDays;
  if (!days?.length || task.routineStartMinute == null || toMs <= fromMs) return [];
  const durMs = taskDurationHours(task) * 3_600_000;
  const hour = Math.floor(task.routineStartMinute / 60);
  const minute = task.routineStartMinute % 60;
  const startDay = DateTime.fromMillis(fromMs, { zone: tz }).startOf('day');
  const totalDays = Math.ceil((toMs - fromMs) / 86_400_000) + 2;

  const out: Array<[number, number]> = [];
  for (let i = 0; i < totalDays; i++) {
    const day = startDay.plus({ days: i });
    if (!days.includes(day.weekday)) continue;
    const startMs = day.set({ hour, minute, second: 0, millisecond: 0 }).toMillis();
    const endMs = startMs + durMs;
    if (endMs > fromMs && startMs < toMs) out.push([startMs, endMs]);
  }
  return out;
}
