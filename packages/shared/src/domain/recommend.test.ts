import { describe, expect, it } from 'vitest';
import type { DomainTask } from '../types.js';
import { ruleBasedProvider, runRecommendation } from './recommend.js';
import { localToUtc } from './time.js';

const TZ = 'Asia/Jakarta';
const NOW = localToUtc({ date: '2026-10-05', time: '08:00' }, TZ);
const H = 3_600_000;

let seq = 0;
function deadlineTask(hoursUntil: number, durationHours: number, importance: number, difficulty: number): DomainTask {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'DEADLINE',
    status: 'TODO',
    importance,
    difficulty,
    deadlineAt: new Date(NOW + hoursUntil * H),
    durationMinutes: durationHours * 60,
  };
}

describe('recommendation engine (Issue 019)', () => {
  it('mood 5 memilih tugas kompleks (fit tinggi untuk difficulty/duration besar)', () => {
    const heavy = deadlineTask(72, 5, 4, 5); // complexity tinggi
    const light = deadlineTask(72, 0.5, 2, 1); // complexity rendah
    const result = ruleBasedProvider.recommend({ mood: 5, tasks: [heavy, light], now: NOW, tz: TZ });
    const heavyItem = result.items.find((i) => i.task.id === heavy.id);
    const lightItem = result.items.find((i) => i.task.id === light.id);
    expect(heavyItem).toBeDefined();
    expect(lightItem).toBeDefined();
    expect(heavyItem!.matchPercent).toBeGreaterThan(lightItem!.matchPercent);
  });

  it('mood 2 menaruh tugas berat dengan deadline > 48 jam di postpone', () => {
    const heavy = deadlineTask(96, 5, 3, 5); // complexity >= 3.2, > 48h, bukan TOP
    const result = ruleBasedProvider.recommend({ mood: 2, tasks: [heavy], now: NOW, tz: TZ });
    expect(result.postpone.some((p) => p.task.id === heavy.id)).toBe(true);
    expect(result.items.some((i) => i.task.id === heavy.id)).toBe(false);
  });

  it('mood 1 hanya mengembalikan TOP atau sisa < 24 jam', () => {
    const top = deadlineTask(2, 1, 5, 5); // sangat mendesak -> TOP
    const farLow = deadlineTask(240, 1, 2, 2); // jauh & ringan -> bukan TOP, > 24 jam
    const result = ruleBasedProvider.recommend({ mood: 1, tasks: [top, farLow], now: NOW, tz: TZ });
    const ids = result.items.map((i) => i.task.id);
    expect(ids).toContain(top.id);
    expect(ids).not.toContain(farLow.id);
  });

  it('daftar kosong -> items []', () => {
    const result = ruleBasedProvider.recommend({ mood: 3, tasks: [], now: NOW, tz: TZ });
    expect(result.items).toEqual([]);
  });

  it('top pick selalu item pertama', () => {
    const a = deadlineTask(48, 2, 5, 3);
    const b = deadlineTask(100, 1, 1, 1);
    const result = ruleBasedProvider.recommend({ mood: 3, tasks: [a, b], now: NOW, tz: TZ });
    expect(result.items[0]?.isTopPick).toBe(true);
    expect(result.items.slice(1).every((i) => !i.isTopPick)).toBe(true);
  });

  it('selfCare level 1 untuk mood 1, level 2 untuk mood 2, null selainnya', () => {
    expect(ruleBasedProvider.recommend({ mood: 1, tasks: [], now: NOW, tz: TZ }).selfCare.level).toBe(1);
    expect(ruleBasedProvider.recommend({ mood: 2, tasks: [], now: NOW, tz: TZ }).selfCare.level).toBe(2);
    expect(ruleBasedProvider.recommend({ mood: 3, tasks: [], now: NOW, tz: TZ }).selfCare.level).toBeNull();
  });

  it('performa: 500 tugas < 50ms', () => {
    const tasks = Array.from({ length: 500 }, (_, i) => deadlineTask(10 + i, 1 + (i % 5), 1 + (i % 5), 1 + (i % 5)));
    const start = performance.now();
    ruleBasedProvider.recommend({ mood: 3, tasks, now: NOW, tz: TZ });
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('fallback terpanggil saat provider utama error', async () => {
    const failingProvider = {
      recommend(): never {
        throw new Error('boom');
      },
    };
    const task = deadlineTask(10, 1, 3, 3);
    const result = await runRecommendation(failingProvider, { mood: 3, tasks: [task], now: NOW, tz: TZ });
    expect(result.items.length).toBeGreaterThan(0);
  });
});
