import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// scrypt ships with Node (no native build step). Parameters are stored with each hash so they can be raised later.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const COMMON = new Set([
  'password123', 'password1234', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou123',
  'letmein1234', 'welcome1234', 'admin12345', 'passw0rd123', 'qwerty12345', '1q2w3e4r5t',
]);

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .refine((v) => v.trim().length > 0, 'Password cannot be blank.')
  .refine((v) => !COMMON.has(v.toLowerCase()), 'Password is too common.');
