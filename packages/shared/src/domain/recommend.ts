import { SELF_CARE_TIPS_LEVEL_1, SELF_CARE_TIPS_LEVEL_2 } from '../constants.js';
import type { DomainTask } from '../types.js';
import { eventTime, priority, taskDurationHours } from './priority.js';

const HOUR_MS = 3_600_000;

type MoodLevel = 1 | 2 | 3 | 4 | 5;

const ENERGY_RANGES: Record<MoodLevel, [number, number]> = {
  5: [3, 5],
  4: [2.5, 4.5],
  3: [2, 3.5],
  2: [1, 2.5],
  1: [1, 1.6],
};

const ENERGY_KEYS: Record<MoodLevel, string> = {
  5: 'rec.energy.veryHigh',
  4: 'rec.energy.high',
  3: 'rec.energy.medium',
  2: 'rec.energy.low',
  1: 'rec.energy.veryLow',
};

/** Kompleksitas = 0.7*difficulty + 0.3*(min(durasiJam,6)/6*5), clamp 1..5 (SKPL 4.5.2-B). */
export function complexity(task: DomainTask): number {
  const durScore = (Math.min(taskDurationHours(task), 6) / 6) * 5;
  const raw = task.difficulty * 0.7 + durScore * 0.3;
  return Math.min(5, Math.max(1, Math.round(raw * 10) / 10));
}

export interface RecommendationItem {
  task: DomainTask;
  matchPercent: number;
  reasonKey: string;
  reasonParams: Record<string, unknown>;
  isTopPick: boolean;
}

export interface PostponeItem {
  task: DomainTask;
  reasonKey: string;
  reasonParams: Record<string, unknown>;
}

export interface RecommendationResult {
  energyKey: string;
  items: RecommendationItem[];
  postpone: PostponeItem[];
  selfCare: { level: 1 | 2 | null; tipKeys: readonly string[] };
}

export interface RecommendationInput {
  mood: MoodLevel;
  tasks: DomainTask[];
  now: number;
  tz: string;
}

export interface RecommendationProvider {
  recommend(input: RecommendationInput): RecommendationResult;
}

/** Satu-satunya implementasi saat ini (D-15: Face Emotion Detection tidak dibuat). */
export const ruleBasedProvider: RecommendationProvider = {
  recommend({ mood, tasks, now, tz }) {
    const [lo, hi] = ENERGY_RANGES[mood];

    const active = tasks.filter((t) => {
      if (t.status === 'DONE') return false;
      if (t.type === 'FIXED_TIME' && t.endAt && t.endAt.getTime() < now) return false;
      return true;
    });

    const items: RecommendationItem[] = [];
    const postpone: PostponeItem[] = [];

    for (const task of active) {
      const c = complexity(task);
      const p = priority(task, now, tz);
      const ev = eventTime(task, now, tz);
      const hoursLeft = ev == null ? Infinity : (ev - now) / HOUR_MS;

      if (mood <= 2 && c >= 3.2 && hoursLeft > 48 && p.label !== 'TOP') {
        postpone.push({
          task,
          reasonKey: 'rec.postpone.heavyLowEnergy',
          reasonParams: { complexity: c, days: Math.round(hoursLeft / 24) },
        });
        continue;
      }
      if (mood === 1 && !(p.label === 'TOP' || hoursLeft < 24)) continue;

      const dist = c < lo ? lo - c : c > hi ? c - hi : 0;
      const fit = Math.max(0, 1 - dist / 2);
      const score = (p.score / 60) * 0.55 + fit * 0.45;

      let reasonKey: string;
      if (mood === 1) reasonKey = 'rec.reason.urgentGentle';
      else if (fit >= 0.99 && c >= 3.2) reasonKey = 'rec.reason.highEnergyComplex';
      else if (fit >= 0.99 && c <= 2.3) reasonKey = 'rec.reason.light';
      else if (fit >= 0.99) reasonKey = 'rec.reason.fits';
      else if (c < lo) reasonKey = 'rec.reason.warmup';
      else reasonKey = 'rec.reason.challenging';

      items.push({
        task,
        matchPercent: Math.round(score * 100),
        reasonKey,
        reasonParams: { complexity: c, topPriority: p.label === 'TOP', dueIn24h: hoursLeft < 24 },
        isTopPick: false,
      });
    }

    items.sort((a, b) => b.matchPercent - a.matchPercent);
    const top = items.slice(0, 5);
    if (top[0]) top[0] = { ...top[0], isTopPick: true };

    const selfCare =
      mood === 1
        ? { level: 1 as const, tipKeys: SELF_CARE_TIPS_LEVEL_1 }
        : mood === 2
          ? { level: 2 as const, tipKeys: SELF_CARE_TIPS_LEVEL_2 }
          : { level: null, tipKeys: [] as const };

    return { energyKey: ENERGY_KEYS[mood], items: top, postpone: postpone.slice(0, 3), selfCare };
  },
};

/**
 * Jalankan provider terkonfigurasi; bila melempar error atau melebihi `timeoutMs` → pakai `fallback`
 * (FR-06.5). Saat ini provider default sudah rule-based, tetapi jalur fallback tetap diimplementasikan.
 */
export async function runRecommendation(
  provider: RecommendationProvider,
  input: RecommendationInput,
  fallback: RecommendationProvider = ruleBasedProvider,
  timeoutMs = 2000,
): Promise<RecommendationResult> {
  try {
    return await Promise.race([
      Promise.resolve().then(() => provider.recommend(input)),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('recommendation_timeout')), timeoutMs);
      }),
    ]);
  } catch {
    return fallback.recommend(input);
  }
}
