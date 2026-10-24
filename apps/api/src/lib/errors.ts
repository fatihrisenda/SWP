/** Kode error standar (Bagian 6.1 issues.md). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'CATEGORY_IN_USE'
  | 'LAST_SUPERADMIN'
  | 'NAME_TAKEN'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'MOOD_REQUIRED'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_ENDPOINT'
  | 'INTERNAL';

/** Error terkendali yang dipetakan langsung ke format respons API. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly extra?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    fields?: Record<string, string>,
    extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.extra = extra;
  }
}

export const notFound = (message = 'Data tidak ditemukan') => new AppError('NOT_FOUND', 404, message);
export const forbidden = (message = 'Tidak berhak mengakses sumber daya ini') =>
  new AppError('FORBIDDEN', 403, message);
export const unauthenticated = (message = 'Sesi tidak valid, silakan masuk kembali') =>
  new AppError('UNAUTHENTICATED', 401, message);
