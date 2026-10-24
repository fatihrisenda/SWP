import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { checkOrigin, noStore, requireJson } from './middleware/security.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { categoriesRouter } from './routes/categories.js';
import { tasksRouter } from './routes/tasks.js';
import { moodsRouter } from './routes/moods.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { dashboardRouter } from './routes/dashboard.js';
import { pushRouter } from './routes/push.js';
import { adminRouter } from './routes/admin.js';

/** Bangun aplikasi Express tanpa `listen()` agar mudah dites dengan Supertest (Issue 006). */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      hsts: env.NODE_ENV === 'production',
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  app.use(globalLimiter);
  app.use(cookieParser());

  const v1 = express.Router();
  v1.use(checkOrigin);
  v1.use(requireJson);
  v1.use(express.json({ limit: '100kb', strict: true }));
  v1.use(noStore);

  // Tiap router membatasi guard-nya ke prefix path sendiri: `router.use(fn)` tanpa path
  // akan ikut berjalan untuk semua rute di bawah `v1`, sehingga guard MAHASISWA
  // memblokir /admin (dan sebaliknya).
  v1.use(healthRouter);
  v1.use(authRouter);
  v1.use(meRouter);
  v1.use(categoriesRouter);
  v1.use(tasksRouter);
  v1.use(moodsRouter);
  v1.use(recommendationsRouter);
  v1.use(dashboardRouter);
  v1.use(pushRouter);
  v1.use(adminRouter);

  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
