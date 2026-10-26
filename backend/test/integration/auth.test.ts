import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };

let ctx: TestContext;
beforeAll(async () => { ctx = await startTestApp(); });
afterAll(async () => { await stopTestApp(ctx); });
beforeEach(async () => { await resetIdentityData(ctx.db); ctx.mailer.outbox.length = 0; });

const post = (url: string, payload: unknown, cookie?: string) =>
  ctx.app.inject({ method: 'POST', url, payload: payload as object, headers: { ...H, ...(cookie ? { cookie } : {}) } });

const tokenFrom = (to: string): string => {
  const text = ctx.mailer.lastTo(to)?.text ?? '';
  const m = /token=([\w-]+)/.exec(text);
  if (!m?.[1]) throw new Error(`no token in mail to ${to}`);
  return m[1];
};

const sidOf = (res: LightMyRequestResponse): string => {
  const c = res.cookies.find((x) => x.name === 'sid');
  if (!c) throw new Error('no session cookie');
  return `sid=${c.value}`;
};

async function registerVerified(email = 'jane@example.com', password = PASSWORD) {
  expect((await post('/api/v1/auth/register', { email, password, fullName: 'Jane Doe' })).statusCode).toBe(202);
  expect((await post('/api/v1/auth/verify-email', { token: tokenFrom(email) })).statusCode).toBe(204);
}

async function signIn(email = 'jane@example.com', password = PASSWORD) {
  const res = await post('/api/v1/auth/login', { email, password });
  expect(res.statusCode).toBe(200);
  return sidOf(res);
}

