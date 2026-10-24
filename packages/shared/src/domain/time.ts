import { DateTime } from 'luxon';
import type { DomainTask } from '../types.js';

/** Durasi tugas dalam jam: FIXED_TIME dari (end-start); DEADLINE/ROUTINE dari durationMinutes. */
export function taskDurationHours(task: DomainTask): number {
  if (task.type === 'FIXED_TIME') {
    if (!task.startAt || !task.endAt) return 0;
    return Math.max(0, (task.endAt.getTime() - task.startAt.getTime()) / 3_600_000);
  }
  return (task.durationMinutes ?? 0) / 60;
}

/** Awal hari (00:00) pada zona waktu `tz`, dikembalikan sebagai epoch ms (UTC instant). */
export function startOfDay(ms: number, tz: string): number {
  return DateTime.fromMillis(ms, { zone: tz }).startOf('day').toMillis();
}

export function endOfDay(ms: number, tz: string): number {
  return DateTime.fromMillis(ms, { zone: tz }).endOf('day').toMillis();
}

export function addDays(ms: number, days: number, tz: string): number {
  return DateTime.fromMillis(ms, { zone: tz }).plus({ days }).toMillis();
}

/** Hari ISO: 1=Senin .. 7=Minggu (Luxon `.weekday` sudah mengikuti ISO). */
export function weekdayISO(ms: number, tz: string): number {
  return DateTime.fromMillis(ms, { zone: tz }).weekday;
}

export function minutesSinceMidnight(ms: number, tz: string): number {
  const dt = DateTime.fromMillis(ms, { zone: tz });
  return dt.hour * 60 + dt.minute;
}

/** Gabungkan tanggal lokal ('2026-10-05') + jam lokal ('19:30') pada zona `tz` menjadi epoch ms. */
export function localToUtc(input: { date: string; time: string }, tz: string): number {
  return DateTime.fromISO(`${input.date}T${input.time}`, { zone: tz }).toMillis();
}

export function isValidTimezone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    return DateTime.local().setZone(tz).isValid;
  } catch {
    return false;
  }
}
