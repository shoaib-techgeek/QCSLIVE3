import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { FakeGoogleVerifier, type GoogleProfile } from '../../src/modules/identity/google-verifier.js';
import { hashPassword } from '../../src/modules/identity/password.js';
import * as repo from '../../src/modules/identity/identity.repository.js';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

// Passthrough mock: lets a test run code between a successful password check and the session insert.
const hooks = vi.hoisted(() => ({ afterPasswordOk: null as null | (() => Promise<void>) }));
vi.mock('../../src/modules/identity/password.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/modules/identity/password.js')>();
  return {
    ...actual,
    verifyPassword: async (password: string, stored: string) => {
      const ok = await actual.verifyPassword(password, stored);
      if (ok && hooks.afterPasswordOk) await hooks.afterPasswordOk();
      return ok;
    },
  };
});

const H = { 'x-requested-with': 'XMLHttpRequest' };
const URL = '/api/v1/auth/oauth/google';
const TOKEN = 'google-id-token-for-jane-0001';
const PASSWORD = 'a-reasonably-long-passphrase';

const verifier = new FakeGoogleVerifier();
let ctx: TestContext;
beforeAll(async () => { ctx = await startTestApp({}, { googleVerifier: verifier }); });
afterAll(async () => { await stopTestApp(ctx); });
beforeEach(async () => {
  await resetIdentityData(ctx.db);
  hooks.afterPasswordOk = null;
  verifier.tokens.clear();
  googleUser();
});

function googleUser(p: Partial<GoogleProfile> = {}, token = TOKEN): void {
  verifier.tokens.set(token, { subject: 'google-sub-1', email: 'jane@example.com', emailVerified: true, name: 'Jane Doe', ...p });
}

const signIn = (idToken = TOKEN) => ctx.app.inject({ method: 'POST', url: URL, payload: { idToken }, headers: H });

const passwordLogin = () =>
  ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'jane@example.com', password: PASSWORD }, headers: H });

const sidOf = (res: LightMyRequestResponse) => res.cookies.find((c) => c.name === 'sid');

const count = async (table: string, where: Record<string, unknown> = {}) =>
  Number(((await ctx.db(table).where(where).count({ c: '*' }).first()) as { c: number | string }).c);

async function seedUser(opts: { status: repo.UserStatus; verified: boolean; email?: string }) {
  const publicId = randomUUID();
  const id = await repo.insertUser(ctx.db, {
    publicId, email: opts.email ?? 'jane@example.com', passwordHash: await hashPassword(PASSWORD), fullName: 'Jane',
  });
  await repo.assignRole(ctx.db, id, 'customer');
  await ctx.db('users').where({ id }).update({ status: opts.status, email_verified_at: opts.verified ? new Date() : null });
  return id;
}