describe('registration & verification', () => {
  it('creates a pending user, stores only a hash, and sends one verification mail', async () => {
    const res = await post('/api/v1/auth/register', { email: 'Jane@Example.com', password: PASSWORD });
    expect(res.statusCode).toBe(202);
    expect(res.json().verificationRequired).toBe(true);
    const user = await ctx.db('users').first();
    expect(user.email).toBe('jane@example.com');
    expect(user.status).toBe('pending_verification');
    expect(user.password_hash).not.toContain(PASSWORD);
    expect(ctx.mailer.outbox).toHaveLength(1);
    const token = tokenFrom('jane@example.com');
    const stored = await ctx.db('one_time_tokens').first();
    expect(stored.token_hash).not.toBe(token);
    expect(await ctx.db('user_roles').count({ c: '*' }).first()).toMatchObject({ c: 1 });
  });

  it('gives the same response for an already-registered email and creates no second account', async () => {
    await registerVerified();
    const res = await post('/api/v1/auth/register', { email: 'jane@example.com', password: PASSWORD });
    expect(res.statusCode).toBe(202);
    expect(await ctx.db('users').count({ c: '*' }).first()).toMatchObject({ c: 1 });
    expect(ctx.mailer.lastTo('jane@example.com')?.subject).toBe('You already have an account');
  });

  it('rejects invalid input with the standard validation error', async () => {
    const res = await post('/api/v1/auth/register', { email: 'bad', password: 'short' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.requestId).toBeTruthy();
  });

  it('activates the account on verification and the token cannot be reused', async () => {
    await registerVerified();
    expect((await ctx.db('users').first()).status).toBe('active');
    const again = await post('/api/v1/auth/verify-email', { token: tokenFrom('jane@example.com') });
    expect(again.statusCode).toBe(400);
    expect(again.json().error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired verification token', async () => {
    await post('/api/v1/auth/register', { email: 'jane@example.com', password: PASSWORD });
    await ctx.db('one_time_tokens').update({ expires_at: new Date(Date.now() - 1000) });
    const res = await post('/api/v1/auth/verify-email', { token: tokenFrom('jane@example.com') });
    expect(res.statusCode).toBe(400);
    expect((await ctx.db('users').first()).status).toBe('pending_verification');
  });

  it('rejects a guessed token', async () => {
    const res = await post('/api/v1/auth/verify-email', { token: 'x'.repeat(43) });
    expect(res.statusCode).toBe(400);
  });

  it('concurrent use of one verification token succeeds exactly once', async () => {
    await post('/api/v1/auth/register', { email: 'jane@example.com', password: PASSWORD });
    const token = tokenFrom('jane@example.com');
    const results = await Promise.all([1, 2, 3, 4].map(() => post('/api/v1/auth/verify-email', { token })));
    expect(results.filter((r) => r.statusCode === 204)).toHaveLength(1);
  });
});

describe('login & session', () => {
  it('blocks login until email is verified (after a correct password)', async () => {
    await post('/api/v1/auth/register', { email: 'jane@example.com', password: PASSWORD });
    const res = await post('/api/v1/auth/login', { email: 'jane@example.com', password: PASSWORD });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('EMAIL_NOT_VERIFIED');
    const wrong = await post('/api/v1/auth/login', { email: 'jane@example.com', password: 'wrong-wrong-wrong' });
    expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('signs in with secure cookie attributes and stores only the token hash', async () => {
    await registerVerified();
    const res = await post('/api/v1/auth/login', { email: 'JANE@example.com', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'sid')!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie.maxAge).toBeGreaterThan(0);
    expect((await ctx.db('sessions').first()).token_hash).not.toBe(cookie.value);
    expect(res.json().account).toMatchObject({ email: 'jane@example.com' });
    expect(JSON.stringify(res.json())).not.toMatch(/password|hash/i);
  });

  it('gives identical errors for unknown email and wrong password', async () => {
    await registerVerified();
    const a = await post('/api/v1/auth/login', { email: 'nobody@example.com', password: PASSWORD });
    const b = await post('/api/v1/auth/login', { email: 'jane@example.com', password: 'wrong-wrong-wrong' });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json().error.code).toBe(b.json().error.code);
    expect(a.json().error.message).toBe(b.json().error.message);
  });

  it('issues a new session token on every login (no fixation)', async () => {
    await registerVerified();
    expect(await signIn()).not.toBe(await signIn());
  });

  it('locks the account after repeated failures, even for the right password, then allows after lock expiry', async () => {
    await registerVerified();
    for (let i = 0; i < 5; i++) {
      expect((await post('/api/v1/auth/login', { email: 'jane@example.com', password: 'wrong-wrong-wrong' })).statusCode).toBe(401);
    }
    const locked = await post('/api/v1/auth/login', { email: 'jane@example.com', password: PASSWORD });
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe('TOO_MANY_ATTEMPTS');
    await ctx.db('users').update({ locked_until: new Date(Date.now() - 1000) });
    expect((await post('/api/v1/auth/login', { email: 'jane@example.com', password: PASSWORD })).statusCode).toBe(200);
  });

  it('suspended users cannot sign in and existing sessions stop working', async () => {
    await registerVerified();
    const sid = await signIn();
    await ctx.db('users').update({ status: 'suspended' });
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: sid } })).statusCode).toBe(401);
    const res = await post('/api/v1/auth/login', { email: 'jane@example.com', password: PASSWORD });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('ACCOUNT_DISABLED');
  });

  it('logout revokes the session server-side (replaying the cookie fails) and is idempotent', async () => {
    await registerVerified();
    const sid = await signIn();
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: sid } })).statusCode).toBe(200);
    expect((await post('/api/v1/auth/logout', {}, sid)).statusCode).toBe(204);
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: sid } })).statusCode).toBe(401);
    expect((await post('/api/v1/auth/logout', {}, sid)).statusCode).toBe(204);
  });

  it('logout works with an empty body and a JSON content type (regression)', async () => {
    await registerVerified();
    const sid = await signIn();
    const res = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { ...H, 'content-type': 'application/json', cookie: sid } });
    expect(res.statusCode).toBe(204);
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: sid } })).statusCode).toBe(401);
  });

  it('empty-body requests to routes that need a body get a validation error, not a crash', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { ...H, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('expired sessions are rejected', async () => {
    await registerVerified();
    const sid = await signIn();
    await ctx.db('sessions').update({ expires_at: new Date(Date.now() - 1000) });
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: sid } })).statusCode).toBe(401);
  });
});

