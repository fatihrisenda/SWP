import { z } from 'zod';
import { LIMITS } from '../constants.js';

const email = z.string().trim().toLowerCase().max(LIMITS.email.max).email('invalid_email');
const password = z.string().min(LIMITS.password.min).max(LIMITS.password.max);
const name = z.string().trim().min(LIMITS.userName.min).max(LIMITS.userName.max);

export const registerSchema = z
  .object({
    name,
    email,
    password,
    confirmPassword: z.string(),
    timezone: z.string().optional(),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, { message: 'password_mismatch', path: ['confirmPassword'] });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'required'),
    remember: z.boolean().optional().default(false),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
