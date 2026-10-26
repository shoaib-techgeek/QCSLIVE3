import { describe, expect, it } from 'vitest';
import { hashPassword, passwordSchema, verifyPassword } from '../../src/modules/identity/password.js';
import { generateToken, hashToken } from '../../src/modules/identity/tokens.js';

describe('password hashing', () => {
  it('verifies the correct password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong horse battery', hash)).toBe(false);
  });

  it('salts: same password produces different hashes', async () => {
    expect(await hashPassword('same-password-1')).not.toBe(await hashPassword('same-password-1'));
  });

  it('never contains the plaintext', async () => {
    expect(await hashPassword('plaintext-secret-1')).not.toContain('plaintext-secret-1');
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$1$2')).toBe(false);
  });
});

describe('passwordSchema', () => {
  it.each([
    ['short', false],
    ['          ', false],
    ['Password123', false], // common list (case-insensitive)
    ['a'.repeat(129), false],
    ['a-reasonably-long-passphrase', true],
  ])('%s -> %s', (value, ok) => {
    expect(passwordSchema.safeParse(value).success).toBe(ok);
  });
});

describe('tokens', () => {
  it('generates unique high-entropy tokens whose hash matches', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a.token)).toBe(a.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).not.toContain(a.token);
  });
});