describe('password reset & change', () => {
  it('responds identically for unknown emails and sends no mail', async () => {
    const res = await post('/api/v1/auth/forgot-password', { email: 'ghost@example.com' });
    expect(res.statusCode).toBe(202);
    expect(ctx.mailer.outbox).toHaveLength(0);
  });

  it('resets the password, revokes all sessions, and the token is single-use', async () => {
    await registerVerified();
    const sid = await signIn();
    expect((await post('/api/v1/auth/forgot-password', { email: 'jane@example.com' })).statusCode).toBe(202);
    const token = tokenFrom('jane@example.com');
    const newPassword = 'another-long-passphrase-9';
    expect((await post('/api/v1/auth/reset-password', { token, password: newPassword })).statusCode).toBe(204);

    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: sid } })).statusCode).toBe(401);
    expect((await post('/api/v1/auth/login', { email: 'jane@example.com', password: PASSWORD })).statusCode).toBe(401);
    expect((await post('/api/v1/auth/login', { email: 'jane@example.com', password: newPassword })).statusCode).toBe(200);
    expect((await post('/api/v1/auth/reset-password', { token, password: 'yet-another-passphrase-1' })).statusCode).toBe(400);
  });

  it('a newer reset link invalidates the older one; expired links fail', async () => {
    await registerVerified();
    await post('/api/v1/auth/forgot-password', { email: 'jane@example.com' });
    const first = tokenFrom('jane@example.com');
    await post('/api/v1/auth/forgot-password', { email: 'jane@example.com' });
    const second = tokenFrom('jane@example.com');
    expect((await post('/api/v1/auth/reset-password', { token: first, password: 'another-long-passphrase-9' })).statusCode).toBe(400);
    await ctx.db('one_time_tokens').update({ expires_at: new Date(Date.now() - 1000) });
    expect((await post('/api/v1/auth/reset-password', { token: second, password: 'another-long-passphrase-9' })).statusCode).toBe(400);
  });

  it('enforces the password policy on reset', async () => {
    await registerVerified();
    await post('/api/v1/auth/forgot-password', { email: 'jane@example.com' });
    const res = await post('/api/v1/auth/reset-password', { token: tokenFrom('jane@example.com'), password: 'short' });
    expect(res.statusCode).toBe(400);
  });

  it('change-password needs the current password and signs out other devices only', async () => {
    await registerVerified();
    const a = await signIn();
    const b = await signIn();
    const bad = await post('/api/v1/auth/change-password', { currentPassword: 'wrong-wrong-wrong', newPassword: 'another-long-passphrase-9' }, a);
    expect(bad.statusCode).toBe(400);
    const ok = await post('/api/v1/auth/change-password', { currentPassword: PASSWORD, newPassword: 'another-long-passphrase-9' }, a);
    expect(ok.statusCode).toBe(204);
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: a } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: b } })).statusCode).toBe(401);
  });
});

describe('authorization & profile', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    expect((await ctx.app.inject('/api/v1/me')).statusCode).toBe(401);
    expect((await post('/api/v1/auth/change-password', { currentPassword: 'x', newPassword: 'y' })).statusCode).toBe(401);
    expect((await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: 'sid=garbage' } })).statusCode).toBe(401);
  });

  it('returns the account with permissions and updates the profile; users only ever see their own record', async () => {
    await registerVerified('jane@example.com');
    await registerVerified('john@example.com');
    const jane = await signIn('jane@example.com');
    const me = await ctx.app.inject({ url: '/api/v1/me', headers: { cookie: jane } });
    expect(me.json().account).toMatchObject({ email: 'jane@example.com', fullName: 'Jane Doe', permissions: ['account:read', 'account:update'] });

    const upd = await ctx.app.inject({ method: 'PATCH', url: '/api/v1/me', headers: { ...H, cookie: jane }, payload: { fullName: 'Jane Q', phone: '+92 300 1234567' } });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().account).toMatchObject({ fullName: 'Jane Q', phone: '+92 300 1234567' });
    expect((await ctx.db('users').where({ email: 'john@example.com' }).first()).full_name).not.toBe('Jane Q');
    expect((await ctx.db('users').where({ email: 'john@example.com' }).first()).phone).toBeNull();
  });

  it('profile update cannot change status, email or roles (mass assignment)', async () => {
    await registerVerified();
    const sid = await signIn();
    const res = await ctx.app.inject({ method: 'PATCH', url: '/api/v1/me', headers: { ...H, cookie: sid }, payload: { status: 'suspended', email: 'evil@example.com' } });
    expect(res.statusCode).toBe(400);
    expect((await ctx.db('users').first()).status).toBe('active');
  });

  it('writes audit events without secrets', async () => {
    await registerVerified();
    await signIn();
    await post('/api/v1/auth/login', { email: 'jane@example.com', password: 'wrong-wrong-wrong' });
    const actions = await ctx.db('audit_events').orderBy('id').pluck('action');
    expect(actions).toEqual(['auth.register', 'auth.email_verified', 'auth.login', 'auth.login_failed']);
    const dump = JSON.stringify(await ctx.db('audit_events'));
    expect(dump).not.toContain(PASSWORD);
    expect(dump).not.toMatch(/token=/);
  });
});

describe('request parsing', () => {
  it('rejects malformed JSON with a clear error', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { ...H, 'content-type': 'application/json' }, payload: '{"email": ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_JSON');
  });
});

describe('csrf guard', () => {
  it('rejects state-changing API requests without the custom header', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'a@b.co', password: 'x' } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_REJECTED');
  });
});

describe('error hygiene', () => {
  it('does not leak passwords or tokens in error bodies', async () => {
    const res = await post('/api/v1/auth/register', { email: 'bad', password: 'secret-pass-do-not-leak' });
    expect(res.body).not.toContain('secret-pass-do-not-leak');
  });
});