describe('POST /api/v1/auth/oauth/google', () => {
  it('creates an active customer with a verified email, one identity and a session cookie for a new Google user', async () => {
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.json().account).toMatchObject({ email: 'jane@example.com', fullName: 'Jane Doe', status: 'active' });
    const cookie = sidOf(res);
    expect(cookie?.httpOnly).toBe(true);
    const user = await ctx.db('users').first();
    expect(user.status).toBe('active');
    expect(user.email_verified_at).not.toBeNull();
    expect(user.password_hash).toBeNull();
    expect(await count('user_identities', { user_id: user.id, provider: 'google', provider_subject: 'google-sub-1' })).toBe(1);
    expect(await ctx.db('user_roles as ur').join('roles as r', 'r.id', 'ur.role_id').where('ur.user_id', user.id).pluck('r.name')).toEqual(['customer']);
    const me = await ctx.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: `sid=${cookie!.value}` } });
    expect(me.statusCode).toBe(200);
    expect(await count('audit_events', { action: 'auth.oauth_login' })).toBe(1);
    expect(await count('audit_events', { action: 'auth.oauth_link' })).toBe(0);
  });

  it('signs in again by sub without creating a second user', async () => {
    expect((await signIn()).statusCode).toBe(200);
    expect((await signIn()).statusCode).toBe(200);
    expect(await count('users')).toBe(1);
    expect(await count('user_identities')).toBe(1);
    expect(await count('sessions')).toBe(2);
  });

  it('matches by sub even when the Google email changed', async () => {
    const first = await signIn();
    googleUser({ email: 'jane.new@example.com' });
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.json().account.id).toBe(first.json().account.id);
    expect(res.json().account.email).toBe('jane@example.com');
    expect(await count('users')).toBe(1);
  });

  it('links to an existing verified password account by email, case-insensitively, keeping its password', async () => {
    const id = await seedUser({ status: 'active', verified: true });
    const before = await repo.findUserById(ctx.db, id);
    googleUser({ email: 'Jane@Example.COM' });
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.json().account.id).toBe(before!.public_id);
    expect((await repo.findUserById(ctx.db, id))!.password_hash).toBe(before!.password_hash);
    expect(await count('users')).toBe(1);
    expect(await count('user_identities', { user_id: id })).toBe(1);
    expect(await count('audit_events', { action: 'auth.oauth_link' })).toBe(1);
    expect(await count('audit_events', { action: 'auth.oauth_login' })).toBe(1);
    const login = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'jane@example.com', password: PASSWORD }, headers: H });
    expect(login.statusCode).toBe(200);
  });

  it('links to an existing never-verified password account, clears its password, revokes its sessions and marks the email verified', async () => {
    const id = await seedUser({ status: 'active', verified: false });
    await repo.createSession(ctx.db, { userId: id, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 3600_000), ip: null, userAgent: null });
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    const user = (await repo.findUserById(ctx.db, id))!;
    expect(user.password_hash).toBeNull();
    expect(user.email_verified_at).not.toBeNull();
    expect(await count('sessions', { user_id: id, token_hash: 'a'.repeat(64), revoked_at: null })).toBe(0);
    expect(await count('sessions', { user_id: id, revoked_at: null })).toBe(1); // only the new Google session
    expect(await count('audit_events', { action: 'auth.oauth_link' })).toBe(1);
  });

  it('rejects the old password at /auth/login with 401 INVALID_CREDENTIALS after a never-verified account is linked', async () => {
    await seedUser({ status: 'active', verified: false });
    expect((await signIn()).statusCode).toBe(200);
    const login = await passwordLogin();
    expect(login.statusCode).toBe(401);
    expect(login.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(sidOf(login)).toBeUndefined();
  });

  it('fails a password login whose hash is cleared by a Google link between the check and the session insert', async () => {
    const id = await seedUser({ status: 'active', verified: false });
    hooks.afterPasswordOk = async () => {
      hooks.afterPasswordOk = null;
      expect((await signIn()).statusCode).toBe(200); // the mailbox owner links Google inside the window
    };
    const login = await passwordLogin();
    expect(login.statusCode).toBe(401);
    expect(login.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(sidOf(login)).toBeUndefined();
    expect(await count('sessions', { user_id: id, revoked_at: null })).toBe(1); // only the Google session
    expect(await count('audit_events', { action: 'auth.login' })).toBe(0);
  });

  it('activates a pending_verification account when linking', async () => {
    const id = await seedUser({ status: 'pending_verification', verified: false });
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.json().account.status).toBe('active');
    expect((await repo.findUserById(ctx.db, id))!.status).toBe('active');
    const me = await ctx.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: `sid=${sidOf(res)!.value}` } });
    expect(me.statusCode).toBe(200);
  });

  it('rejects a suspended linked account with 403 ACCOUNT_DISABLED and issues no session', async () => {
    expect((await signIn()).statusCode).toBe(200);
    await ctx.db('users').update({ status: 'suspended' });
    await ctx.db('sessions').delete();
    const res = await signIn();
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('ACCOUNT_DISABLED');
    expect(sidOf(res)).toBeUndefined();
    expect(await count('sessions')).toBe(0);
  });

  it('rejects a suspended password account matched by email without linking it', async () => {
    await seedUser({ status: 'suspended', verified: true });
    const res = await signIn();
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('ACCOUNT_DISABLED');
    expect(await count('user_identities')).toBe(0);
    expect(await count('sessions')).toBe(0);
  });

  it('rejects email_verified=false with 401 GOOGLE_EMAIL_UNVERIFIED and creates nothing', async () => {
    googleUser({ emailVerified: false });
    const res = await signIn();
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('GOOGLE_EMAIL_UNVERIFIED');
    expect(await count('users')).toBe(0);
    expect(await count('user_identities')).toBe(0);
  });

  it('rejects an invalid token with 401 INVALID_GOOGLE_TOKEN', async () => {
    const res = await signIn('not-a-known-google-token-xyz');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_GOOGLE_TOKEN');
    expect(sidOf(res)).toBeUndefined();
  });

  it('rejects a missing or too short idToken with 400 VALIDATION_ERROR', async () => {
    const res = await signIn('short');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a request without X-Requested-With', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: URL, payload: { idToken: TOKEN } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_REJECTED');
    expect(await count('users')).toBe(0);
  });

  it('concurrent first sign-ins for the same sub create exactly one user and one identity', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => signIn()));
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(results.map((r) => r.json().account.id)).size).toBe(1);
    expect(await count('users')).toBe(1);
    expect(await count('user_identities')).toBe(1);
    expect(await count('sessions')).toBe(5);
  });
});

describe('POST /api/v1/auth/oauth/google without a client id', () => {
  it('returns 503 GOOGLE_SIGN_IN_DISABLED when no client id is configured', async () => {
    const off = await startTestApp({ GOOGLE_CLIENT_ID: '' });
    try {
      const res = await off.app.inject({ method: 'POST', url: URL, payload: { idToken: TOKEN }, headers: H });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe('GOOGLE_SIGN_IN_DISABLED');
    } finally {
      await stopTestApp(off);
    }
  });
});
