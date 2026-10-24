import { DateTime } from 'luxon';

/** Rentang [start, end) untuk filter `time` (D-30): awal hari ini s.d. akhir periode. */
export function timeRangeMs(time: 'today' | 'week' | 'month', now: number, tz: string): [number, number] {
  const start = DateTime.fromMillis(now, { zone: tz }).startOf('day');
  if (time === 'today') return [start.toMillis(), start.endOf('day').toMillis()];
  if (time === 'week') {
    const end = start.plus({ days: 7 - start.weekday }).endOf('day');
    return [start.toMillis(), end.toMillis()];
  }
  return [start.toMillis(), start.endOf('month').toMillis()];
}

/** Escape `%`, `_`, `\` agar aman dipakai di pola ILIKE Postgres (default escape char = `\`). */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
