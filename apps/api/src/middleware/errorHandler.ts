import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, type ErrorCode } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

interface HttpBodyError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

function zodFieldErrors(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_root';
    if (!(path in fields)) fields[path] = issue.message;
  }
  return fields;
}

/** 404 JSON untuk route yang tidak dikenal (Issue 006). */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route tidak ditemukan: ${req.method} ${req.path}` } });
}

/**
 * Error handler terpusat: mengubah ZodError / AppError / error tak dikenal ke format Bagian 6.1.
 * Signature 4-argumen wajib agar Express mengenalinya sebagai error middleware (parameter `_next`
 * tidak dipakai, namanya diawali `_` sesuai konvensi lint proyek).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', fields: zodFieldErrors(err) },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.status === 429) {
      res.setHeader('Retry-After', '60');
    }
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
        ...(err.extra ?? {}),
      },
    });
    return;
  }

  const httpErr = err as HttpBodyError;
  if (httpErr?.type === 'entity.too.large' || httpErr?.status === 413 || httpErr?.statusCode === 413) {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Ukuran body melebihi batas' } });
    return;
  }
  if (httpErr?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON tidak valid' } });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  const code: ErrorCode = 'INTERNAL';
  res.status(500).json({ error: { code, message: 'Terjadi kesalahan pada server' } });
}
