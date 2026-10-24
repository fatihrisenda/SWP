/** Setup Vitest FE: matchers jest-dom, siklus MSW, dan i18n terkunci ke Indonesia (kopi SKPL). */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { initI18n } from '../src/lib/i18n';
import { resetDb } from './handlers';
import { server } from './server';

afterEach(() => {
  server.resetHandlers();
  cleanup();
});
beforeEach(() => resetDb());

/**
 * Dua penyesuaian agar `fetch` klien (URL relatif `/api/v1/...`) jalan di Node/jsdom:
 * 1. URL relatif dibuat absolut terhadap lokasi jsdom.
 * 2. `signal` dibuang — `AbortController` punyanya jsdom bukan instance `AbortSignal`
 *    versi Node, dan `fetch` Node (dipakai MSW) menolaknya dengan TypeError.
 * Dibungkus setelah `listen()` agar interceptor MSW tetap berada di jalur request.
 */
let nodeFetch: typeof globalThis.fetch | undefined;

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  const intercepted = globalThis.fetch.bind(globalThis);
  nodeFetch = intercepted;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' && input.startsWith('/') ? new URL(input, window.location.href).toString() : input;
    if (!init?.signal) return intercepted(url as RequestInfo, init);
    const { signal: _ignored, ...rest } = init;
    return intercepted(url as RequestInfo, rest);
  }) as typeof globalThis.fetch;
});

afterAll(() => {
  if (nodeFetch) globalThis.fetch = nodeFetch;
  server.close();
});

initI18n('id');
