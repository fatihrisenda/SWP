/** Draf form tugas di `localStorage` (NFR-03.2 / Issue 045 langkah 9). Hanya draf form — tidak ada data lain. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  savedAt: number;
  value: T;
}

export function draftKey(userId: string | undefined): string {
  return `swp_draft_${userId ?? 'anon'}`;
}

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function saveDraft<T>(userId: string | undefined, value: T): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(draftKey(userId), JSON.stringify({ savedAt: Date.now(), value } satisfies DraftEnvelope<T>));
  } catch {
    /* kuota penuh / mode privat: draf dianggap tidak ada */
  }
}

export function loadDraft<T>(userId: string | undefined): T | undefined {
  const store = storage();
  if (!store) return undefined;
  const raw = store.getItem(draftKey(userId));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (typeof parsed?.savedAt !== 'number' || Date.now() - parsed.savedAt > TTL_MS) {
      store.removeItem(draftKey(userId));
      return undefined;
    }
    return parsed.value;
  } catch {
    store.removeItem(draftKey(userId));
    return undefined;
  }
}

export function hasDraft(userId: string | undefined): boolean {
  return loadDraft(userId) !== undefined;
}

export function clearDraft(userId: string | undefined): void {
  storage()?.removeItem(draftKey(userId));
}
