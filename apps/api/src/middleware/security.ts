import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Tolak body non-JSON pada method mutasi (Issue 009). */
export function requireJson(req: Request, _res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] != null;
  if (!hasBody) return next();
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return next(new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Content-Type harus application/json'));
  }
  next();
}

/** Cek Origin anti-CSRF (Issue 009): hanya satu origin resmi yang diterima untuk method mutasi. */
export function checkOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    if (origin !== env.APP_ORIGIN) {
      return next(new AppError('FORBIDDEN', 403, 'Origin tidak diizinkan'));
    }
    return next();
  }
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return next(new AppError('FORBIDDEN', 403, 'Permintaan lintas situs ditolak'));
  }
  next();
}

/** Cache-Control: no-store untuk seluruh respons API (data dinamis/autentikasi, Issue 009). */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
