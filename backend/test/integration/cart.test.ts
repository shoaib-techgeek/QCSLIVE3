import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };

describe('cart', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp({ REQUIRE_EMAIL_VERIFICATION: 'false' }); });
  afterAll(async () => { await stopTestApp(ctx); });
  beforeEach(async () => { await resetIdentityData(ctx.db); });

  async function signIn(email: string): Promise<string> {
    await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: H, payload: { email, password: PASSWORD } });
    const login = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: H, payload: { email, password: PASSWORD } });
    return `sid=${login.cookies.find((c) => c.name === 'sid')!.value}`;
  }
  const api = (cookie: string | undefined, method: string, url: string, payload?: object) =>
    ctx.app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: { ...H, ...(cookie ? { cookie } : {}) }, payload });

  async function seller(email: string, store: string): Promise<string> {
    const cookie = await signIn(email);
    await api(cookie, 'POST', '/seller/profile', { storeName: store });
    await ctx.db('sellers').where({ store_name: store }).update({ kyc_status: 'approved', status: 'active' });
    return cookie;
  }
  /** A live product with one SKU; returns the SKU public id and product id. */
  async function live(cookie: string, title: string, price = 50000, stock = 5) {
    const res = await api(cookie, 'POST', '/seller/products', { title, categorySlug: 'men', skus: [{ sellerSku: title.replace(/\W/g, '').slice(0, 12), options: {}, priceMinor: price }] });
    const p = res.json().product;
    await ctx.db('products').where({ public_id: p.id }).update({ status: 'active' });
    const sku = await ctx.db('skus').where({ public_id: p.skus[0].id }).first('id');
    await ctx.db('inventory_items').insert({ sku_id: sku.id, on_hand: stock });
    return { productId: p.id as string, skuId: p.skus[0].id as string, skuRowId: Number(sku.id) };
  }
  const add = (cookie: string, skuId: string, qty = 1) => api(cookie, 'POST', '/cart/items', { skuId, qty });
  const cart = async (cookie: string) => (await api(cookie, 'GET', '/cart')).json();

  it('needs a session, and an empty cart has a clear shape', async () => {
    expect((await api(undefined, 'GET', '/cart')).statusCode).toBe(401);
    const buyer = await signIn('zara@example.com');
    expect(await cart(buyer)).toMatchObject({ groups: [], summary: { itemCount: 0, subtotalMinor: 0, currency: 'PKR' }, changes: [] });
  });

  it('adds items, sums repeats, and groups them by store with line and store totals', async () => {
    const a = await seller('ali@example.com', 'Ali Traders');
    const b = await seller('sara@example.com', 'Sara Shop');
    const shirt = await live(a, 'Shirt', 50000);
    const cap = await live(a, 'Cap', 20000);
    const lamp = await live(b, 'Lamp', 90000);
    const buyer = await signIn('zara@example.com');
    expect((await add(buyer, shirt.skuId, 2)).statusCode).toBe(201);
    await add(buyer, shirt.skuId, 1);
    await add(buyer, cap.skuId, 1);
    await add(buyer, lamp.skuId, 1);
    const c = await cart(buyer);
    expect(c.groups.map((g: { storeName: string }) => g.storeName).sort()).toEqual(['Ali Traders', 'Sara Shop']);
    const ali = c.groups.find((g: { storeName: string }) => g.storeName === 'Ali Traders');
    expect(ali.items.find((i: { product: { title: string } }) => i.product.title === 'Shirt')).toMatchObject({ qty: 3, selected: true, priceMinor: 50000, lineTotalMinor: 150000, changes: [] });
    expect(ali.subtotalMinor).toBe(170000);
    expect(c.summary).toMatchObject({ itemCount: 5, subtotalMinor: 260000 });
  });

  it('refuses things that cannot be bought', async () => {
    const a = await seller('ali@example.com', 'Ali Traders');
    const ok = await live(a, 'Shirt', 50000, 3);
    const hidden = await live(a, 'Hidden', 1000);
    await ctx.db('products').where({ public_id: hidden.productId }).update({ status: 'inactive' });
    const buyer = await signIn('zara@example.com');
    expect((await add(buyer, hidden.skuId)).statusCode).toBe(404);
    expect((await add(buyer, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
    const tooMany = await add(buyer, ok.skuId, 4);
    expect(tooMany.statusCode).toBe(409);
    expect(tooMany.json().error.code).toBe('OUT_OF_STOCK');
    for (const qty of [0, -1, 1.5, '2']) expect((await api(buyer, 'POST', '/cart/items', { skuId: ok.skuId, qty })).statusCode, String(qty)).toBe(400);
    expect((await cart(buyer)).groups).toEqual([]);
  });

  it('enforces the per-item quantity limit, including when adding the same item again', async () => {
    const a = await seller('ali@example.com', 'Ali Traders');
    const p = await live(a, 'Shirt', 1000, 100);
    const buyer = await signIn('zara@example.com');
    expect((await add(buyer, p.skuId, 10)).statusCode).toBe(201);
    const res = await add(buyer, p.skuId, 1);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('QTY_LIMIT');
  });

  it('changes quantity and selection, removes items, and counts only selected items in the summary', async () => {
    const a = await seller('ali@example.com', 'Ali Traders');
    const x = await live(a, 'Shirt', 50000);
    const y = await live(a, 'Cap', 20000);
    const buyer = await signIn('zara@example.com');
    await add(buyer, x.skuId, 1);
    await add(buyer, y.skuId, 1);
    const [i1, i2] = (await cart(buyer)).groups[0].items.map((i: { id: string }) => i.id) as string[];
    expect((await api(buyer, 'PATCH', `/cart/items/${i1}`, { qty: 3 })).statusCode).toBe(200);
    expect((await api(buyer, 'PATCH', `/cart/items/${i2}`, { selected: false })).statusCode).toBe(200);
    expect((await cart(buyer)).summary).toMatchObject({ itemCount: 3, subtotalMinor: 150000 });
    expect((await api(buyer, 'PATCH', `/cart/items/${i1}`, { qty: 0 })).statusCode).toBe(400);
    expect((await api(buyer, 'PATCH', `/cart/items/${i1}`, { qty: 50 })).statusCode).toBe(409);
    expect((await api(buyer, 'PATCH', `/cart/items/${i1}`, {})).statusCode).toBe(400);
    expect((await api(buyer, 'DELETE', `/cart/items/${i1}`)).statusCode).toBe(204);
    expect((await cart(buyer)).groups[0].items).toHaveLength(1);
  });

  it("never lets one buyer see or change another buyer's cart (404)", async () => {
    const a = await seller('ali@example.com', 'Ali Traders');
    const p = await live(a, 'Shirt');
    const one = await signIn('zara@example.com');
    const two = await signIn('mira@example.com');
    await add(one, p.skuId);
    const itemId = (await cart(one)).groups[0].items[0].id;
    expect((await cart(two)).groups).toEqual([]);
    expect((await api(two, 'PATCH', `/cart/items/${itemId}`, { qty: 2 })).statusCode).toBe(404);
    expect((await api(two, 'DELETE', `/cart/items/${itemId}`)).statusCode).toBe(404);
    expect((await cart(one)).groups[0].items[0].qty).toBe(1);
  });

  describe('revalidation on every read', () => {
    it('flags a price change with old and new price, uses the new price, and clears the flag when accepted', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, 'Shirt', 50000);
      const buyer = await signIn('zara@example.com');
      await add(buyer, p.skuId, 2);
      await ctx.db('skus').where({ id: p.skuRowId }).update({ price_minor: 60000 });
      const item = (await cart(buyer)).groups[0].items[0];
      expect(item).toMatchObject({ priceMinor: 60000, lineTotalMinor: 120000 });
      expect(item.changes).toEqual([{ code: 'PRICE_CHANGED', oldMinor: 50000, newMinor: 60000 }]);
      expect((await cart(buyer)).summary.subtotalMinor).toBe(120000);
      await api(buyer, 'PATCH', `/cart/items/${item.id}`, { acceptPrice: true });
      expect((await cart(buyer)).groups[0].items[0].changes).toEqual([]);
    });

    it('flags a product that was hidden, and leaves it out of the summary', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, 'Shirt', 50000);
      const q = await live(a, 'Cap', 20000);
      const buyer = await signIn('zara@example.com');
      await add(buyer, p.skuId);
      await add(buyer, q.skuId);
      await api(a, 'POST', `/seller/products/${p.productId}/deactivate`);
      const c = await cart(buyer);
      const gone = c.groups[0].items.find((i: { product: { title: string } }) => i.product.title === 'Shirt');
      expect(gone.changes.map((x: { code: string }) => x.code)).toEqual(['UNAVAILABLE']);
      expect(c.summary).toMatchObject({ itemCount: 1, subtotalMinor: 20000 });
      expect(c.changes.length).toBeGreaterThan(0);
    });

    it('flags sold-out and reduced stock', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, 'Shirt', 50000, 5);
      const q = await live(a, 'Cap', 20000, 5);
      const buyer = await signIn('zara@example.com');
      await add(buyer, p.skuId, 3);
      await add(buyer, q.skuId, 2);
      await ctx.db('inventory_items').where({ sku_id: p.skuRowId }).update({ on_hand: 1 });
      await ctx.db('inventory_items').where({ sku_id: q.skuRowId }).update({ on_hand: 0 });
      const items = (await cart(buyer)).groups[0].items as { product: { title: string }; changes: { code: string; available?: number }[] }[];
      expect(items.find((i) => i.product.title === 'Shirt')!.changes).toEqual([{ code: 'QTY_EXCEEDS_STOCK', available: 1 }]);
      expect(items.find((i) => i.product.title === 'Cap')!.changes).toEqual([{ code: 'OUT_OF_STOCK' }]);
      expect((await cart(buyer)).summary.subtotalMinor).toBe(0);
    });

    it('treats a suspended seller as unavailable', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, 'Shirt');
      const buyer = await signIn('zara@example.com');
      await add(buyer, p.skuId);
      await ctx.db('sellers').where({ store_name: 'Ali Traders' }).update({ status: 'suspended' });
      expect((await cart(buyer)).groups[0].items[0].changes[0].code).toBe('UNAVAILABLE');
    });
  });
});
