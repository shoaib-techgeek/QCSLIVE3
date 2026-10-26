import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const base = { DB_USER: 'root', DB_NAME: 'marketplace_dev' };

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv({ ...base });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('uses the dedicated test database under NODE_ENV=test', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'test', DB_TEST_NAME: 'marketplace_test' });
    expect(env.DB_ACTIVE_NAME).toBe('marketplace_test');
  });

  it('uses DB_NAME outside tests', () => {
    expect(loadEnv({ ...base }).DB_ACTIVE_NAME).toBe('marketplace_dev');
  });

  it('requires email verification unless explicitly disabled', () => {
    expect(loadEnv({ ...base }).REQUIRE_EMAIL_VERIFICATION).toBe(true);
    expect(loadEnv({ ...base, REQUIRE_EMAIL_VERIFICATION: 'false' }).REQUIRE_EMAIL_VERIFICATION).toBe(false);
    expect(() => loadEnv({ ...base, REQUIRE_EMAIL_VERIFICATION: 'nope' })).toThrow(/REQUIRE_EMAIL_VERIFICATION/);
  });

  it('rejects missing required values', () => {
    expect(() => loadEnv({})).toThrow(/DB_USER/);
  });

  it('rejects an out-of-range port', () => {
    expect(() => loadEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('requires a DB password in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/DB_PASSWORD/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', DB_PASSWORD: 'x', MAIL_DRIVER: 'memory' })).not.toThrow();
  });

  it('refuses the log mail driver in production (it would write links to logs)', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', DB_PASSWORD: 'x', MAIL_DRIVER: 'log' })).toThrow(/MAIL_DRIVER/);
  });

  it('does not echo secret values in error messages', () => {
    try {
      loadEnv({ ...base, PORT: 'nope', DB_PASSWORD: 'super-secret' });
    } catch (e) {
      expect((e as Error).message).not.toContain('super-secret');
    }
  });
});
