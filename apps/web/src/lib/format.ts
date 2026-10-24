/** Format tanggal/jam/angka locale-aware (Issue 039 langkah 3) — selalu pakai zona user. */
import { DateTime } from 'luxon';

export type TFunc = (key: string, options?: Record<string, unknown>) => string;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function fmtDate(value: string | number | Date, tz: string, locale: string): string {
  return dt(value, tz).toLocaleString(DateTime.DATE_MED, { locale });
}

export function fmtTime(value: string | number | Date, tz: string, locale: string): string {
  return dt(value, tz).toLocaleString(DateTime.TIME_SIMPLE, { locale });
}

export function fmtDateTime(value: string | number | Date, tz: string, locale: string): string {
  return dt(value, tz).toLocaleString(DateTime.DATETIME_MED, { locale });
}

export function fmtDayName(isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7, locale: string, t: TFunc): string {
  const key = `time.days.short${isoWeekday}`;
  return t(key, { defaultValue: DateTime.now().set({ weekday: isoWeekday }).toFormat('ccc', { locale }) });
}

export function fmtWeekdays(days: number[], locale: string, t: TFunc): string {
  return days.map((d) => fmtDayName(d as 1 | 2 | 3 | 4 | 5 | 6 | 7, locale, t)).join(', ');
}

function dt(value: string | number | Date, tz: string): DateTime {
  const base = typeof value === 'string' || typeof value === 'number' ? DateTime.fromMillis(Number(new Date(value)), { zone: 'utc' }) : DateTime.fromJSDate(value, { zone: 'utc' });
  const shifted = base.isValid ? base : DateTime.now();
  return shifted.setZone(safeZone(tz));
}

export function safeZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    return DateTime.local().setZone(tz).isValid ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** 'HH:mm' -> menit sejak tengah malam. */
export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':');
  const hour = Number(h ?? 0);
  const minute = Number(m ?? 0);
  return hour * 60 + minute;
}

export function minutesToHHmm(minute: number): string {
  const clamped = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const m = (clamped % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** ISO UTC -> pasangan input tanggal + jam lokal pada zona user (D-36). */
export function isoToLocalDateTime(iso: string | null | undefined, tz: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const local = DateTime.fromISO(iso, { zone: 'utc' }).setZone(safeZone(tz));
  if (!local.isValid) return { date: '', time: '' };
  return { date: local.toFormat('yyyy-MM-dd'), time: local.toFormat('HH:mm') };
}

/** Tanggal + jam lokal user -> ISO UTC (D-36). */
export function localDateTimeToIso(date: string, time: string, tz: string): string | null {
  if (!date) return null;
  const parsed = DateTime.fromISO(`${date}T${time || '00:00'}`, { zone: safeZone(tz) });
  return parsed.isValid ? parsed.toUTC().toISO() : null;
}

export function nowInTz(tz: string): DateTime {
  return DateTime.now().setZone(safeZone(tz));
}

/** Kunci sapaan berdasar jam lokal user: 'morning' | 'afternoon' | 'evening' | 'night'. */
export function greetingKey(tz: string, nowMs = Date.now()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = DateTime.fromMillis(nowMs, { zone: safeZone(tz) }).hour;
  if (hour >= 4 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'afternoon';
  if (hour >= 15 && hour < 19) return 'evening';
  return 'night';
}

export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first ?? name;
}

export interface Remaining {
  text: string;
  overdue: boolean;
}

/** "2 hari lagi" / "Terlambat 3 jam" (D-29, Issue 043). */
export function describeRemaining(targetMs: number, nowMs: number, t: TFunc): Remaining {
  const diff = targetMs - nowMs;
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / HOUR_MS);
  const days = Math.round(abs / DAY_MS);

  let unit: 'minute' | 'hour' | 'day' | 'week';
  let value: number;
  if (minutes < 60) {
    unit = 'minute';
    value = Math.max(1, minutes);
  } else if (hours < 24) {
    unit = 'hour';
    value = Math.max(1, hours);
  } else if (days < 14) {
    unit = 'day';
    value = Math.max(1, days);
  } else {
    unit = 'week';
    value = Math.max(1, Math.round(days / 7));
  }

  const key = overdue ? `time.overdue.${unit}` : `time.remaining.${unit}`;
  return { text: t(key, { value }), overdue };
}

export function describeDuration(hours: number, t: TFunc): string {
  if (!hours) return t('time.duration.none');
  if (hours < 1) return t('time.duration.minutes', { value: Math.round(hours * 60) });
  return t('time.duration.hours', { value: Number.isInteger(hours) ? hours : hours.toFixed(1) });
}
