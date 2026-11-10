import type { Knex } from 'knex';
import type { ProductStatus } from './product-status.js';

type Db = Knex | Knex.Transaction;

export interface ProductRow {
  id: number;
  public_id: string;
  seller_id: number;
  category_id: number;
  title: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  rejection_reason: string | null;
  version: number;
}
export interface SkuRow {
  id: number;
  public_id: string;
  product_id: number;
  seller_sku: string;
  option_value_ids: number[] | string;
  price_minor: number | string;
  compare_at_minor: number | string | null;
  currency: string;
  active: number | boolean;
}
export interface ImageRow { id: number; public_id: string; product_id: number; storage_key: string; mime: string; alt_text: string | null; position: number }
export interface CategoryRow { id: number; slug: string; name: string }

export const categoryBySlug = (db: Db, slug: string): Promise<CategoryRow | undefined> =>
  db<CategoryRow>('categories').where('slug', slug).where('active', true).first('id', 'slug', 'name');
export const categoryById = (db: Db, id: number): Promise<CategoryRow | undefined> =>
  db<CategoryRow>('categories').where({ id }).first('id', 'slug', 'name');

/** Scoped to the owner: a product that exists but belongs to someone else is indistinguishable from a missing one. */
export const ownProduct = (db: Db, sellerId: number, publicId: string): Promise<ProductRow | undefined> =>
  db<ProductRow>('products').where({ seller_id: sellerId, public_id: publicId }).whereNot({ status: 'deleted' }).first();

export const skusOf = (db: Db, productId: number): Promise<SkuRow[]> => db<SkuRow>('skus').where({ product_id: productId }).orderBy('id');
export const imagesOf = (db: Db, productId: number): Promise<ImageRow[]> => db<ImageRow>('product_images').where({ product_id: productId }).orderBy('position').orderBy('id');

export async function optionsOf(db: Db, productId: number) {
  const options = await db('product_options').where({ product_id: productId }).orderBy('position');
  const values = options.length ? await db('product_option_values').whereIn('option_id', options.map((o) => o.id)).orderBy('position') : [];
  return { options, values };
}

export async function insertStatusHistory(db: Db, h: { productId: number; from: ProductStatus; to: ProductStatus; actorId: string; note?: string | null }): Promise<void> {
  await db('product_status_history').insert({ product_id: h.productId, from_status: h.from, to_status: h.to, actor_id: h.actorId, note: h.note ?? null });
}

export async function insertPriceHistory(db: Db, h: { skuId: number; oldMinor: number | null; newMinor: number; currency: string; changedBy: string }): Promise<void> {
  await db('price_history').insert({ sku_id: h.skuId, old_minor: h.oldMinor, new_minor: h.newMinor, currency: h.currency, changed_by: h.changedBy });
}

export async function listOwn(db: Db, sellerId: number, q: { status?: string; cursor?: number; limit: number }) {
  const rows = await db('products as p')
    .where('p.seller_id', sellerId)
    .whereNot('p.status', 'deleted')
    .modify((qb) => {
      if (q.status) qb.where('p.status', q.status);
      if (q.cursor) qb.where('p.id', '<', q.cursor);
    })
    .orderBy('p.id', 'desc')
    .limit(q.limit + 1)
    .select(
      'p.id', 'p.public_id', 'p.title', 'p.slug', 'p.status',
      db.raw('(SELECT MIN(price_minor) FROM skus WHERE product_id = p.id) AS price_from'),
      db.raw('(SELECT currency FROM skus WHERE product_id = p.id LIMIT 1) AS currency'),
      db.raw('(SELECT public_id FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS image_id'),
    );
  return rows as { id: number; public_id: string; title: string; slug: string; status: ProductStatus; price_from: number | string | null; currency: string | null; image_id: string | null }[];
}

export const productByPublicId = (db: Db, publicId: string): Promise<ProductRow | undefined> =>
  db<ProductRow>('products').where({ public_id: publicId }).whereNot({ status: 'deleted' }).first();

export async function statusHistory(db: Db, productId: number) {
  return db('product_status_history').where({ product_id: productId }).orderBy('id').select('from_status', 'to_status', 'actor_id', 'note', 'created_at');
}

