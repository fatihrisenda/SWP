/** i18n (Issue 039): Indonesia default, Inggris opsional. Tidak ada teks UI di tempat lain. */
import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import id from '../i18n/id.json';

export const LANG_STORAGE_KEY = 'swp_lang';
export const SUPPORTED_LANGS = ['id', 'en'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export function normalizeLang(value: string | null | undefined): AppLang | undefined {
  if (!value) return undefined;
  const short = value.trim().toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGS as readonly string[]).includes(short) ? (short as AppLang) : undefined;
}

function readStoredLang(): string | null {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLang(lang: AppLang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* mode privat: abaikan, sesi tetap jalan */
  }
}

/** Urutan: `user.locale` -> `localStorage` -> `navigator.language` -> `id` (D-25). */
export function resolveLanguage(userLocale?: string | null): AppLang {
  return normalizeLang(userLocale) ?? normalizeLang(readStoredLang()) ?? normalizeLang(navigator.language) ?? 'id';
}

let instance: I18nInstance | undefined;

export function initI18n(userLocale?: string | null): I18nInstance {
  if (instance) return instance;
  const lng = resolveLanguage(userLocale);
  instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources: { id: { translation: id }, en: { translation: en } },
    lng,
    fallbackLng: 'id',
    interpolation: { escapeValue: false }, // React sudah meng-escape
    returnNull: false,
  });
  applyDocumentLang(instance.language);
  return instance;
}

export function getI18n(): I18nInstance {
  return instance ?? initI18n();
}

export function applyDocumentLang(lang: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('lang', normalizeLang(lang) ?? 'id');
}

export async function changeLanguage(lang: AppLang): Promise<void> {
  const i18n = getI18n();
  await i18n.changeLanguage(lang);
  writeStoredLang(lang);
  applyDocumentLang(lang);
}

/** Digunakan oleh kode non-komponen (mis. format sisa waktu di luar render). */
export function t(key: string, options?: Record<string, unknown>): string {
  return getI18n().t(key, options);
}
