import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

type Db = PrismaClient | Prisma.TransactionClient;

export async function writeAuditLog(
  db: Db,
  action: string,
  actorId: string | null,
  targetUserId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.auditLog.create({
    data: { id: randomUUID(), actorId, targetUserId, action, meta: meta ? (meta as Prisma.InputJsonValue) : undefined },
  });
}