/** Review queue: oldest first so nothing waits forever. */
export async function adminQueue(db: Db, q: { status: string; cursor?: number | undefined; limit: number }) {
  const rows = await db('products as p')
    .where('p.status', q.status)
    .modify((qb) => { if (q.cursor) qb.where('p.id', '>', q.cursor); })
    .orderBy('p.id')
    .limit(q.limit + 1)
    .select(
      'p.id', 'p.public_id', 'p.seller_id', 'p.title', 'p.status', 'p.created_at',
      db.raw('(SELECT MIN(price_minor) FROM skus WHERE product_id = p.id) AS price_from'),
      db.raw('(SELECT currency FROM skus WHERE product_id = p.id LIMIT 1) AS currency'),
      db.raw('(SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count'),
    );
  return rows as { id: number; public_id: string; seller_id: number; title: string; status: ProductStatus; created_at: Date; price_from: number | string | null; currency: string | null; image_count: number | string }[];
}

export interface PublicQuery {
  search?: string | undefined;
  category?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
  keysetId?: number | undefined;
  offset: number;
  limit: number;
  excludeSellerIds: number[];
}
export interface PublicRow {
  id: number; public_id: string; seller_id: number; title: string; slug: string; category_slug: string; category_name: string;
  price_from: number | string; compare_at: number | string | null; currency: string; image_id: string | null;
}

const PRICE_FROM = '(SELECT MIN(s.price_minor) FROM skus s WHERE s.product_id = p.id AND s.active = 1)';
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function categories(db: Db): Promise<CategoryRow[]> {
  return db<CategoryRow>('categories').where('active', true).orderBy('position').orderBy('id').select('id', 'slug', 'name');
}

/** Live products only: active status, an active SKU, an active category and a seller that is not suspended. */
export async function publicList(db: Db, q: PublicQuery): Promise<PublicRow[]> {
  const search = q.search?.trim();
  const qb = db('products as p')
    .join('categories as c', 'c.id', 'p.category_id')
    .where('p.status', 'active')
    .where('c.active', true)
    .whereExists(db.select(db.raw('1')).from('skus as s').whereRaw('s.product_id = p.id').where('s.active', 1))
    .whereNotIn('p.seller_id', q.excludeSellerIds)
    .select(
      'p.id', 'p.public_id', 'p.seller_id', 'p.title', 'p.slug', 'c.slug as category_slug', 'c.name as category_name',
      db.raw(`${PRICE_FROM} AS price_from`),
      db.raw('(SELECT s.compare_at_minor FROM skus s WHERE s.product_id = p.id AND s.active = 1 ORDER BY s.price_minor, s.id LIMIT 1) AS compare_at'),
      db.raw('(SELECT s.currency FROM skus s WHERE s.product_id = p.id AND s.active = 1 ORDER BY s.price_minor, s.id LIMIT 1) AS currency'),
      db.raw('(SELECT i.public_id FROM product_images i WHERE i.product_id = p.id ORDER BY i.position, i.id LIMIT 1) AS image_id'),
    );
  if (q.category) qb.where('c.slug', q.category);
  if (q.minPrice !== undefined) qb.whereRaw(`${PRICE_FROM} >= ?`, [q.minPrice]);
  if (q.maxPrice !== undefined) qb.whereRaw(`${PRICE_FROM} <= ?`, [q.maxPrice]);
  if (search) {
    // shortcut: natural-language fulltext OR a substring match (fulltext ignores very short words), fine for a small catalogue;
    // move to a real search engine behind a SearchIndex interface when relevance or volume demand it.
    qb.whereRaw("(MATCH(p.title, p.description) AGAINST (? IN NATURAL LANGUAGE MODE) OR p.title LIKE ?)", [search, `%${escapeLike(search)}%`]);
  }
  if (q.sort === 'relevance' && search) qb.orderByRaw('MATCH(p.title, p.description) AGAINST (? IN NATURAL LANGUAGE MODE) DESC, p.id DESC', [search]);
  else if (q.sort === 'price_asc') qb.orderByRaw(`${PRICE_FROM} ASC, p.id ASC`);
  else if (q.sort === 'price_desc') qb.orderByRaw(`${PRICE_FROM} DESC, p.id DESC`);
  else {
    if (q.keysetId) qb.where('p.id', '<', q.keysetId);
    qb.orderBy('p.id', 'desc');
  }
  if (q.offset > 0) qb.offset(q.offset);
  return (await qb.limit(q.limit + 1)) as PublicRow[];
}

export async function activeSkuIdsByProduct(db: Db, productIds: number[]): Promise<Map<number, number[]>> {
  if (productIds.length === 0) return new Map();
  const rows = await db('skus').whereIn('product_id', productIds).where('active', 1).select('id', 'product_id');
  const out = new Map<number, number[]>();
  for (const r of rows) out.set(Number(r.product_id), [...(out.get(Number(r.product_id)) ?? []), Number(r.id)]);
  return out;
}

export const liveBySlug = (db: Db, slug: string): Promise<ProductRow | undefined> =>
  db<ProductRow>('products').where({ slug, status: 'active' }).first();
