import { z } from 'zod';
import { userEmailSchema, userNameSchema, userPasswordSchema } from './auth.js';

export const updateMeSchema = z
  .object({
    name: userNameSchema.optional(),
    locale: z.enum(['id', 'en']).optional(),
    timezone: z.string().optional(),
    dailyCapacityHours: z.number().min(1).max(24).optional(),
  })
  .strict();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: userPasswordSchema })
  .strict();

export const adminCreateUserSchema = z
  .object({ name: userNameSchema, email: userEmailSchema, password: userPasswordSchema, role: z.enum(['MAHASISWA', 'SUPERADMIN']) })
  .strict();
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z
  .object({
    name: userNameSchema.optional(),
    email: userEmailSchema.optional(),
    password: userPasswordSchema.optional(),
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

export const adminAuditLogsQuerySchema = z
  .object({
    action: z.enum(['USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'LOGIN_FAIL']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();
