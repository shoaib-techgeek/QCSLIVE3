import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/knex.js';
import { resetIdentityData, testEnv } from './helpers.js';

const db = createDb(testEnv());

describe('catalog schema', () => {
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });
  beforeEach(async () => { await resetIdentityData(db); });

  it('seeds the ten starter categories with unique slugs and paths', async () => {
    const rows = await db('categories').orderBy('position');
    expect(rows.map((r) => r.slug)).toEqual([
      'women', 'men', 'home-kitchen', 'electronics', 'phones', 'beauty-health', 'kids-toys', 'bags-shoes', 'sports', 'automotive',
    ]);
    for (const r of rows) expect(r.path).toBe(`/${r.id}/`);
    expect(rows.every((r) => r.active === 1 || r.active === true)).toBe(true);
  });

  async function seller(email: string, store: string) {
    const [userId] = await db('users').insert({ public_id: `00000000-0000-4000-8000-${String(Math.random()).slice(2, 14).padEnd(12, '0')}`, email, password_hash: 'x' });
    const [sellerId] = await db('sellers').insert({ public_id: `11111111-1111-4111-8111-${String(Math.random()).slice(2, 14).padEnd(12, '0')}`, user_id: userId, store_name: store, slug: store.toLowerCase().replaceAll(' ', '-') });
    return sellerId as number;
  }
  async function product(sellerId: number, slug: string) {
    const cat = await db('categories').first('id');
    const [id] = await db('products').insert({ public_id: `22222222-2222-4222-8222-${String(Math.random()).slice(2, 14).padEnd(12, '0')}`, seller_id: sellerId, category_id: cat.id, title: 'T', slug });
    return id as number;
  }
  const sku = (productId: number, sellerId: number, sellerSku: string, price = 1000, compare: number | null = null) =>
    db('skus').insert({ public_id: `33333333-3333-4333-8333-${String(Math.random()).slice(2, 14).padEnd(12, '0')}`, product_id: productId, seller_id: sellerId, seller_sku: sellerSku, option_value_ids: '[]', price_minor: price, compare_at_minor: compare, currency: 'PKR' });

  it('starts every product as a draft', async () => {
    const s = await seller('a@example.com', 'Store A');
    const p = await product(s, 'p-1');
    expect((await db('products').where({ id: p }).first()).status).toBe('draft');
  });

  it('keeps seller SKU codes unique per seller, not globally', async () => {
    const a = await seller('a@example.com', 'Store A');
    const b = await seller('b@example.com', 'Store B');
    const pa = await product(a, 'p-a');
    const pb = await product(b, 'p-b');
    await sku(pa, a, 'RED-S');
    await expect(sku(pa, a, 'RED-S')).rejects.toThrow();
    await expect(sku(pb, b, 'RED-S')).resolves.toBeDefined();
  });

  it('refuses a zero price and a compare-at price that is not above the price', async () => {
    const s = await seller('a@example.com', 'Store A');
    const p = await product(s, 'p-1');
    await expect(sku(p, s, 'A', 0)).rejects.toThrow();
    await expect(sku(p, s, 'B', 1000, 1000)).rejects.toThrow();
    await expect(sku(p, s, 'C', 1000, 1500)).resolves.toBeDefined();
  });

  it('removes options, SKUs and history together with a deleted product', async () => {
    const s = await seller('a@example.com', 'Store A');
    const p = await product(s, 'p-1');
    await sku(p, s, 'A');
    const [optionId] = await db('product_options').insert({ product_id: p, name: 'Color', position: 0 });
    await db('product_option_values').insert({ option_id: optionId, value: 'Red', position: 0 });
    await db('product_status_history').insert({ product_id: p, from_status: 'draft', to_status: 'pending', actor_id: 'x' });
    await db('products').where({ id: p }).delete();
    for (const t of ['skus', 'product_options', 'product_option_values', 'product_status_history']) {
      expect(await db(t)).toHaveLength(0);
    }
  });
});
