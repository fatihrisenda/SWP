import { Router } from 'express';
import { isValidTimezone, updateMeSchema } from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { toPublicUser } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { syncAllRoutineReminders } from '../lib/reminderService.js';

export const meRouter = Router();

meRouter.patch('/me', requireAuth, async (req, res) => {
  const input = updateMeSchema.parse(req.body);

  if (input.timezone !== undefined && !isValidTimezone(input.timezone)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Data tidak valid', { timezone: 'Zona waktu tidak valid' });
  }

  const userId = req.user!.id;
  const timezoneChanged = input.timezone !== undefined && input.timezone !== req.user!.timezone;

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.dailyCapacityHours !== undefined ? { dailyCapacityHours: input.dailyCapacityHours } : {}),
      },
    });
    if (timezoneChanged) {
      await syncAllRoutineReminders(tx, userId, updated.timezone);
    }
    return updated;
  });

  res.status(200).json({ user: toPublicUser(user) });
});
