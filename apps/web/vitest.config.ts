import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Origin uji sengaja bukan `localhost:3000` (punya API dev) supaya request yang
    // lolos dari MSW gagal keras, bukan menyentuh server/database asli.
    environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
    globals: true,
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Issue 061 tidak menetapkan angka % untuk FE (angka 90 %/80 % milik `shared` dan
      // `apps/api`); yang diminta adalah kelima permukaan komponen di bawah diuji unit.
      // Halaman, shell PWA, dan push diverifikasi lewat build + E2E/manual (Issue 053/062/063).
      include: [
        'src/components/TaskForm.tsx',
        'src/components/TaskList.tsx',
        'src/components/TaskItem.tsx',
        'src/components/ConflictDialog.tsx',
        'src/components/ui/TriStateCheckbox.tsx',
        'src/pages/LoginPage.tsx',
        'src/pages/RegisterPage.tsx',
      ],
      thresholds: { lines: 80, statements: 80, functions: 60 },
    },
  },
});
