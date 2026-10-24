/**
 * Jaga kontrak Issue 039: seluruh teks UI lewat i18n dan kamus id/en lengkap.
 * Aturan ESLint melarang JSXText multi-kata, tetapi kunci yang dirakit dinamis
 * (`t(`prefix.${x}`)`) tidak bisa dicek statis — keluarga kunci di bawah diverifikasi eksplisit.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import id from '../src/i18n/id.json';

/** `process.cwd()` = `apps/web` saat Vitest berjalan dari workspace ini. */
const SRC = join(process.cwd(), 'src');

/** String berpola `a.b` yang bukan kunci kamus (nama file, sentinel pemetaan error, istilah di komentar). */
const NOT_A_KEY = new Set([
  'server.message',
  'index.html',
  'sw.ts',
  'sw.js',
  'app.css',
  'navigator.language',
  'user.locale',
]);

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

function read(key: string, dict: unknown): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function flatten(dict: unknown, prefix = ''): string[] {
  return Object.entries(dict as Record<string, unknown>).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );
}

describe('kamus i18n', () => {
  const usedKeys = (() => {
    const keys = new Set<string>();
    for (const file of tsFiles(SRC)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/['"`]([a-z][a-z0-9]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g)) {
        const key = match[1];
        if (key && !NOT_A_KEY.has(key)) keys.add(key);
      }
    }
    return [...keys].sort();
  })();

  it('memuat seluruh kunci literal yang dipakai kode', () => {
    const missing = usedKeys.filter((key) => read(key, id) === undefined);
    expect(missing).toEqual([]);
  });

  it('memuat kunci literal yang sama di kamus Inggris', () => {
    const missing = usedKeys.filter((key) => read(key, en) === undefined);
    expect(missing).toEqual([]);
  });

  /** Kunci yang dirakit dinamis di kode (`t(`prefix.${x}`)`): setiap varian wajib ada. */
  const variants = (prefix: string, list: string[]) => list.map((item) => `${prefix}.${item}`);
  const expectedKeys = [
    ...variants('priority', ['TOP', 'HIGH', 'MEDIUM', 'LOW']),
    ...variants('roles', ['MAHASISWA', 'SUPERADMIN']),
    ...variants('categoryType', ['KULIAH', 'PRIBADI']),
    ...variants('tasks.status', ['TODO', 'IN_PROGRESS', 'DONE']),
    ...variants('tasks.type', ['FIXED_TIME', 'DEADLINE', 'ROUTINE']),
    ...variants('tasks.field', ['start', 'deadline', 'days']),
    ...variants('mood.label', ['1', '2', '3', '4', '5']),
    ...variants('mood.short', ['1', '2', '3', '4', '5']),
    ...variants('scale.importance', ['1', '2', '3', '4', '5']),
    ...variants('scale.difficulty', ['1', '2', '3', '4', '5']),
    ...variants('time.remaining', ['minute', 'hour', 'day', 'week']),
    ...variants('time.overdue', ['minute', 'hour', 'day', 'week']),
    ...variants('notifications.status', ['unsupported', 'needs-install', 'blocked', 'active', 'inactive', 'not-permission']),
    ...variants('notifications.hint', ['unsupported', 'needs-install', 'blocked', 'active', 'inactive', 'not-permission']),
    ...variants('settings.language', ['id', 'en']),
    ...variants('auth.register.strength', ['0', '1', '2', '3']),
    ...variants('dash.greeting', ['morning', 'afternoon', 'evening', 'night']),
    ...variants('rec.energy', ['veryHigh', 'high', 'medium', 'low', 'veryLow']),
    ...variants('rec.reason', ['urgentGentle', 'highEnergyComplex', 'light', 'fits', 'warmup', 'challenging']),
    ...[1, 2, 3, 4, 5, 6, 7].flatMap((day) => [`time.days.long${day}`, `time.days.short${day}`]),
  ];

  it('melengkapi seluruh varian kunci yang dirakit dinamis', () => {
    const missing: string[] = [];
    for (const key of expectedKeys) {
      if (read(key, id) === undefined) missing.push(`id: ${key}`);
      if (read(key, en) === undefined) missing.push(`en: ${key}`);
    }
    expect(missing).toEqual([]);
  });

  it('memuat kunci privasi dan self-care (diproduksi server)', () => {
    const tips = [
      'breathing', 'stretch', 'hydrateScreenBreak', 'talkToSomeone',
      'pomodoro', 'lightTaskFirst', 'music', 'shortBreaks',
    ];
    const sections = ['data', 'purpose', 'storage', 'sharing', 'rights'];
    const keys = [
      ...tips.map((tip) => `rec.selfCare.${tip}`),
      ...sections.flatMap((section) => [`privacy.${section}.heading`, `privacy.${section}.body`]),
      'rec.postpone.heavyLowEnergy',
    ];
    expect(keys.filter((key) => read(key, id) === undefined)).toEqual([]);
    expect(keys.filter((key) => read(key, en) === undefined)).toEqual([]);
  });

  it('kunci id dan en identik', () => {
    expect(flatten(id).sort()).toEqual(flatten(en).sort());
  });

  it('pemakaian placeholder interpolasi sama antara id dan en', () => {
    const params = (text: string) => [...text.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((m) => m[1]).sort().join(',');
    const mismatched: string[] = [];
    for (const key of flatten(id)) {
      const idText = read(key, id) ?? '';
      const enText = read(key, en) ?? '';
      if (params(idText) !== params(enText)) mismatched.push(`${key}: "${params(idText)}" vs "${params(enText)}"`);
    }
    expect(mismatched).toEqual([]);
  });
});
