/** Ambang label prioritas (D-27). Skor maksimum = 10 * 5 * 1.2 = 60. */
export const PRIORITY_THRESHOLDS = { TOP: 36, HIGH: 24, MEDIUM: 12 } as const;

export const BUFFER_MINUTES = 30;
export const DEFAULT_CAPACITY_HOURS = 8;
export const REMINDER_LEAD_HOURS = 24;
export const ROUTINE_LEAD_MINUTES = 30;
export const CONFLICT_HORIZON_DAYS = 14;

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** 12 warna palet kategori (dari app.css/app.js lama). */
export const CATEGORY_PALETTE = [
  '#2563EB',
  '#DC2626',
  '#EA580C',
  '#D97706',
  '#CA8A04',
  '#65A30D',
  '#16A34A',
  '#059669',
  '#0D9488',
  '#0891B2',
  '#7C3AED',
  '#C026D3',
] as const;

/** Kategori default dibuat saat register (D-10). */
export const DEFAULT_CATEGORIES = [
  { name: 'Quiz', type: 'KULIAH', color: '#DC2626' },
  { name: 'Assessment', type: 'KULIAH', color: '#EA580C' },
  { name: 'Tugas Harian', type: 'KULIAH', color: '#2563EB' },
  { name: 'Praktikum', type: 'KULIAH', color: '#7C3AED' },
  { name: 'Presentasi', type: 'KULIAH', color: '#0D9488' },
  { name: 'UTS/UAS', type: 'KULIAH', color: '#B91C1C' },
  { name: 'Olahraga', type: 'PRIBADI', color: '#16A34A' },
  { name: 'Pekerjaan', type: 'PRIBADI', color: '#0891B2' },
  { name: 'Pribadi', type: 'PRIBADI', color: '#CA8A04' },
  { name: 'Belanja', type: 'PRIBADI', color: '#C026D3' },
  { name: 'Sosial', type: 'PRIBADI', color: '#059669' },
] as const;

/** Batas panjang field (D-32). */
export const LIMITS = {
  title: { min: 1, max: 100 },
  description: { max: 1000 },
  userName: { min: 3, max: 100 },
  categoryName: { min: 1, max: 50 },
  email: { max: 254 },
  password: { min: 8, max: 128 },
  maxCategoriesPerUser: 50,
} as const;

export const SELF_CARE_TIPS_LEVEL_1 = [
  'rec.selfCare.breathing',
  'rec.selfCare.stretch',
  'rec.selfCare.hydrateScreenBreak',
  'rec.selfCare.talkToSomeone',
] as const;

export const SELF_CARE_TIPS_LEVEL_2 = [
  'rec.selfCare.pomodoro',
  'rec.selfCare.lightTaskFirst',
  'rec.selfCare.music',
  'rec.selfCare.shortBreaks',
] as const;
