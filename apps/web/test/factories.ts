/** Factory data uji (Issue 061): tanpa bergantung urutan test, waktu dikontrol lewat argumen. */
import type { CategoryType, PriorityLabel, TaskStatus, TaskType } from '@swp/shared';
import type { AdminUserDto, AnalyticsDto, CategoryDto, ConflictOpponentDto, ConflictResultDto, DashboardDto, RecommendationsDto, TaskDto, UserDto } from '../src/lib/dto';

export function makeUser(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: 'user-1',
    name: 'Budi Siswa',
    email: 'budi@example.test',
    role: 'MAHASISWA',
    timezone: 'Asia/Jakarta',
    locale: 'id',
    dailyCapacityHours: 8,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAdminUser(overrides: Partial<AdminUserDto> = {}): AdminUserDto {
  return {
    id: 'user-2',
    name: 'Sari Mahasiswi',
    email: 'sari@example.test',
    role: 'MAHASISWA',
    createdAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Id kategori berbentuk UUID karena skema klien (`taskInputSchema`) memvalidasi
 * `categoryId` dengan `z.string().uuid()` — id opaque akan ditolak form tugas.
 */
export const CATEGORY_ID = {
  quiz: '11111111-1111-4111-8111-111111111111',
  praktikum: '22222222-2222-4222-8222-222222222222',
  olahraga: '33333333-3333-4333-8333-333333333333',
} as const;

export function makeCategory(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return {
    id: CATEGORY_ID.quiz,
    name: 'Quiz',
    color: '#DC2626',
    type: 'KULIAH' as CategoryType,
    taskCount: 2,
    ...overrides,
  };
}

const PRIORITY_BY_LABEL: Record<PriorityLabel, number> = { TOP: 40, HIGH: 27.4, MEDIUM: 14, LOW: 4 };

export function makeTask(overrides: Partial<TaskDto> = {}): TaskDto {
  const label: PriorityLabel = overrides.priority?.label ?? 'HIGH';
  return {
    id: 'task-1',
    title: 'Quiz Matematika Diskrit',
    description: 'Bab 3–5, soal genap.',
    type: 'DEADLINE' as TaskType,
    status: 'TODO' as TaskStatus,
    category: { id: CATEGORY_ID.quiz, name: 'Quiz', color: '#DC2626', type: 'KULIAH' },
    importance: 5,
    difficulty: 3,
    deadlineAt: '2026-10-26T10:00:00.000Z',
    durationHours: 2,
    nextEventAt: '2026-10-26T10:00:00.000Z',
    priority: { label, score: PRIORITY_BY_LABEL[label], urgency: 8.1 },
    reminderAt: '2026-10-25T10:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAnalytics(overrides: Partial<AnalyticsDto> = {}): AnalyticsDto {
  return { total: 12, done: 4, active: 8, totalHours: 26.5, highPriority: 3, ...overrides };
}

export function makeDashboard(overrides: Partial<DashboardDto> = {}): DashboardDto {
  return {
    analytics: makeAnalytics(),
    nearest: [
      {
        id: 'task-1',
        title: 'Quiz Matematika Diskrit',
        category: { name: 'Quiz', color: '#DC2626' },
        type: 'DEADLINE',
        eventAt: '2026-10-26T10:00:00.000Z',
        priority: { label: 'HIGH', score: 27.4, urgency: 8.1 },
        isOverdue: false,
      },
    ],
    dueWithin24h: 2,
    mood: null,
    topPick: null,
    ...overrides,
  };
}

/** Hasil `POST /tasks/conflicts` — `any:false` bila tidak di-override. */
export function makeConflicts(overrides: Partial<ConflictResultDto> = {}): ConflictResultDto {
  return {
    collisions: [],
    buffers: [],
    overload: [],
    suggestedSlot: null,
    lowPriorityCandidate: null,
    any: false,
    ...overrides,
  };
}

/** Tugas "lawan" dalam hasil cek konflik. */
export function makeOpponent(overrides: Partial<ConflictOpponentDto> = {}): ConflictOpponentDto {
  return {
    id: 'task-x',
    title: 'Meeting dosen',
    priority: { label: 'LOW', score: 4, urgency: 2 },
    ...overrides,
  };
}

export function makeRecommendations(overrides: Partial<RecommendationsDto> = {}): RecommendationsDto {
  return {
    mood: 3,
    energyKey: 'rec.energy.medium',
    items: [
      {
        task: {
          id: 'task-1',
          title: 'Quiz Matematika Diskrit',
          category: { id: CATEGORY_ID.quiz, name: 'Quiz', color: '#DC2626', type: 'KULIAH' },
          type: 'DEADLINE',
          eventAt: '2026-10-26T10:00:00.000Z',
          durationHours: 2,
          difficulty: 3,
          importance: 5,
          priority: { label: 'HIGH', score: 27.4, urgency: 8.1 },
        },
        matchPercent: 92,
        reasonKey: 'rec.reason.fits',
        reasonParams: { complexity: 3 },
        isTopPick: true,
      },
    ],
    postpone: [],
    selfCare: { level: null, tipKeys: [] },
    ...overrides,
  };
}
