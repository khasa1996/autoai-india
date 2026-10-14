import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password: string, hash: string) { const [salt, encoded] = hash.split(':'); if (!salt || !encoded) return false; const expected = Buffer.from(encoded,'hex'); const actual = scryptSync(password,salt,64); return expected.length === actual.length && timingSafeEqual(expected,actual); }
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
