import { z } from 'zod';

export const pushSubscribeSchema = z
  .object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }).strict(),
    userAgent: z.string().max(255).optional(),
  })
  .strict();
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().url() }).strict();
