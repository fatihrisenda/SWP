import { describe, expect, it } from 'vitest';
import { addDays, isValidTimezone, localToUtc, minutesSinceMidnight, startOfDay, weekdayISO } from './time.js';

describe('time utilities (Issue 016)', () => {
  it('weekdayISO: 1=Senin..7=Minggu', () => {
    // 2026-10-05 adalah Senin
    const monday = localToUtc({ date: '2026-10-05', time: '12:00' }, 'Asia/Jakarta');
    expect(weekdayISO(monday, 'Asia/Jakarta')).toBe(1);
    const sunday = localToUtc({ date: '2026-10-11', time: '12:00' }, 'Asia/Jakarta');
    expect(weekdayISO(sunday, 'Asia/Jakarta')).toBe(7);
  });

  it('startOfDay/addDays konsisten lintas zona', () => {
    const ms = localToUtc({ date: '2026-10-05', time: '23:30' }, 'Asia/Jayapura');
    const start = startOfDay(ms, 'Asia/Jayapura');
    expect(start).toBe(localToUtc({ date: '2026-10-05', time: '00:00' }, 'Asia/Jayapura'));
    const nextDay = addDays(start, 1, 'Asia/Jayapura');
    expect(nextDay).toBe(localToUtc({ date: '2026-10-06', time: '00:00' }, 'Asia/Jayapura'));
  });

  it('melewati DST (America/New_York)', () => {
    // DST berakhir 1 Nov 2026 di New York
    const beforeDst = localToUtc({ date: '2026-10-30', time: '12:00' }, 'America/New_York');
    const afterDays = addDays(beforeDst, 3, 'America/New_York');
    expect(minutesSinceMidnight(afterDays, 'America/New_York')).toBe(12 * 60);
  });

  it('isValidTimezone', () => {
    expect(isValidTimezone('Asia/Jakarta')).toBe(true);
    expect(isValidTimezone('Not/AZone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});
