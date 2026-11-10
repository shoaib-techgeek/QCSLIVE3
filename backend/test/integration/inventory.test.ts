import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { FixedClock } from '../../src/shared/clock.js';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };

describe('inventory', () => {
  let ctx: TestContext;
  let clock: FixedClock;
  let inv: InventoryService;
  beforeAll(async () => {
    ctx = await startTestApp({ REQUIRE_EMAIL_VERIFICATION: 'false' });
    clock = new FixedClock(new Date('2026-11-09T10:00:00Z'));
    inv = new InventoryService(ctx.db, clock, async (publicIds) => {
      const rows = await ctx.db('skus').whereIn('public_id', publicIds).select('id', 'public_id');
      return new Map(rows.map((r) => [r.public_id as string, Number(r.id)]));
    });
  });
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
  async function seller(email: string, store: string): Promise<string> {
    const cookie = await signIn(email);
    await api(cookie, 'POST', '/seller/profile', { storeName: store });
    return cookie;
  }
  /** Creates a product with `n` single-variant SKUs; returns their public ids and internal ids. */
  async function skus(cookie: string, n: number, prefix = 'S') {
    const options = n > 1 ? [{ name: 'Size', values: Array.from({ length: n }, (_, i) => `v${i}`) }] : [];
    const body = { title: `Item ${prefix}`, categorySlug: 'men', options, skus: Array.from({ length: n }, (_, i) => ({ sellerSku: `${prefix}${i}`, options: n > 1 ? { Size: `v${i}` } : {}, priceMinor: 1000 })) };
    const res = await api(cookie, 'POST', '/seller/products', body);
    const list = res.json().product.skus as { id: string }[];
    const rows = await ctx.db('skus').whereIn('public_id', list.map((s) => s.id)).select('id', 'public_id');
    return list.map((s) => ({ publicId: s.id, id: Number(rows.find((r) => r.public_id === s.id)!.id) }));
  }
  const stock = async (skuId: number) => ctx.db('inventory_items').where({ sku_id: skuId }).first();
  const setStock = (skuId: number, skuPublicId: string, onHand: number) => inv.setOnHand({ skuId, skuPublicId }, onHand, { actorId: 'tester', note: 'test' });

  describe('no overselling', () => {
    it('lets exactly one of 50 parallel reservations win when stock is 1', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 1);
      const results = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => inv.reserve(`order-${i}`, [{ skuPublicId: a!.publicId, qty: 1 }])));
      const won = results.filter((r) => r.status === 'fulfilled');
      const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(49);
      for (const l of lost) expect(l.reason).toMatchObject({ code: 'OUT_OF_STOCK' });
      expect(await stock(a!.id)).toMatchObject({ on_hand: 1, reserved: 1 });
      expect(await ctx.db('reservations').where({ status: 'reserved' })).toHaveLength(1);
    });

    it('never reserves more than the stock under heavy parallel load', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 10);
      const results = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => inv.reserve(`o-${i}`, [{ skuPublicId: a!.publicId, qty: 1 }])));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
      expect(await stock(a!.id)).toMatchObject({ on_hand: 10, reserved: 10 });
    });

    it('is all-or-nothing across lines: one sold-out line rolls back the others', async () => {
      const [a, b] = await skus(await seller('ali@example.com', 'Ali Traders'), 2);
      await setStock(a!.id, a!.publicId, 5);
      await setStock(b!.id, b!.publicId, 0);
      await expect(inv.reserve('order-x', [{ skuPublicId: a!.publicId, qty: 2 }, { skuPublicId: b!.publicId, qty: 1 }])).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });
      expect(await stock(a!.id)).toMatchObject({ reserved: 0 });
      expect(await ctx.db('reservations')).toHaveLength(0);
    });

    it('treats a SKU that has no stock record as sold out, and an unknown SKU as not found', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await expect(inv.reserve('o1', [{ skuPublicId: a!.publicId, qty: 1 }])).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });
      await expect(inv.reserve('o2', [{ skuPublicId: '00000000-0000-4000-8000-000000000000', qty: 1 }])).rejects.toMatchObject({ code: 'SKU_NOT_FOUND' });
    });

    it('rejects empty orders, zero or fractional quantities and repeated SKUs', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 5);
      for (const lines of [[], [{ skuPublicId: a!.publicId, qty: 0 }], [{ skuPublicId: a!.publicId, qty: 1.5 }], [{ skuPublicId: a!.publicId, qty: 1 }, { skuPublicId: a!.publicId, qty: 1 }]]) {
        await expect(inv.reserve('bad', lines)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      }
      expect(await stock(a!.id)).toMatchObject({ reserved: 0 });
    });
  });

  describe('reservation lifecycle', () => {
    it('is idempotent per order: reserving the same order again does not reserve twice', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 5);
      await inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 2 }]);
      await inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 2 }]);
      expect(await stock(a!.id)).toMatchObject({ reserved: 2 });
      await expect(inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 3 }])).rejects.toMatchObject({ code: 'RESERVATION_EXISTS' });
    });

    it('releases a reservation back to stock, and releasing twice changes nothing', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 5);
      await inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 3 }]);
      await inv.release('order-1');
      await inv.release('order-1');
      expect(await stock(a!.id)).toMatchObject({ on_hand: 5, reserved: 0 });
      await expect(inv.reserve('order-2', [{ skuPublicId: a!.publicId, qty: 5 }])).resolves.toBeUndefined();
    });

    it('commits a reservation on shipment: stock leaves for good, and it can no longer be released', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 5);
      await inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 2 }]);
      await inv.commit('order-1');
      expect(await stock(a!.id)).toMatchObject({ on_hand: 3, reserved: 0 });
      await inv.release('order-1');
      await inv.commit('order-1');
      expect(await stock(a!.id)).toMatchObject({ on_hand: 3, reserved: 0 });
    });

    it('releases only expired, still-reserved reservations, and is safe to run twice', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 10);
      const soon = new Date(clock.now().getTime() + 30 * 60_000);
      const later = new Date(clock.now().getTime() + 60 * 60_000);
      await inv.reserve('expires-soon', [{ skuPublicId: a!.publicId, qty: 2 }], soon);
      await inv.reserve('expires-later', [{ skuPublicId: a!.publicId, qty: 3 }], later);
      await inv.reserve('never-expires', [{ skuPublicId: a!.publicId, qty: 1 }]);
      await inv.reserve('shipped', [{ skuPublicId: a!.publicId, qty: 1 }], soon);
      await inv.commit('shipped');
      clock.advanceMs(45 * 60_000);
      expect(await inv.releaseExpired()).toBe(1);
      expect(await inv.releaseExpired()).toBe(0);
      expect(await stock(a!.id)).toMatchObject({ on_hand: 9, reserved: 4 });
    });

    it('emits inventory events in the same transaction, and out_of_stock when the last unit goes', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 1);
      await ctx.db('outbox_events').delete();
      await inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 1 }]);
      const types = (await ctx.db('outbox_events').orderBy('id')).map((e) => e.type);
      expect(types).toEqual(['inventory.reserved', 'inventory.out_of_stock']);
      await expect(inv.reserve('order-2', [{ skuPublicId: a!.publicId, qty: 1 }])).rejects.toThrow();
      expect(await ctx.db('outbox_events')).toHaveLength(2); // a failed reservation leaves no event behind
    });
  });

  describe('stock adjustments', () => {
    it('creates the stock record on first set, records a movement, and refuses to go below reserved units', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      expect(await stock(a!.id)).toBeUndefined();
      await setStock(a!.id, a!.publicId, 10);
      expect(await stock(a!.id)).toMatchObject({ on_hand: 10, reserved: 0 });
      await inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 4 }]);
      await expect(setStock(a!.id, a!.publicId, 3)).rejects.toMatchObject({ code: 'BELOW_RESERVED' });
      await setStock(a!.id, a!.publicId, 4);
      expect(await stock(a!.id)).toMatchObject({ on_hand: 4, reserved: 4 });
      const adj = await ctx.db('stock_movements').where({ reason: 'adjustment' }).orderBy('id');
      expect(adj.map((m) => Number(m.delta_on_hand))).toEqual([10, -6]);
      expect(adj[0]).toMatchObject({ actor_id: 'tester', note: 'test' });
    });

    it('keeps the movement ledger equal to the stock after any random sequence of operations', async () => {
      const [a] = await skus(await seller('ali@example.com', 'Ali Traders'), 1);
      await setStock(a!.id, a!.publicId, 20);
      let seed = 12345;
      const rand = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
      const open: string[] = [];
      for (let i = 0; i < 120; i++) {
        const op = rand(5);
        try {
          if (op === 0) { const ref = `r${i}`; await inv.reserve(ref, [{ skuPublicId: a!.publicId, qty: 1 + rand(4) }]); open.push(ref); }
          else if (op === 1 && open.length) await inv.release(open.splice(rand(open.length), 1)[0]!);
          else if (op === 2 && open.length) await inv.commit(open.splice(rand(open.length), 1)[0]!);
          else if (op === 3) await setStock(a!.id, a!.publicId, rand(40));
          else await inv.releaseExpired();
        } catch (e) {
          expect(['OUT_OF_STOCK', 'BELOW_RESERVED']).toContain((e as { code: string }).code);
        }
        const s = await stock(a!.id);
        expect(Number(s.reserved)).toBeLessThanOrEqual(Number(s.on_hand));
      }
      const moves = await ctx.db('stock_movements').where({ sku_id: a!.id });
      const sum = (k: 'delta_on_hand' | 'delta_reserved') => moves.reduce((t, m) => t + Number(m[k]), 0);
      const s = await stock(a!.id);
      expect(sum('delta_on_hand')).toBe(Number(s.on_hand));
      expect(sum('delta_reserved')).toBe(Number(s.reserved));
    });
  });

  describe('seller API', () => {
    it('requires a session', async () => {
      expect((await api(undefined, 'PUT', '/seller/skus/00000000-0000-4000-8000-000000000000/stock', { onHand: 1 })).statusCode).toBe(401);
    });

    it('sets stock on your own SKU and shows it on the product, with available units', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const [a] = await skus(cookie, 1);
      const res = await api(cookie, 'PUT', `/seller/skus/${a!.publicId}/stock`, { onHand: 12, note: 'Counted the shelf' });
      expect(res.statusCode).toBe(200);
      expect(res.json().stock).toEqual({ onHand: 12, reserved: 0, available: 12 });
      await inv.reserve('order-1', [{ skuPublicId: a!.publicId, qty: 5 }]);
      const list = await api(cookie, 'GET', '/seller/products');
      const productId = list.json().items[0].id;
      const detail = (await api(cookie, 'GET', `/seller/products/${productId}`)).json().product;
      expect(detail.skus[0].stock).toEqual({ onHand: 12, reserved: 5, available: 7 });
    });

    it('shows zero stock for a SKU that was never counted', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      await skus(cookie, 1);
      const id = (await api(cookie, 'GET', '/seller/products')).json().items[0].id;
      expect((await api(cookie, 'GET', `/seller/products/${id}`)).json().product.skus[0].stock).toEqual({ onHand: 0, reserved: 0, available: 0 });
    });

    it("cannot change another seller's stock (404) and cannot go below reserved units (409)", async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      const b = await seller('sara@example.com', 'Sara Shop');
      const [sku] = await skus(a, 1);
      await api(a, 'PUT', `/seller/skus/${sku!.publicId}/stock`, { onHand: 5 });
      expect((await api(b, 'PUT', `/seller/skus/${sku!.publicId}/stock`, { onHand: 999 })).statusCode).toBe(404);
      expect((await stock(sku!.id)).on_hand).toBe(5);
      await inv.reserve('order-1', [{ skuPublicId: sku!.publicId, qty: 4 }]);
      const low = await api(a, 'PUT', `/seller/skus/${sku!.publicId}/stock`, { onHand: 2 });
      expect(low.statusCode).toBe(409);
      expect(low.json().error.code).toBe('BELOW_RESERVED');
    });

    it.each([[{ onHand: -1 }], [{ onHand: 1.5 }], [{ onHand: '5' }], [{}], [{ onHand: 1, reserved: 9 }]])('rejects %j', async (payload) => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const [a] = await skus(cookie, 1);
      expect((await api(cookie, 'PUT', `/seller/skus/${a!.publicId}/stock`, payload)).statusCode).toBe(400);
    });
  });
});
