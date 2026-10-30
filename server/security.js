import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function makePasswordHash(password) {
  if (password.length < 16 || password.length > 256) throw new Error('Use an admin password of 16–256 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')}`;
}
export function validPasswordHash(value) { return /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value || ''); }
export function checkPassword(password, encoded) {
  if (!validPasswordHash(encoded)) return false;
  const [, salt, expected] = encoded.split('$');
  const actual = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
  return safeEqual(actual, expected);
}
