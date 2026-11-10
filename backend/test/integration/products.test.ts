import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const PDF = Buffer.from('%PDF-1.4\n%test');

function multipart(filename: string, content: Buffer, altText?: string) {
  const b = '----qcsimg';
  const parts = [
    ...(altText ? [Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="altText"\r\n\r\n${altText}\r\n`)] : []),
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${b}--\r\n`),
  ];
  return { body: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}

describe('seller products', () => {
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
  const upload = (cookie: string, productId: string, filename: string, content: Buffer, alt?: string) => {
    const m = multipart(filename, content, alt);
    return ctx.app.inject({ method: 'POST', url: `/api/v1/seller/products/${productId}/images`, headers: { ...H, cookie, ...m.headers }, payload: m.body });
  };

  async function seller(email: string, store: string, approved = true): Promise<string> {
    const cookie = await signIn(email);
    await api(cookie, 'POST', '/seller/profile', { storeName: store });
    if (approved) await ctx.db('sellers').where({ store_name: store }).update({ kyc_status: 'approved', status: 'active' });
    return cookie;
  }
  const SHIRT = {
    title: 'Cotton T-shirt',
    description: 'Soft cotton. <script>alert(1)</script>',
    categorySlug: 'men',
    options: [{ name: 'Color', values: ['Red', 'Blue'] }, { name: 'Size', values: ['S', 'M', 'L'] }],
    skus: ['Red', 'Blue'].flatMap((c) => ['S', 'M', 'L'].map((s) => ({ sellerSku: `${c}-${s}`.toUpperCase(), options: { Color: c, Size: s }, priceMinor: 99900, compareAtMinor: 129900 }))),
  };
  const create = (cookie: string, body: object = SHIRT) => api(cookie, 'POST', '/seller/products', body);

  describe('create and read', () => {
    it('requires a session and a store', async () => {
      expect((await api(undefined, 'GET', '/seller/products')).statusCode).toBe(401);
      const noStore = await signIn('ali@example.com');
      const res = await create(noStore);
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('SELLER_NOT_FOUND');
    });

    it('creates a draft with 6 variants, platform currency, slug, status history and no event yet', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders', false); // drafting is allowed before approval
      const res = await create(cookie);
      expect(res.statusCode).toBe(201);
      const p = res.json().product;
      expect(p).toMatchObject({ title: 'Cotton T-shirt', status: 'draft', category: { slug: 'men' } });
      expect(p.slug).toMatch(/^cotton-t-shirt-[a-z0-9]{4,}$/);
      expect(p.skus).toHaveLength(6);
      expect(p.skus[0]).toMatchObject({ sellerSku: 'RED-S', options: { Color: 'Red', Size: 'S' }, priceMinor: 99900, compareAtMinor: 129900, currency: 'PKR' });
      expect(p.options).toEqual([{ name: 'Color', values: ['Red', 'Blue'] }, { name: 'Size', values: ['S', 'M', 'L'] }]);
      expect(await ctx.db('product_status_history').where({ to_status: 'draft' })).toHaveLength(1);
      expect(await ctx.db('price_history')).toHaveLength(6);
    });

    it('stores the description as plain text, never interpreting it', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      expect(p.description).toBe('Soft cotton. <script>alert(1)</script>');
    });

    it('creates a product without options as one default SKU', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const res = await create(cookie, { title: 'Phone stand', categorySlug: 'phones', skus: [{ sellerSku: 'STAND-1', options: {}, priceMinor: 49900 }] });
      expect(res.statusCode).toBe(201);
      expect(res.json().product.skus).toHaveLength(1);
    });

    it.each([
      ['a missing variant', (b: typeof SHIRT) => ({ ...b, skus: b.skus.slice(1) })],
      ['a duplicate variant', (b: typeof SHIRT) => ({ ...b, skus: [...b.skus, { ...b.skus[0]!, sellerSku: 'DUP' }] })],
      ['a SKU outside the matrix', (b: typeof SHIRT) => ({ ...b, skus: [...b.skus.slice(1), { ...b.skus[0]!, options: { Color: 'Green', Size: 'S' } }] })],
      ['a repeated seller SKU code', (b: typeof SHIRT) => ({ ...b, skus: b.skus.map((s) => ({ ...s, sellerSku: 'SAME' })) })],
      ['a zero price', (b: typeof SHIRT) => ({ ...b, skus: b.skus.map((s, i) => (i === 0 ? { ...s, priceMinor: 0 } : s)) })],
      ['a price with decimals', (b: typeof SHIRT) => ({ ...b, skus: b.skus.map((s, i) => (i === 0 ? { ...s, priceMinor: 10.5 } : s)) })],
      ['an original price not above the price', (b: typeof SHIRT) => ({ ...b, skus: b.skus.map((s, i) => (i === 0 ? { ...s, compareAtMinor: 99900 } : s)) })],
      ['an unknown category', (b: typeof SHIRT) => ({ ...b, categorySlug: 'nope' })],
      ['a blank title', (b: typeof SHIRT) => ({ ...b, title: '   ' })],
      ['too many options', (b: typeof SHIRT) => ({ ...b, options: [...b.options, { name: 'A', values: ['1'] }, { name: 'B', values: ['1'] }], skus: [] })],
      ['a client-chosen status', (b: typeof SHIRT) => ({ ...b, status: 'active' })],
    ])('rejects %s with 400', async (_label, mutate) => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const res = await create(cookie, mutate(SHIRT));
      expect(res.statusCode).toBe(400);
      expect(await ctx.db('products')).toHaveLength(0);
    });

    it('keeps SKU codes unique per seller across products, but not across sellers', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const b = await seller('sara@example.com', 'Sara Shop');
      const one = { title: 'A', categorySlug: 'men', skus: [{ sellerSku: 'CODE-1', options: {}, priceMinor: 1000 }] };
      expect((await create(a, one)).statusCode).toBe(201);
      const dupe = await create(a, { ...one, title: 'B' });
      expect(dupe.statusCode).toBe(409);
      expect(dupe.json().error.code).toBe('SKU_CODE_TAKEN');
      expect((await create(b, one)).statusCode).toBe(201);
    });

    it('lists only your own products, newest first, with a cursor', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const b = await seller('sara@example.com', 'Sara Shop');
      for (const n of [1, 2, 3]) await create(a, { title: `Item ${n}`, categorySlug: 'men', skus: [{ sellerSku: `S${n}`, options: {}, priceMinor: 1000 * n }] });
      await create(b, { title: 'Hers', categorySlug: 'men', skus: [{ sellerSku: 'H1', options: {}, priceMinor: 500 }] });
      const page1 = (await api(a, 'GET', '/seller/products?limit=2')).json();
      expect(page1.items.map((i: { title: string }) => i.title)).toEqual(['Item 3', 'Item 2']);
      expect(page1.items[0]).toMatchObject({ status: 'draft', priceFromMinor: 3000 });
      const page2 = (await api(a, 'GET', `/seller/products?limit=2&cursor=${page1.nextCursor}`)).json();
      expect(page2.items.map((i: { title: string }) => i.title)).toEqual(['Item 1']);
      expect(page2.nextCursor).toBeNull();
    });

    it("cannot read, edit, submit, delete or add images to another seller's product (404)", async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const b = await seller('sara@example.com', 'Sara Shop');
      const p = (await create(a)).json().product;
      expect((await api(b, 'GET', `/seller/products/${p.id}`)).statusCode).toBe(404);
      expect((await api(b, 'PATCH', `/seller/products/${p.id}`, { title: 'Mine now' })).statusCode).toBe(404);
      expect((await api(b, 'POST', `/seller/products/${p.id}/submit`)).statusCode).toBe(404);
      expect((await api(b, 'DELETE', `/seller/products/${p.id}`)).statusCode).toBe(404);
      expect((await upload(b, p.id, 'a.png', PNG)).statusCode).toBe(404);
      expect((await api(b, 'PATCH', `/seller/products/${p.id}`, { skus: [{ id: p.skus[0].id, priceMinor: 1 }] })).statusCode).toBe(404);
    });
  });

  describe('editing', () => {
    it('edits title, description and category of a draft', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      const res = await api(cookie, 'PATCH', `/seller/products/${p.id}`, { title: 'Cotton Tee', description: null, categorySlug: 'women' });
      expect(res.statusCode).toBe(200);
      expect(res.json().product).toMatchObject({ title: 'Cotton Tee', description: null, category: { slug: 'women' } });
      expect(res.json().product.slug).toBe(p.slug); // the public link never changes
    });

    it('records price history and a price.changed event when a price changes, and none when it does not', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      await ctx.db('outbox_events').delete();
      const sku = p.skus[0];
      const res = await api(cookie, 'PATCH', `/seller/products/${p.id}`, { skus: [{ id: sku.id, priceMinor: 89900 }, { id: p.skus[1].id, priceMinor: 99900 }] });
      expect(res.statusCode).toBe(200);
      expect(res.json().product.skus[0].priceMinor).toBe(89900);
      const hist = await ctx.db('price_history').where({ new_minor: 89900 });
      expect(hist).toHaveLength(1);
      expect(Number(hist[0].old_minor)).toBe(99900);
      expect(await ctx.db('outbox_events').where({ type: 'price.changed' })).toHaveLength(1); // only the sku that really changed
    });

    it('rejects an invalid price change and a SKU from another product', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      expect((await api(cookie, 'PATCH', `/seller/products/${p.id}`, { skus: [{ id: p.skus[0].id, priceMinor: 0 }] })).statusCode).toBe(400);
      expect((await api(cookie, 'PATCH', `/seller/products/${p.id}`, { skus: [{ id: '00000000-0000-4000-8000-000000000000', priceMinor: 5 }] })).statusCode).toBe(404);
    });

    it('does not let the client change status, slug, seller or rejection reason', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      for (const payload of [{ status: 'active' }, { slug: 'x' }, { sellerId: 1 }, { rejectionReason: 'x' }, {}]) {
        expect((await api(cookie, 'PATCH', `/seller/products/${p.id}`, payload)).statusCode, JSON.stringify(payload)).toBe(400);
      }
    });

    it('locks content while pending review', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      await api(cookie, 'POST', `/seller/products/${p.id}/submit`);
      const res = await api(cookie, 'PATCH', `/seller/products/${p.id}`, { title: 'Changed' });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PRODUCT_LOCKED');
    });
  });

  describe('lifecycle', () => {
    it('blocks submit until the seller is approved (soft KYC policy)', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders', false);
      const p = (await create(cookie)).json().product;
      const res = await api(cookie, 'POST', `/seller/products/${p.id}/submit`);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('SELLER_NOT_APPROVED');
      expect((await api(cookie, 'GET', `/seller/products/${p.id}`)).json().product.status).toBe('draft');
    });

    it('submits for review with history, audit and event; a second submit is refused', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      await ctx.db('outbox_events').delete();
      const res = await api(cookie, 'POST', `/seller/products/${p.id}/submit`);
      expect(res.statusCode).toBe(200);
      expect(res.json().product.status).toBe('pending');
      expect(await ctx.db('product_status_history').where({ to_status: 'pending' })).toHaveLength(1);
      expect(await ctx.db('audit_events').where({ action: 'product.submitted' })).toHaveLength(1);
      expect(await ctx.db('outbox_events').where({ type: 'product.submitted' })).toHaveLength(1);
      expect(await ctx.db('outbox_events').where({ type: 'product.status_changed' })).toHaveLength(1);
      const again = await api(cookie, 'POST', `/seller/products/${p.id}/submit`);
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe('PRODUCT_INVALID_TRANSITION');
    });

    it('lets a seller deactivate and reactivate an active product, and edit it after rejection', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      await ctx.db('products').where({ public_id: p.id }).update({ status: 'active' });
      expect((await api(cookie, 'POST', `/seller/products/${p.id}/deactivate`)).json().product.status).toBe('inactive');
      expect((await api(cookie, 'POST', `/seller/products/${p.id}/activate`)).json().product.status).toBe('active');
      expect((await api(cookie, 'POST', `/seller/products/${p.id}/activate`)).statusCode).toBe(409);
      await ctx.db('products').where({ public_id: p.id }).update({ status: 'rejected', rejection_reason: 'Blurry photos' });
      const rejected = (await api(cookie, 'GET', `/seller/products/${p.id}`)).json().product;
      expect(rejected).toMatchObject({ status: 'rejected', rejectionReason: 'Blurry photos' });
      expect((await api(cookie, 'PATCH', `/seller/products/${p.id}`, { title: 'Fixed' })).statusCode).toBe(200);
    });

    it('soft-deletes drafts only: they disappear, pending ones cannot be deleted', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const draft = (await create(cookie)).json().product;
      const other = (await create(cookie, { title: 'Two', categorySlug: 'men', skus: [{ sellerSku: 'T2', options: {}, priceMinor: 100 }] })).json().product;
      await api(cookie, 'POST', `/seller/products/${other.id}/submit`);
      expect((await api(cookie, 'DELETE', `/seller/products/${draft.id}`)).statusCode).toBe(204);
      expect((await api(cookie, 'GET', `/seller/products/${draft.id}`)).statusCode).toBe(404);
      expect((await api(cookie, 'GET', '/seller/products')).json().items).toHaveLength(1);
      expect((await api(cookie, 'DELETE', `/seller/products/${other.id}`)).statusCode).toBe(409);
      expect(await ctx.db('products').where({ public_id: draft.id })).toHaveLength(1); // kept for history
    });
  });

  describe('images', () => {
    it('stores a png under a private key and lists it with a url', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      const res = await upload(cookie, p.id, 'front.png', PNG, 'Front view');
      expect(res.statusCode).toBe(201);
      const img = res.json().image;
      expect(img).toMatchObject({ altText: 'Front view', position: 0 });
      expect(img.url).toBe(`/api/v1/media/products/${img.id}`);
      const row = await ctx.db('product_images').first();
      expect(row.storage_key).not.toContain('front.png');
      expect(await ctx.storage.get(row.storage_key)).toEqual(PNG);
      expect((await api(cookie, 'GET', `/seller/products/${p.id}`)).json().product.images).toHaveLength(1);
    });

    it('rejects non-images (a pdf, a script named .png) and enforces the 8-image limit', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      expect((await upload(cookie, p.id, 'doc.pdf', PDF)).json().error.code).toBe('FILE_TYPE_NOT_ALLOWED');
      expect((await upload(cookie, p.id, 'x.png', Buffer.from('<script>alert(1)</script>'))).statusCode).toBe(400);
      for (let i = 0; i < 8; i++) expect((await upload(cookie, p.id, `${i}.png`, PNG)).statusCode).toBe(201);
      const ninth = await upload(cookie, p.id, '9.png', PNG);
      expect(ninth.statusCode).toBe(400);
      expect(ninth.json().error.code).toBe('TOO_MANY_FILES');
    });

    it('deletes an image together with its file, only for the owner', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const b = await seller('sara@example.com', 'Sara Shop');
      const p = (await create(a)).json().product;
      const img = (await upload(a, p.id, 'a.png', PNG)).json().image;
      const key = (await ctx.db('product_images').first()).storage_key;
      expect((await api(b, 'DELETE', `/seller/products/${p.id}/images/${img.id}`)).statusCode).toBe(404);
      expect((await api(a, 'DELETE', `/seller/products/${p.id}/images/${img.id}`)).statusCode).toBe(204);
      expect(await ctx.storage.get(key)).toBeNull();
    });

    it('locks images while the product is pending review', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const p = (await create(cookie)).json().product;
      await api(cookie, 'POST', `/seller/products/${p.id}/submit`);
      expect((await upload(cookie, p.id, 'a.png', PNG)).statusCode).toBe(409);
    });

    it('serves images publicly only for active products; owners can preview their drafts', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const other = await seller('sara@example.com', 'Sara Shop');
      const p = (await create(cookie)).json().product;
      const img = (await upload(cookie, p.id, 'a.png', PNG)).json().image;
      expect((await api(undefined, 'GET', `/media/products/${img.id}`)).statusCode).toBe(404);
      expect((await api(other, 'GET', `/media/products/${img.id}`)).statusCode).toBe(404);
      const own = await api(cookie, 'GET', `/media/products/${img.id}`);
      expect(own.statusCode).toBe(200);
      expect(own.headers['cache-control']).toContain('private');

      await ctx.db('products').where({ public_id: p.id }).update({ status: 'active' });
      const pub = await api(undefined, 'GET', `/media/products/${img.id}`);
      expect(pub.statusCode).toBe(200);
      expect(pub.headers['content-type']).toBe('image/png');
      expect(pub.headers['cache-control']).toContain('public');
      expect(pub.rawPayload).toEqual(PNG);
    });
  });
});
