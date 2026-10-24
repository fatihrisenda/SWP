/**
 * Klien API terpusat (Issue 037).
 * - base `/api/v1`, `credentials: 'same-origin'`, timeout 15 dtk
 * - parsing seragam `{ error: { code, message, fields } }` -> `ApiError`
 * - tidak ada token di JS (sesi = cookie HttpOnly)
 * - 401 di luar endpoint auth -> event `swp:unauthorized` (diproses sekali oleh AuthProvider)
 */
export const API_BASE = '/api/v1';
export const UNAUTHORIZED_EVENT = 'swp:unauthorized';
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly extra?: Record<string, unknown>;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    opts: { fields?: Record<string, string>; extra?: Record<string, unknown>; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = opts.fields;
    this.extra = opts.extra;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export class NetworkError extends Error {
  override readonly cause?: unknown;

  constructor(message = 'Network error', cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
}

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/me'];

let unauthorizedAt = 0;

function emitUnauthorized(): void {
  const now = Date.now();
  // Hindari loop: satu event per 2 detik meski ada banyak request 401.
  if (now - unauthorizedAt < 2_000) return;
  unauthorizedAt = now;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `${url}?${parts.join('&')}` : url;
}

/** Simpan `extra` tak dikenal dari body error (mis. `taskCount` pada CATEGORY_IN_USE). */
function pickExtra(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const skip = new Set(['code', 'message', 'fields']);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (!skip.has(k)) extra[k] = v;
  return Object.keys(extra).length ? extra : undefined;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onOuterAbort);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      credentials: 'same-origin',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (err) {
    if (options.signal?.aborted) throw err;
    throw new NetworkError('offline', err);
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener('abort', onOuterAbort);
  }

  if (response.status === 204) {
    if (!response.ok) throw new ApiError(response.status, 'INTERNAL', 'Terjadi kesalahan pada server');
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (!response.ok) {
    const body = (parsed ?? {}) as Record<string, unknown>;
    const errBody = (body.error ?? body) as Record<string, unknown>;
    const code = typeof errBody.code === 'string' ? errBody.code : 'INTERNAL';
    const message = typeof errBody.message === 'string' ? errBody.message : 'Terjadi kesalahan pada server';
    const fields = errBody.fields as Record<string, string> | undefined;
    const retryHeader = Number(response.headers.get('Retry-After'));
    if (response.status === 401 && !AUTH_ENDPOINTS.some((p) => path.startsWith(p))) emitUnauthorized();
    throw new ApiError(response.status, code, message, {
      fields,
      extra: pickExtra(errBody),
      retryAfterSeconds: Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined,
    });
  }

  // HTML berarti server tidak mengembalikan JSON (proxy salah tujuan / halaman 404) -> error jelas.
  if (parsed === undefined && response.headers.get('content-type')?.includes('text/html')) {
    throw new NetworkError('bad-response');
  }
  return parsed as T;
}

export function isNetworkError(err: unknown): err is NetworkError {
  return err instanceof NetworkError || (err instanceof TypeError && /fetch|network/i.test(err.message));
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === 'AbortError' : (err as { name?: string })?.name === 'AbortError';
}
