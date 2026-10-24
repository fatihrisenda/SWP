/**
 * Pemetaan issue Zod (dari `@swp/shared`) dan pesan server -> kunci i18n (Issue 039 langkah 4 / Issue 015).
 * Tidak ada teks UI di sini: hanya kunci.
 */
import type { ZodIssue } from 'zod';

export type FieldErrors = Record<string, string>;

type Issue = Pick<ZodIssue, 'path' | 'code' | 'message'>;

const CODE_KEYS: Record<string, string> = {
  required: 'form.errors.required',
  invalid_email: 'auth.errors.emailInvalid',
  invalid_datetime: 'form.errors.invalidDate',
  invalid_time: 'form.errors.invalidTime',
  invalid_date: 'form.errors.invalidDate',
  invalid_uuid: 'tasks.form.errors.categoryRequired',
  password_mismatch: 'auth.errors.passwordMismatch',
  end_before_start: 'tasks.form.errors.endBeforeStart',
  step_0_5: 'tasks.form.errors.stepHalf',
  step_0_25: 'tasks.form.errors.stepQuarter',
  duplicate_days: 'tasks.form.errors.duplicateDays',
  invalid_color: 'categories.errors.colorFormat',
  category_required: 'tasks.form.errors.categoryRequired',
  min_one_day: 'tasks.form.errors.minOneDay',
  too_short: 'form.errors.tooShort',
  too_long: 'form.errors.tooLong',
};

/** `fields` dari server (`VALIDATION_ERROR`) berisi pesan/code; dipetakan ke kunci bila dikenali. */
export function serverFieldErrors(fields?: Record<string, string>): FieldErrors {
  if (!fields) return {};
  const out: FieldErrors = {};
  for (const [path, message] of Object.entries(fields)) {
    const key = CODE_KEYS[message];
    out[path] = key ?? (message === 'required' ? 'form.errors.required' : 'server.message');
    if (key === undefined && message !== 'required') out[`${path}__raw`] = message;
  }
  return out;
}

export function messageForField(errors: FieldErrors, path: string, t: (key: string, o?: Record<string, unknown>) => string): string | undefined {
  const key = errors[path];
  if (!key) return undefined;
  if (key === 'server.message') return errors[`${path}__raw`];
  return t(key);
}

function keyForIssue(issue: Issue): string {
  const codeKey = CODE_KEYS[issue.message];
  if (codeKey) return codeKey;
  const path = issue.path.join('.');
  switch (issue.code) {
    case 'too_small':
      if (path === 'password') return 'auth.errors.passwordMin';
      if (path === 'routineDays') return 'tasks.form.errors.minOneDay';
      if (path === 'title') return 'form.errors.titleRequired';
      if (path === 'name') return 'form.errors.required';
      return 'form.errors.tooShort';
    case 'too_big':
      if (path === 'title') return 'form.errors.titleMax';
      if (path === 'description') return 'form.errors.descriptionMax';
      if (path === 'name') return 'form.errors.nameMax';
      return 'form.errors.tooLong';
    case 'invalid_type':
      return 'form.errors.required';
    case 'invalid_string':
      return path === 'email' ? 'auth.errors.emailInvalid' : 'form.errors.invalid';
    case 'invalid_union_discriminator':
      return 'tasks.form.errors.typeRequired';
    default:
      return CODE_KEYS[issue.code] ?? 'form.errors.invalid';
  }
}

export function zodFieldErrors(issues: Issue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const path = issue.path.join('.') || '_root';
    if (!(path in out)) out[path] = keyForIssue(issue);
  }
  return out;
}

export function firstErrorPath(errors: FieldErrors): string | undefined {
  return Object.keys(errors).find((key) => !key.endsWith('__raw'))?.split('.')[0];
}
