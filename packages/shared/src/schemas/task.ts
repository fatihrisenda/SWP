import { z } from 'zod';
import { LIMITS } from '../constants.js';

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid_datetime')
  .transform((v) => new Date(v));

const timeHHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalid_time');

/** z.multipleOf punya masalah presisi floating-point; dicek manual dengan toleransi. */
function stepOf(step: number, message: string) {
  return (v: number, ctx: z.RefinementCtx) => {
    const ratio = v / step;
    if (Math.abs(ratio - Math.round(ratio)) > 1e-9) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  };
}

const title = z.string().trim().min(LIMITS.title.min).max(LIMITS.title.max);
const description = z.string().max(LIMITS.description.max).optional().default('');
const categoryId = z.string().uuid('invalid_uuid');
const scale = z.number().int().min(1).max(5);

const fixedTimeSchema = z
  .object({
    type: z.literal('FIXED_TIME'),
    title,
    description,
    categoryId,
    importance: scale,
    difficulty: scale,
    startAt: isoDateTime,
    endAt: isoDateTime,
  })
  .strict();

const deadlineSchema = z
  .object({
    type: z.literal('DEADLINE'),
    title,
    description,
    categoryId,
    importance: scale,
    difficulty: scale,
    deadlineAt: isoDateTime,
    durationHours: z.number().min(0.5).max(100).superRefine(stepOf(0.5, 'step_0_5')),
  })
  .strict();

const routineSchema = z
  .object({
    type: z.literal('ROUTINE'),
    title,
    description,
    categoryId,
    importance: scale,
    difficulty: scale,
    routineDays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length, 'duplicate_days'),
    routineStartTime: timeHHmm,
    durationHours: z.number().min(0.25).max(12).superRefine(stepOf(0.25, 'step_0_25')),
  })
  .strict();

export const taskInputSchema = z
  .discriminatedUnion('type', [fixedTimeSchema, deadlineSchema, routineSchema])
  .superRefine((v, ctx) => {
    if (v.type === 'FIXED_TIME' && !(v.endAt.getTime() > v.startAt.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_before_start', path: ['endAt'] });
    }
  });

export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskStatusSchema = z.object({ status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']) }).strict();

export const taskListQuerySchema = z
  .object({
    scope: z.enum(['kuliah', 'pribadi']).optional(),
    status: z.enum(['active', 'done', 'all']).optional().default('all'),
    priority: z.enum(['TOP', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    type: z.enum(['FIXED_TIME', 'DEADLINE', 'ROUTINE']).optional(),
    categoryId: z.string().uuid().optional(),
    time: z.enum(['today', 'week', 'month']).optional(),
    q: z.string().max(100).optional(),
    sort: z.enum(['priority', 'deadline', 'newest']).optional().default('priority'),
    limit: z.coerce.number().int().min(1).max(500).optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export const conflictCheckSchema = z
  .object({
    candidate: taskInputSchema,
    excludeTaskId: z.string().uuid().optional(),
  })
  .strict();
