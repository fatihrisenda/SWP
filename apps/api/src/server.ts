import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startWorker } from './worker/index.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API server started');
});

// Opsional: jalankan worker reminder di proses yang sama (dev/single-instance, Issue 031).
const workerHandle = env.RUN_WORKER ? startWorker() : null;

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down gracefully');
  workerHandle?.stop();
  server.close(() => {
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
  // Paksa keluar bila ada koneksi yang tidak mau ditutup.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
