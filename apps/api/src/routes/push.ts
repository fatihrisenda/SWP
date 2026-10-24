import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@swp/shared';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { pushTestLimiter } from '../middleware/rateLimit.js';
import { isAllowedPushEndpoint, sendPushNotification } from '../lib/push.js';

export const pushRouter = Router();
pushRouter.use('/push', requireAuth);

const MAX_SUBSCRIPTIONS_PER_USER = 10;

pushRouter.get('/push/public-key', (_req, res) => {
  res.status(200).json({ publicKey: env.VAPID_PUBLIC_KEY || null });
});

pushRouter.post('/push/subscriptions', async (req, res) => {
  const userId = req.user!.id;
  const input = pushSubscribeSchema.parse(req.body);

  if (!isAllowedPushEndpoint(input.endpoint)) {
    throw new AppError('INVALID_ENDPOINT', 400, 'Endpoint push tidak diizinkan');
  }

  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint: input.endpoint } });
  if (existing) {
    await prisma.pushSubscription.update({
      where: { endpoint: input.endpoint },
      data: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent },
    });
  } else {
    const count = await prisma.pushSubscription.count({ where: { userId } });
    if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
      const oldest = await prisma.pushSubscription.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (oldest) await prisma.pushSubscription.delete({ where: { id: oldest.id } });
    }
    await prisma.pushSubscription.create({
      data: {
        id: randomUUID(),
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent,
      },
    });
  }

  res.status(200).json({ ok: true });
});

pushRouter.delete('/push/subscriptions', async (req, res) => {
  const userId = req.user!.id;
  const { endpoint } = pushUnsubscribeSchema.parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  res.status(204).end();
});

pushRouter.post('/push/test', pushTestLimiter, async (req, res) => {
  const userId = req.user!.id;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const result = await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      {
        title: '\u2705 Notifikasi uji coba',
        body: 'Jika Anda melihat ini, notifikasi push berfungsi dengan baik.',
        tag: 'push-test',
        url: '/',
      },
      { TTL: 60, urgency: 'normal' },
    );
    if (result.ok) {
      sent += 1;
      await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date() } });
    } else {
      failed += 1;
      if (result.expired) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }

  res.status(200).json({ sent, failed, totalSubscriptions: subs.length });
});
