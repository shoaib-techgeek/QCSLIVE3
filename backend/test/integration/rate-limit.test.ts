import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, stopTestApp, type TestContext } from './helpers.js';

describe('auth rate limiting', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp({ AUTH_RATE_LIMIT_MAX: '3' }); });
  afterAll(async () => { await stopTestApp(ctx); });

  it('returns 429 in the standard error shape after the per-route limit', async () => {
    const attempt = () => ctx.app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      payload: { email: 'nobody@example.com', password: 'whatever-whatever' },
    });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await attempt()).statusCode);
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes.slice(3)).toEqual([429, 429]);
    const blocked = await attempt();
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
  });
});
