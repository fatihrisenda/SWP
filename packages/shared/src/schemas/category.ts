import { z } from 'zod';
import { LIMITS } from '../constants.js';

export const categoryTypeSchema = z.enum(['KULIAH', 'PRIBADI']);

export const categoryInputSchema = z
  .object({
    name: z.string().trim().min(LIMITS.categoryName.min).max(LIMITS.categoryName.max),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'invalid_color')
      .transform((c) => c.toUpperCase()),
    type: categoryTypeSchema,
  })
  .strict();

export type CategoryInput = z.infer<typeof categoryInputSchema>;
