import type { DomainTask } from '../types.js';
import { isHighPriority, taskDurationHours } from './priority.js';

export interface Analytics {
  total: number;
  done: number;
  active: number;
  totalHours: number;
  highPriority: number;
}

/**
 * Definisi kartu analytics (D-08): Total = semua tugas; Selesai = DONE; Total Waktu = durasi tugas
 * belum selesai; Prioritas Tinggi = tugas belum selesai berlabel TOP/HIGH.
 */
export function computeAnalytics(tasks: DomainTask[], now: number, tz: string): Analytics {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const active = total - done;
  const activeTasks = tasks.filter((t) => t.status !== 'DONE');
  const totalHours = activeTasks.reduce((sum, t) => sum + taskDurationHours(t), 0);
  const highPriority = activeTasks.filter((t) => isHighPriority(t, now, tz)).length;
  return { total, done, active, totalHours: Math.round(totalHours * 10) / 10, highPriority };
}
