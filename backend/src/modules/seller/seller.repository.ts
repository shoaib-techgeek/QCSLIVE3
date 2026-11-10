import type { Knex } from 'knex';

type Db = Knex | Knex.Transaction;

export interface SellerRow {
  id: number;
  public_id: string;
  user_id: number;
  store_name: string;
  slug: string;
  description: string | null;
  status: 'pending' | 'active' | 'suspended' | 'closed';
  kyc_status: string;
  created_at: Date;
}

export const findByUserId = (db: Db, userId: number): Promise<SellerRow | undefined> =>
  db<SellerRow>('sellers').where({ user_id: userId }).first();

export const findByNameOrSlug = (db: Db, storeName: string, slug: string): Promise<SellerRow | undefined> =>
  db<SellerRow>('sellers').where({ store_name: storeName }).orWhere({ slug }).first();

export async function insertSeller(db: Db, s: { publicId: string; userId: number; storeName: string; slug: string; description: string | null }): Promise<void> {
  await db('sellers').insert({ public_id: s.publicId, user_id: s.userId, store_name: s.storeName, slug: s.slug, description: s.description });
}

export const updateDescription = (db: Db, userId: number, description: string | null): Promise<number> =>
  db('sellers').where({ user_id: userId }).update({ description, version: db.raw('version + 1'), updated_at: db.fn.now(3) });

export async function namesByIds(db: Db, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db('sellers').whereIn('id', ids).select('id', 'store_name');
  return new Map(rows.map((r) => [Number(r.id), String(r.store_name)]));
}

export const findActiveBySlug = (db: Db, slug: string): Promise<SellerRow | undefined> =>
  db<SellerRow>('sellers').where({ slug, status: 'active' }).first();

export async function nonActiveIds(db: Db): Promise<number[]> {
  return (await db('sellers').whereIn('status', ['suspended', 'closed']).pluck('id')).map(Number);
}
