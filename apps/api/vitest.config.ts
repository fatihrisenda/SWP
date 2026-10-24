import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      provider: 'v8',
      // Kode produk saja: `server.ts` (bootstrap proses) dan `prisma/seed*.ts` (perangkat CLI)
      // tidak dihitung sebagai objek pengujian integrasi Issue 061.
      include: ['src/**'],
      exclude: ['src/server.ts', 'test/**', 'vitest.config.ts'],
      thresholds: { lines: 80, statements: 80, functions: 80 },
    },
  },
});
