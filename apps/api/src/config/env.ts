import 'dotenv/config';
import { z } from 'zod';

const boolString = z
  .enum(['true', 'false'])
  .optional()
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_ORIGIN: z.string().url(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    DATABASE_URL: z.string().min(1).startsWith('postgresql://', 'DATABASE_URL harus postgresql://'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 karakter'),
    SESSION_COOKIE_NAME: z.string().min(1).default('swp_session'),
    SESSION_TTL_DEFAULT_HOURS: z.coerce.number().positive().default(12),
    SESSION_TTL_REMEMBER_DAYS: z.coerce.number().positive().default(30),
    ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(19456),
    ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
    VAPID_PUBLIC_KEY: z.string().optional().default(''),
    VAPID_PRIVATE_KEY: z.string().optional().default(''),
    VAPID_SUBJECT: z.string().default('mailto:admin@contoh.id'),
    REMINDER_POLL_SECONDS: z.coerce.number().int().positive().default(30),
    RUN_WORKER: boolString,
    REMINDER_LEAD_OVERRIDE_MINUTES: z.coerce.number().int().positive().optional(),
    SEED_ADMIN_NAME: z.string().optional().default(''),
    SEED_ADMIN_EMAIL: z.string().optional().default(''),
    SEED_ADMIN_PASSWORD: z.string().optional().default(''),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && !v.APP_ORIGIN.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'APP_ORIGIN harus https:// pada production',
        path: ['APP_ORIGIN'],
      });
    }
    if (v.NODE_ENV === 'production' && v.RUN_WORKER && (!v.VAPID_PUBLIC_KEY || !v.VAPID_PRIVATE_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY wajib diisi saat RUN_WORKER=true di production',
        path: ['VAPID_PUBLIC_KEY'],
      });
    }
  });

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Konfigurasi environment tidak valid:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
