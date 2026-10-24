import { z } from 'zod';

export const moodInputSchema = z.object({ level: z.number().int().min(1).max(5) }).strict();
export type MoodInput = z.infer<typeof moodInputSchema>;

export const recommendationQuerySchema = z
  .object({ mood: z.coerce.number().int().min(1).max(5).optional() })
  .strict();
