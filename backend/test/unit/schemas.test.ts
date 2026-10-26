import { describe, expect, it } from 'vitest';
import { registerSchema, updateProfileSchema } from '../../src/modules/identity/schemas.js';

describe('registerSchema', () => {
  const ok = { email: '  Jane@Example.COM ', password: 'a-reasonably-long-passphrase' };

  it('normalises email', () => {
    const r = registerSchema.parse(ok);
    expect(r.email).toBe('jane@example.com');
  });

  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ ...ok, email: 'nope' }).success).toBe(false);
  });

  it('rejects a password containing the email name', () => {
    expect(registerSchema.safeParse({ email: 'jane@example.com', password: 'xx-jane-passphrase' }).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts valid phone and allows clearing with null', () => {
    expect(updateProfileSchema.safeParse({ phone: '+92 300 1234567' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ phone: null }).success).toBe(true);
  });
  it('rejects bad phone and unknown fields (no mass assignment)', () => {
    expect(updateProfileSchema.safeParse({ phone: 'abc' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ status: 'active' }).success).toBe(false);
  });
});
