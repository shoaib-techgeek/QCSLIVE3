import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

describe('admin product moderation', () => {
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
  const api = (cookie: string | undefined, method: string, url: string, payload?: object) =>
    ctx.app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: { ...H, ...(cookie ? { cookie } : {}) }, payload });
  async function admin(): Promise<string> {
    const cookie = await signIn('admin@example.com');
    const user = await ctx.db('users').where({ email: 'admin@example.com' }).first('id');
    const role = await ctx.db('roles').where({ name: 'admin' }).first('id');
    await ctx.db('user_roles').insert({ user_id: user.id, role_id: role.id });
    return cookie;
  }
  async function seller(email: string, store: string): Promise<string> {
    const cookie = await signIn(email);
    await api(cookie, 'POST', '/seller/profile', { storeName: store });
    await ctx.db('sellers').where({ store_name: store }).update({ kyc_status: 'approved', status: 'active' });
    return cookie;
  }
  async function pendingProduct(cookie: string, title: string, sku: string): Promise<string> {
    const res = await api(cookie, 'POST', '/seller/products', { title, categorySlug: 'men', skus: [{ sellerSku: sku, options: {}, priceMinor: 25000 }] });
    const id = res.json().product.id as string;
    await api(cookie, 'POST', `/seller/products/${id}/submit`);
    return id;
  }
  const decide = (cookie: string, id: string, decision: string, reason?: string) =>
    api(cookie, 'POST', `/admin/products/${id}/moderate`, reason ? { decision, reason } : { decision });

  it('is closed to anonymous users, customers and sellers', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    expect((await api(undefined, 'GET', '/admin/products')).statusCode).toBe(401);
    for (const [method, url, body] of [['GET', '/admin/products', undefined], ['GET', `/admin/products/${id}`, undefined], ['POST', `/admin/products/${id}/moderate`, { decision: 'approve' }]] as const) {
      expect((await api(s, method, url, body)).statusCode, `${method} ${url}`).toBe(403);
    }
  });

  it('lists pending products oldest first with store, price and image count, and pages with a cursor', async () => {
    const a = await seller('ali@example.com', 'Ali Traders');
    const b = await seller('sara@example.com', 'Sara Shop');
    await pendingProduct(a, 'First', 'A1');
    await pendingProduct(b, 'Second', 'B1');
    await pendingProduct(a, 'Third', 'A2');
    const draft = await api(a, 'POST', '/seller/products', { title: 'Still draft', categorySlug: 'men', skus: [{ sellerSku: 'A3', options: {}, priceMinor: 100 }] });
    expect(draft.statusCode).toBe(201);
    const adm = await admin();
    const p1 = (await api(adm, 'GET', '/admin/products?limit=2')).json();
    expect(p1.items.map((i: { title: string }) => i.title)).toEqual(['First', 'Second']);
    expect(p1.items[0]).toMatchObject({ storeName: 'Ali Traders', status: 'pending', priceFromMinor: 25000, currency: 'PKR', imageCount: 0 });
    const p2 = (await api(adm, 'GET', `/admin/products?limit=2&cursor=${p1.nextCursor}`)).json();
    expect(p2.items.map((i: { title: string }) => i.title)).toEqual(['Third']);
    expect(p2.nextCursor).toBeNull();
  });

  it('filters by status', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    const adm = await admin();
    expect((await api(adm, 'GET', '/admin/products?status=active')).json().items).toHaveLength(0);
    await decide(adm, id, 'approve');
    expect((await api(adm, 'GET', '/admin/products?status=active')).json().items).toHaveLength(1);
    expect((await api(adm, 'GET', '/admin/products')).json().items).toHaveLength(0);
  });

  it('shows the full product with its store and status history', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    const adm = await admin();
    const res = await api(adm, 'GET', `/admin/products/${id}`);
    expect(res.statusCode).toBe(200);
    const p = res.json().product;
    expect(p).toMatchObject({ id, title: 'Shirt', status: 'pending', store: { name: 'Ali Traders' } });
    expect(p.skus).toHaveLength(1);
    expect(p.history.map((h: { to: string }) => h.to)).toEqual(['draft', 'pending']);
    expect((await api(adm, 'GET', '/admin/products/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
  });

  it('approves: pending becomes active, with history, audit and event', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    const adm = await admin();
    await ctx.db('outbox_events').delete();
    const res = await decide(adm, id, 'approve');
    expect(res.statusCode).toBe(200);
    expect(res.json().product.status).toBe('active');
    expect(await ctx.db('product_status_history').where({ to_status: 'active' })).toHaveLength(1);
    expect(await ctx.db('audit_events').where({ action: 'product.approved' })).toHaveLength(1);
    const evt = await ctx.db('outbox_events').where({ type: 'product.status_changed' });
    expect(evt).toHaveLength(1);
    expect((await api(s, 'GET', `/seller/products/${id}`)).json().product.status).toBe('active');
  });

  it('needs a reason to reject, shows it to the seller, and clears it when the seller resubmits', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    const adm = await admin();
    expect((await decide(adm, id, 'reject')).statusCode).toBe(400);
    expect((await decide(adm, id, 'reject', '   ')).statusCode).toBe(400);
    expect((await decide(adm, id, 'reject', 'Photos are blurry')).statusCode).toBe(200);
    expect((await api(s, 'GET', `/seller/products/${id}`)).json().product).toMatchObject({ status: 'rejected', rejectionReason: 'Photos are blurry' });
    expect((await api(s, 'PATCH', `/seller/products/${id}`, { title: 'Shirt, better photos' })).statusCode).toBe(200);
    const again = await api(s, 'POST', `/seller/products/${id}/submit`);
    expect(again.json().product).toMatchObject({ status: 'pending', rejectionReason: null });
  });

  it('bans and deactivates with a reason; a banned product stays banned', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    const adm = await admin();
    await decide(adm, id, 'approve');
    expect((await decide(adm, id, 'deactivate')).statusCode).toBe(400);
    expect((await decide(adm, id, 'deactivate', 'Out of policy while we check')).json().product.status).toBe('inactive');
    expect((await decide(adm, id, 'ban', 'Counterfeit goods')).json().product.status).toBe('banned');
    expect((await api(s, 'GET', `/seller/products/${id}`)).json().product).toMatchObject({ status: 'banned', rejectionReason: 'Counterfeit goods' });
    const activate = await api(s, 'POST', `/seller/products/${id}/activate`);
    expect(activate.statusCode).toBe(409);
    expect((await decide(adm, id, 'approve')).statusCode).toBe(409);
  });

  it('refuses a decision that is not valid for the current status', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    const adm = await admin();
    await decide(adm, id, 'approve');
    const again = await decide(adm, id, 'approve');
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('PRODUCT_INVALID_TRANSITION');
  });

  it('rejects an unknown decision and extra fields', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    const adm = await admin();
    expect((await decide(adm, id, 'publish')).statusCode).toBe(400);
    expect((await api(adm, 'POST', `/admin/products/${id}/moderate`, { decision: 'approve', status: 'banned' })).statusCode).toBe(400);
  });

  it('lets reviewers (only) preview images of products that are not live yet', async () => {
    const s = await seller('ali@example.com', 'Ali Traders');
    const customer = await signIn('zara@example.com');
    const id = await pendingProduct(s, 'Shirt', 'A1');
    // images are only editable before submit, so attach one directly
    const productRow = await ctx.db('products').where({ public_id: id }).first('id');
    await ctx.storage.put('products/test/img-1', PNG);
    await ctx.db('product_images').insert({ public_id: '44444444-4444-4444-8444-444444444444', product_id: productRow.id, storage_key: 'products/test/img-1', mime: 'image/png', size_bytes: PNG.length, position: 0 });
    const adm = await admin();
    const url = '/media/products/44444444-4444-4444-8444-444444444444';
    expect((await api(undefined, 'GET', url)).statusCode).toBe(404);
    expect((await api(customer, 'GET', url)).statusCode).toBe(404);
    const seen = await api(adm, 'GET', url);
    expect(seen.statusCode).toBe(200);
    expect(seen.headers['cache-control']).toContain('private');
  });
});
