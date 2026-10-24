import type { User } from '@prisma/client';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  timezone: string;
  locale: string;
  dailyCapacityHours: number;
  createdAt: string;
}

/** Representasi user yang aman dikirim ke klien (tanpa `passwordHash`). */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    locale: user.locale,
    dailyCapacityHours: Number(user.dailyCapacityHours),
    createdAt: user.createdAt.toISOString(),
  };
}
