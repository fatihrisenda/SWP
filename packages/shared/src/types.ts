export type Role = 'MAHASISWA' | 'SUPERADMIN';
export type CategoryType = 'KULIAH' | 'PRIBADI';
export type TaskType = 'FIXED_TIME' | 'DEADLINE' | 'ROUTINE';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type PriorityLabel = 'TOP' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Locale = 'id' | 'en';

/**
 * Representasi tugas yang dipakai seluruh fungsi domain (murni/pure).
 * Dibuat independen dari model Prisma agar `packages/shared` tidak bergantung pada database
 * dan bisa dipakai langsung di frontend (pratinjau prioritas, dsb.).
 */
export interface DomainTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  importance: number; // 1..5
  difficulty: number; // 1..5
  createdAt?: Date;
  /** FIXED_TIME */
  startAt?: Date | null;
  endAt?: Date | null;
  /** DEADLINE */
  deadlineAt?: Date | null;
  /** DEADLINE (jam, lewat durationMinutes/60) & ROUTINE (durasi per sesi) */
  durationMinutes?: number | null;
  /** ROUTINE: ISO 1=Senin..7=Minggu */
  routineDays?: number[];
  /** ROUTINE: menit sejak tengah malam, 0..1439, di zona waktu user */
  routineStartMinute?: number | null;
}
