import { z } from 'zod';
import { LIMITS } from '../constants.js';

/** Pola Regex untuk validasi format nama, email, dan password. */
export const USER_PATTERNS = {
  name: /^[\p{L}]+(?:[ .'-][\p{L}]+)*$/u,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S{8,}$/,
} as const;

export const userNameSchema = z
  .string()
  .trim()
  .min(LIMITS.userName.min)
  .max(LIMITS.userName.max)
  .regex(USER_PATTERNS.name, 'invalid_name');

export const userEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.email.max)
  .regex(USER_PATTERNS.email, 'invalid_email')
  .email('invalid_email');

export const userPasswordSchema = z
  .string()
  .min(LIMITS.password.min)
  .max(LIMITS.password.max)
  .regex(USER_PATTERNS.password, 'weak_password');

export const registerSchema = z
  .object({
    name: userNameSchema,
    email: userEmailSchema,
    password: userPasswordSchema,
    confirmPassword: z.string(),
    timezone: z.string().optional(),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, { message: 'password_mismatch', path: ['confirmPassword'] });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: userEmailSchema,
    password: z.string().min(1, 'required'),
    remember: z.boolean().optional().default(false),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
