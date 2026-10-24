import argon2 from 'argon2';
import { env } from '../config/env.js';

const options = (): argon2.Options & { raw?: false } => ({
  type: argon2.argon2id,
  memoryCost: env.ARGON2_MEMORY_KIB,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: 1,
});

/** Hash sebuah hash dummy konstan dipakai untuk mencegah timing-attack enumerasi email (Issue 011). */
let dummyHashPromise: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash('dummy-password-for-timing-safety', options());
  return dummyHashPromise;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, options());
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** True bila hash dibuat dengan parameter argon2 yang sudah usang (untuk upgrade transparan saat login). */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, options());
  } catch {
    return true;
  }
}
