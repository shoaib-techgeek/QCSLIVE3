import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };

describe('seller profile', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp({ REQUIRE_EMAIL_VERIFICATION: 'false' }); });
  afterAll(async () => { await stopTestApp(ctx); });
  beforeEach(async () => {
    await resetIdentityData(ctx.db);
    await ctx.db('outbox_events').delete();
  });

  async function signIn(email: string): Promise<string> {
    await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: H, payload: { email, password: PASSWORD } });
    const login = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: H, payload: { email, password: PASSWORD } });
    return `sid=${login.cookies.find((c) => c.name === 'sid')!.value}`;
  }
  const create = (cookie: string, payload: object) =>
    ctx.app.inject({ method: 'POST', url: '/api/v1/seller/profile', headers: { ...H, cookie }, payload });

  it('requires a session', async () => {
    expect((await ctx.app.inject({ method: 'POST', url: '/api/v1/seller/profile', headers: H, payload: { storeName: 'Ali Traders' } })).statusCode).toBe(401);
    expect((await ctx.app.inject({ url: '/api/v1/seller/profile' })).statusCode).toBe(401);
  });

  it('creates a pending seller with a slug, audit entry and seller.registered event', async () => {
    const cookie = await signIn('ali@example.com');
    const res = await create(cookie, { storeName: 'Ali Traders', description: 'Quality goods' });
    expect(res.statusCode).toBe(201);
    expect(res.json().seller).toMatchObject({ storeName: 'Ali Traders', slug: 'ali-traders', status: 'pending', kycStatus: 'not_submitted' });
    expect(res.json().seller.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await ctx.db('audit_events').where({ action: 'seller.registered' })).toHaveLength(1);
    expect((await ctx.db('outbox_events').where({ type: 'seller.registered' })).length).toBe(1);
  });

  it('allows one store per user (409)', async () => {
    const cookie = await signIn('ali@example.com');
    await create(cookie, { storeName: 'Ali Traders' });
    const again = await create(cookie, { storeName: 'Another Store' });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('SELLER_EXISTS');
  });

  it('rejects a taken store name or slug (409) and invalid names (400)', async () => {
    await create(await signIn('ali@example.com'), { storeName: 'Ali Traders' });
    const other = await signIn('sara@example.com');
    const dupe = await create(other, { storeName: 'ali traders' });
    expect(dupe.statusCode).toBe(409);
    expect(dupe.json().error.code).toBe('STORE_NAME_TAKEN');
    expect((await create(other, { storeName: 'ab' })).statusCode).toBe(400);
    expect((await create(other, { storeName: 'Admin' })).statusCode).toBe(400);
  });

  it('reads and updates only the caller\'s own profile (no IDOR surface)', async () => {
    const a = await signIn('ali@example.com');
    const b = await signIn('sara@example.com');
    await create(a, { storeName: 'Ali Traders', description: 'A' });
    expect((await ctx.app.inject({ url: '/api/v1/seller/profile', headers: { cookie: b } })).statusCode).toBe(404);

    const patch = await ctx.app.inject({ method: 'PATCH', url: '/api/v1/seller/profile', headers: { ...H, cookie: a }, payload: { description: 'New text' } });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().seller.description).toBe('New text');
    expect((await ctx.app.inject({ method: 'PATCH', url: '/api/v1/seller/profile', headers: { ...H, cookie: b }, payload: { description: 'x' } })).statusCode).toBe(404);
  });

  it('does not let the client set status, kycStatus or storeName on update', async () => {
    const a = await signIn('ali@example.com');
    await create(a, { storeName: 'Ali Traders' });
    for (const payload of [{ status: 'active' }, { kycStatus: 'approved' }, { storeName: 'Hacked' }, {}]) {
      const res = await ctx.app.inject({ method: 'PATCH', url: '/api/v1/seller/profile', headers: { ...H, cookie: a }, payload });
      expect(res.statusCode).toBe(400);
    }
  });
});
