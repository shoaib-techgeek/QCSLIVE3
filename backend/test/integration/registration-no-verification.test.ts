import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };

describe('registration with email verification disabled', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp({ REQUIRE_EMAIL_VERIFICATION: 'false' }); });
  afterAll(async () => { await stopTestApp(ctx); });
  beforeEach(async () => { await resetIdentityData(ctx.db); ctx.mailer.outbox.length = 0; });

  const register = (email = 'jane@example.com') =>
    ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: H, payload: { email, password: PASSWORD } });

  it('creates an active customer immediately, sends no mail and creates no token', async () => {
    const res = await register();
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ verificationRequired: false });
    const user = await ctx.db('users').first();
    expect(user.status).toBe('active');
    expect(user.email_verified_at).toBeNull(); // never claim a mailbox was verified
    expect(ctx.mailer.outbox).toHaveLength(0);
    expect(await ctx.db('one_time_tokens').count({ c: '*' }).first()).toMatchObject({ c: 0 });
    expect(await ctx.db('user_roles').count({ c: '*' }).first()).toMatchObject({ c: 1 });
  });

  it('lets the new user sign in straight away and use their account', async () => {
    await register();
    const login = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: H, payload: { email: 'jane@example.com', password: PASSWORD } });
    expect(login.statusCode).toBe(200);
    const cookie = `sid=${login.cookies.find((c) => c.name === 'sid')!.value}`;
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie } })).statusCode).toBe(200);
  });

  it('rejects a duplicate email with 409 and creates no second account', async () => {
    await register();
    const dup = await register();
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('EMAIL_ALREADY_REGISTERED');
    expect(await ctx.db('users').count({ c: '*' }).first()).toMatchObject({ c: 1 });
  });

  it('still validates input', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: H, payload: { email: 'bad', password: 'short' } });
    expect(res.statusCode).toBe(400);
  });
});
