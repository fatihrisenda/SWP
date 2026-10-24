import { DateTime } from 'luxon';
import { taskDurationHours, type DomainTask, type Locale } from '@swp/shared';
import type { Category } from '@prisma/client';

export interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  taskId: string;
}

interface ReminderNotificationInput {
  task: DomainTask;
  taskTitle: string;
  category: Pick<Category, 'type'>;
  eventAt: number;
  timezone: string;
  locale: Locale;
  now: number;
}

/** Format `08.00` (id, titik) atau `08:00` (en, titik dua). */
function formatTime(dt: DateTime, locale: Locale): string {
  return locale === 'id' ? dt.toFormat('HH.mm') : dt.toFormat('HH:mm');
}

function formatDate(dt: DateTime, locale: Locale): string {
  return locale === 'id' ? dt.setLocale('id').toFormat("cccc, d LLL") : dt.setLocale('en').toFormat('ccc, d LLL');
}

function roundHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Payload notifikasi Web Push terlokalisasi (Issue 032). Tidak ada judul clickbait atau hitung mundur
 * menekan (SKPL 2.5c); `tag` per-tugas agar notifikasi baru menggantikan yang lama.
 */
export function buildReminderPayload({
  task,
  taskTitle,
  category,
  eventAt,
  timezone,
  locale,
  now,
}: ReminderNotificationInput): NotificationPayload {
  const dt = DateTime.fromMillis(eventAt, { zone: timezone });
  const hoursLeft = (eventAt - now) / 3_600_000;
  const soon = hoursLeft <= 2;
  const durationHours = roundHours(taskDurationHours(task));
  const dateStr = formatDate(dt, locale);
  const timeStr = formatTime(dt, locale);
  const titlePrefix = locale === 'id' ? titleId(task.type, soon) : titleEn(task.type, soon);
  const title = `${titlePrefix}: ${taskTitle}`;

  const bodyId = `${dateStr} ${timeStr} \u00b7 estimasi ${durationHours} jam. Ketuk untuk membuka.`;
  const bodyEn = `${dateStr} ${timeStr} \u00b7 est. ${durationHours}h. Tap to open.`;

  const path = category.type === 'KULIAH' ? '/tugas-kuliah' : '/tugas-pribadi';

  return {
    title,
    body: locale === 'id' ? bodyId : bodyEn,
    tag: `task-${task.id}`,
    url: `${path}?open=${task.id}`,
    taskId: task.id,
  };
}

function titleId(type: DomainTask['type'], soon: boolean): string {
  if (type === 'DEADLINE') return soon ? '\u23f0 Deadline sebentar lagi' : '\u23f0 Deadline besok';
  if (type === 'FIXED_TIME') return soon ? '\u23f0 Akan segera dimulai' : '\u23f0 Akan dimulai besok';
  return '\u23f0 Rutin sebentar lagi';
}

function titleEn(type: DomainTask['type'], soon: boolean): string {
  if (type === 'DEADLINE') return soon ? '\u23f0 Deadline coming up soon' : '\u23f0 Deadline tomorrow';
  if (type === 'FIXED_TIME') return soon ? '\u23f0 Starting soon' : '\u23f0 Starting tomorrow';
  return '\u23f0 Routine starting soon';
}
