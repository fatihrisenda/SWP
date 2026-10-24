import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface SessionClaims {
  sub: string; // userId
  sid: string; // sessionId
}

export async function signSessionToken(claims: SessionClaims, expiresAtSeconds: number): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAtSeconds)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload['sub'] !== 'string' || typeof payload['sid'] !== 'string') return null;
    return { sub: payload['sub'], sid: payload['sid'] };
  } catch {
    return null;
  }
}
