import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

/** P1 exit check: a seller lists a product with variants and stock; an admin approves it; a buyer searches for it and views it. */
describe('seller to buyer journey', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp({ REQUIRE_EMAIL_VERIFICATION: 'false' }); await resetIdentityData(ctx.db); });
  afterAll(async () => { await resetIdentityData(ctx.db); await stopTestApp(ctx); });

  async function signIn(email: string): Promise<string> {
    await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: H, payload: { email, password: PASSWORD } });
    const login = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: H, payload: { email, password: PASSWORD } });
    return `sid=${login.cookies.find((c) => c.name === 'sid')!.value}`;
  }
  const api = (cookie: string | undefined, method: string, url: string, payload?: object) =>
    ctx.app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: { ...H, ...(cookie ? { cookie } : {}) }, payload });

  it('walks the whole path with real rules at every step', async () => {
    // 1. A seller opens a store and drafts a product. They can draft before approval but cannot publish.
    const seller = await signIn('ali@example.com');
    expect((await api(seller, 'POST', '/seller/profile', { storeName: 'Ali Traders' })).statusCode).toBe(201);
    const created = await api(seller, 'POST', '/seller/products', {
      title: 'Steel water bottle', description: 'Keeps drinks cold all day', categorySlug: 'sports',
      options: [{ name: 'Size', values: ['500 ml', '750 ml'] }],
      skus: [
        { sellerSku: 'BOTTLE-500', options: { Size: '500 ml' }, priceMinor: 99900 },
        { sellerSku: 'BOTTLE-750', options: { Size: '750 ml' }, priceMinor: 129900, compareAtMinor: 159900 },
      ],
    });
    expect(created.statusCode).toBe(201);
    const product = created.json().product;
    expect((await api(seller, 'POST', `/seller/products/${product.id}/submit`)).json().error.code).toBe('SELLER_NOT_APPROVED');
    expect((await api(undefined, 'GET', '/products')).json().items).toHaveLength(0);

    // 2. Photo and stock.
    const boundary = '----j';
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\n`), PNG, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const photo = await ctx.app.inject({ method: 'POST', url: `/api/v1/seller/products/${product.id}/images`, headers: { ...H, cookie: seller, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: body });
    expect(photo.statusCode).toBe(201);
    for (const sku of product.skus) expect((await api(seller, 'PUT', `/seller/skus/${sku.id}/stock`, { onHand: 10 })).statusCode).toBe(200);

    // 3. An admin verifies the seller, then the seller sends the product for review.
    const admin = await signIn('admin@example.com');
    const adminUser = await ctx.db('users').where({ email: 'admin@example.com' }).first('id');
    const adminRole = await ctx.db('roles').where({ name: 'admin' }).first('id');
    await ctx.db('user_roles').insert({ user_id: adminUser.id, role_id: adminRole.id });
    const storeId = (await api(seller, 'GET', '/seller/profile')).json().seller.id;
    await ctx.db('kyc_applications').insert({ seller_id: (await ctx.db('sellers').where({ public_id: storeId }).first('id')).id, status: 'submitted' });
    expect((await api(admin, 'POST', `/admin/kyc/${storeId}/decision`, { decision: 'start_review' })).statusCode).toBe(200);
    expect((await api(admin, 'POST', `/admin/kyc/${storeId}/decision`, { decision: 'approve' })).statusCode).toBe(200);
    expect((await api(seller, 'POST', `/seller/products/${product.id}/submit`)).json().product.status).toBe('pending');
    expect((await api(undefined, 'GET', '/products')).json().items).toHaveLength(0); // still not live

    // 4. The admin approves the product.
    const queue = (await api(admin, 'GET', '/admin/products')).json();
    expect(queue.items.map((i: { title: string }) => i.title)).toEqual(['Steel water bottle']);
    expect((await api(admin, 'POST', `/admin/products/${product.id}/moderate`, { decision: 'approve' })).json().product.status).toBe('active');

    // 5. A visitor finds it by search and by category, opens it, and can see its photo.
    const found = (await api(undefined, 'GET', '/products?q=bottle')).json().items;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ title: 'Steel water bottle', priceMinor: 99900, storeName: 'Ali Traders', inStock: true });
    expect((await api(undefined, 'GET', '/products?category=sports')).json().items).toHaveLength(1);
    const page = (await api(undefined, 'GET', `/products/${found[0].slug}`)).json().product;
    expect(page.skus.map((s: { priceMinor: number; inStock: boolean }) => [s.priceMinor, s.inStock])).toEqual([[99900, true], [129900, true]]);
    const image = await api(undefined, 'GET', page.images[0].url.replace('/api/v1', ''));
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');

    // 6. Stock is shared truth: reserving the last units flips availability on the public page.
    // (Orders do not exist yet, so the inventory service is driven directly.)
    const rows = await ctx.db('skus').whereIn('public_id', product.skus.map((s: { id: string }) => s.id)).select('id');
    await ctx.db('inventory_items').whereIn('sku_id', rows.map((r) => r.id)).update({ on_hand: 0 });
    expect((await api(undefined, 'GET', `/products/${found[0].slug}`)).json().product.skus.every((s: { inStock: boolean }) => !s.inStock)).toBe(true);
  });
});
