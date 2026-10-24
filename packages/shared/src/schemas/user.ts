import { z } from 'zod';
import { LIMITS } from '../constants.js';

const email = z.string().trim().toLowerCase().max(LIMITS.email.max).email('invalid_email');
const password = z.string().min(LIMITS.password.min).max(LIMITS.password.max);
const name = z.string().trim().min(LIMITS.userName.min).max(LIMITS.userName.max);

export const updateMeSchema = z
  .object({
    name: name.optional(),
    locale: z.enum(['id', 'en']).optional(),
    timezone: z.string().optional(),
    dailyCapacityHours: z.number().min(1).max(24).optional(),
  })
  .strict();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: password })
  .strict();

export const adminCreateUserSchema = z
  .object({ name, email, password, role: z.enum(['MAHASISWA', 'SUPERADMIN']) })
  .strict();
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    role: z.enum(['MAHASISWA', 'SUPERADMIN']).optional(),
  })
  .strict();
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const adminListUsersQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    q: z.string().max(100).optional(),
  })
  .strict();
