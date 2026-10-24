import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Alias '@' -> src (Issue 034 langkah 2).
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // `host` sengaja tidak diset: dev server hanya listen pada localhost,
    // sehingga tidak ada DNS-rebinding/akses jaringan (allowedHosts aman, Issue 034).
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: {
    target: ['chrome90', 'firefox88', 'safari15'],
    sourcemap: 'hidden',
    outDir: 'dist',
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      // Didaftarkan manual lewat `virtual:pwa-register` di main.tsx (tanpa skrip inline -> CSP aman).
      injectRegister: false,
      // Manifest ditulis manual (Issue 052) agar dapat diaudit baris per baris.
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      devOptions: { enabled: false },
    }),
  ],
});
