import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };

describe('public catalogue', () => {
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
  const get = (url: string) => ctx.app.inject({ url: `/api/v1${url}` });

  async function seller(email: string, store: string): Promise<string> {
    const cookie = await signIn(email);
    await api(cookie, 'POST', '/seller/profile', { storeName: store, description: `About ${store}` });
    await ctx.db('sellers').where({ store_name: store }).update({ kyc_status: 'approved', status: 'active' });
    return cookie;
  }
  /** Creates a product and (by default) makes it live with stock, like an approved listing would be. */
  async function live(cookie: string, input: { title: string; category?: string; price?: number; compareAt?: number; description?: string; status?: string; stock?: number; options?: boolean }) {
    const options = input.options ? [{ name: 'Size', values: ['S', 'M'] }] : [];
    const skus = (input.options ? ['S', 'M'] : [null]).map((v, i) => ({
      sellerSku: `${input.title.replace(/\W/g, '').slice(0, 10)}-${i}`, options: v ? { Size: v } : {}, priceMinor: (input.price ?? 10000) + i * 500, compareAtMinor: input.compareAt,
    }));
    const res = await api(cookie, 'POST', '/seller/products', { title: input.title, description: input.description, categorySlug: input.category ?? 'men', options, skus });
    const p = res.json().product;
    await ctx.db('products').where({ public_id: p.id }).update({ status: input.status ?? 'active' });
    const rows = await ctx.db('skus').where({ product_id: ctx.db('products').where({ public_id: p.id }).select('id') }).select('id');
    for (const r of rows) await ctx.db('inventory_items').insert({ sku_id: r.id, on_hand: input.stock ?? 5 }).onConflict('sku_id').merge();
    return p as { id: string; slug: string; skus: { id: string }[] };
  }

  describe('categories', () => {
    it('lists the active categories in order, without private fields', async () => {
      const res = await get('/categories');
      expect(res.statusCode).toBe(200);
      const items = res.json().items as { slug: string; name: string }[];
      expect(items.map((c) => c.slug).slice(0, 3)).toEqual(['women', 'men', 'home-kitchen']);
      expect(Object.keys(items[0]!).sort()).toEqual(['name', 'slug']);
    });
    it('hides inactive categories', async () => {
      await ctx.db('categories').where({ slug: 'automotive' }).update({ active: false });
      expect((await get('/categories')).json().items.map((c: { slug: string }) => c.slug)).not.toContain('automotive');
      await ctx.db('categories').where({ slug: 'automotive' }).update({ active: true });
    });
  });

  describe('listing and search', () => {
    it('shows only active products, newest first, with price, image and store', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await live(a, { title: 'Old shirt' });
      await live(a, { title: 'Draft shirt', status: 'draft' });
      await live(a, { title: 'Pending shirt', status: 'pending' });
      await live(a, { title: 'Banned shirt', status: 'banned' });
      await live(a, { title: 'Inactive shirt', status: 'inactive' });
      await live(a, { title: 'New shirt', price: 12000, compareAt: 15000 });
      const res = await get('/products');
      expect(res.statusCode).toBe(200);
      const items = res.json().items;
      expect(items.map((i: { title: string }) => i.title)).toEqual(['New shirt', 'Old shirt']);
      expect(items[0]).toMatchObject({ priceMinor: 12000, compareAtMinor: 15000, currency: 'PKR', storeName: 'Ali Traders', category: { slug: 'men' }, inStock: true });
      expect(res.headers['cache-control']).toContain('public');
    });

    it('never exposes private fields', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, { title: 'Shirt', options: true });
      const list = JSON.stringify((await get('/products')).json());
      const detail = JSON.stringify((await get(`/products/${p.slug}`)).json());
      for (const text of [list, detail]) {
        for (const secret of ['sellerSku', 'seller_id', 'sellerId', 'rejectionReason', 'on_hand', 'onHand', 'reserved', 'storage_key', 'history', 'user_id', 'kyc']) {
          expect(text, secret).not.toContain(secret);
        }
      }
    });

    it('takes a product off the public list at once when the seller hides it, and browsers never reuse an old copy', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, { title: 'Shirt' });
      const before = await get('/products');
      expect(before.json().items).toHaveLength(1);
      expect(before.headers['cache-control']).toContain('max-age=0');
      expect((await api(a, 'POST', `/seller/products/${p.id}/deactivate`)).json().product.status).toBe('inactive');
      expect((await get('/products')).json().items).toHaveLength(0);
      expect((await get(`/products/${p.slug}`)).statusCode).toBe(404);
      expect((await get('/products?q=shirt')).json().items).toHaveLength(0);
    });

    it('hides products from a seller that is not active or whose SKUs are all inactive', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, { title: 'Shirt' });
      await ctx.db('skus').where({ public_id: p.skus[0]!.id }).update({ active: false });
      expect((await get('/products')).json().items).toHaveLength(0);
      await ctx.db('skus').where({ public_id: p.skus[0]!.id }).update({ active: true });
      await ctx.db('sellers').where({ store_name: 'Ali Traders' }).update({ status: 'suspended' });
      expect((await get('/products')).json().items).toHaveLength(0);
    });

    it('filters by category and by price range, using the lowest SKU price', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await live(a, { title: 'Cheap shirt', price: 5000 });
      await live(a, { title: 'Pricey phone stand', price: 50000, category: 'phones' });
      expect((await get('/products?category=phones')).json().items.map((i: { title: string }) => i.title)).toEqual(['Pricey phone stand']);
      expect((await get('/products?minPrice=10000')).json().items.map((i: { title: string }) => i.title)).toEqual(['Pricey phone stand']);
      expect((await get('/products?maxPrice=10000')).json().items.map((i: { title: string }) => i.title)).toEqual(['Cheap shirt']);
      expect((await get('/products?category=nope')).json().items).toEqual([]);
    });

    it('searches titles and descriptions, including short words', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await live(a, { title: 'Stainless steel water bottle', description: 'Keeps drinks cold for a day' });
      await live(a, { title: 'Cotton bedsheet', description: 'Soft and breathable' });
      await live(a, { title: 'USB hub', description: 'Seven ports' });
      const titles = async (q: string) => (await get(`/products?q=${encodeURIComponent(q)}`)).json().items.map((i: { title: string }) => i.title);
      expect(await titles('bottle')).toEqual(['Stainless steel water bottle']);
      expect(await titles('breathable')).toEqual(['Cotton bedsheet']);
      expect(await titles('usb')).toEqual(['USB hub']);
      expect(await titles('hub')).toEqual(['USB hub']);
      expect(await titles('zzzz')).toEqual([]);
    });

    it('treats search text as text: wildcards and injection attempts match nothing', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await live(a, { title: 'Plain shirt' });
      for (const q of ['%', '_', "' OR 1=1 --", '"; DROP TABLE products; --', '+-*()<>~']) {
        const res = await get(`/products?q=${encodeURIComponent(q)}`);
        expect(res.statusCode, q).toBe(200);
        expect(res.json().items, q).toEqual([]);
      }
      expect(await ctx.db('products')).toHaveLength(1);
    });

    it('sorts by price both ways and pages through results with an opaque cursor', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      for (const [t, price] of [['B', 20000], ['A', 10000], ['C', 30000]] as const) await live(a, { title: `Item ${t}`, price });
      const titles = (r: { json: () => { items: { title: string }[] } }) => r.json().items.map((i) => i.title);
      expect(titles(await get('/products?sort=price_asc'))).toEqual(['Item A', 'Item B', 'Item C']);
      expect(titles(await get('/products?sort=price_desc'))).toEqual(['Item C', 'Item B', 'Item A']);

      const p1 = (await get('/products?sort=price_asc&limit=2')).json();
      expect(p1.items.map((i: { title: string }) => i.title)).toEqual(['Item A', 'Item B']);
      expect(typeof p1.nextCursor).toBe('string');
      const p2 = (await get(`/products?sort=price_asc&limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`)).json();
      expect(p2.items.map((i: { title: string }) => i.title)).toEqual(['Item C']);
      expect(p2.nextCursor).toBeNull();

      const n1 = (await get('/products?limit=2')).json();
      const n2 = (await get(`/products?limit=2&cursor=${encodeURIComponent(n1.nextCursor)}`)).json();
      expect([...n1.items, ...n2.items].map((i: { title: string }) => i.title)).toEqual(['Item C', 'Item A', 'Item B']);
    });

    it('rejects bad parameters and a tampered cursor with 400', async () => {
      for (const q of ['sort=random', 'limit=0', 'limit=500', 'minPrice=-1', 'minPrice=abc', 'cursor=not-a-cursor', 'cursor=' + Buffer.from('{"x":1}').toString('base64url')]) {
        expect((await get(`/products?${q}`)).statusCode, q).toBe(400);
      }
    });

    it('marks products with no units available as out of stock but still lists them', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await live(a, { title: 'Sold out shirt', stock: 0 });
      expect((await get('/products')).json().items[0]).toMatchObject({ title: 'Sold out shirt', inStock: false });
    });
  });

  describe('product page', () => {
    it('returns the live product with options, per-variant availability and images, and nothing private', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const p = await live(a, { title: 'Shirt', options: true, description: 'Soft cotton.' });
      await ctx.db('inventory_items').where({ sku_id: ctx.db('skus').where({ public_id: p.skus[1]!.id }).select('id') }).update({ on_hand: 0 });
      const res = await get(`/products/${p.slug}`);
      expect(res.statusCode).toBe(200);
      const prod = res.json().product;
      expect(prod).toMatchObject({ id: p.id, title: 'Shirt', description: 'Soft cotton.', category: { slug: 'men' }, store: { name: 'Ali Traders' } });
      expect(prod.options).toEqual([{ name: 'Size', values: ['S', 'M'] }]);
      expect(prod.skus.map((s: { options: object; inStock: boolean }) => [s.options, s.inStock])).toEqual([[{ Size: 'S' }, true], [{ Size: 'M' }, false]]);
      expect(res.headers['cache-control']).toContain('public');
    });

    it('is 404 for products that are not live, and for unknown slugs', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      for (const status of ['draft', 'pending', 'rejected', 'banned', 'inactive']) {
        const p = await live(a, { title: `P ${status}`, status });
        expect((await get(`/products/${p.slug}`)).statusCode, status).toBe(404);
      }
      expect((await get('/products/nope')).statusCode).toBe(404);
    });
  });

  describe('stores', () => {
    it('shows an active store page without private fields, and 404 for others', async () => {
      await seller('ali@example.com', 'Ali Traders');
      const res = await get('/stores/ali-traders');
      expect(res.statusCode).toBe(200);
      expect(res.json().store).toEqual({ name: 'Ali Traders', slug: 'ali-traders', description: 'About Ali Traders' });
      await ctx.db('sellers').where({ store_name: 'Ali Traders' }).update({ status: 'suspended' });
      expect((await get('/stores/ali-traders')).statusCode).toBe(404);
      expect((await get('/stores/nope')).statusCode).toBe(404);
    });
  });
});
