import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Logger pino dengan redaksi data sensitif (Issue 006): cookie, authorization,
 * password/passwordHash, dan token tidak pernah ditulis ke log.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'req.body.confirmPassword',
      'req.body.currentPassword',
      'req.body.newPassword',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      '*.token',
      'password',
      'passwordHash',
      'token',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
