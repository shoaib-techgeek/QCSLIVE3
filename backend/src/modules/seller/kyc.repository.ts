import type { Knex } from 'knex';
import type { KycStatus } from './kyc.js';

type Db = Knex | Knex.Transaction;

export interface ApplicationRow {
  id: number;
  seller_id: number;
  status: KycStatus;
  note: string | null;
  submitted_at: Date | null;
}
export interface DocumentRow {
  id: number;
  public_id: string;
  application_id: number;
  kind: string;
  storage_key: string;
  mime: string;
  size_bytes: number;
}
export interface PiiRow {
  application_id: number;
  cnic_enc: string;
  cnic_last4: string;
  address_enc: string;
  ntn_enc: string | null;
}
export interface SellerRef {
  id: number;
  public_id: string;
  user_id: number;
  store_name: string;
}

export const sellerByUser = (db: Db, userId: number): Promise<SellerRef | undefined> =>
  db<SellerRef>('sellers').where({ user_id: userId }).first('id', 'public_id', 'user_id', 'store_name');

export const sellerByPublicId = (db: Db, publicId: string): Promise<SellerRef | undefined> =>
  db<SellerRef>('sellers').where({ public_id: publicId }).first('id', 'public_id', 'user_id', 'store_name');

export async function ensureApplication(db: Db, sellerId: number): Promise<ApplicationRow> {
  await db.raw('INSERT IGNORE INTO kyc_applications (seller_id) VALUES (?)', [sellerId]);
  return (await db<ApplicationRow>('kyc_applications').where({ seller_id: sellerId }).first())!;
}

export const applicationBySeller = (db: Db, sellerId: number): Promise<ApplicationRow | undefined> =>
  db<ApplicationRow>('kyc_applications').where({ seller_id: sellerId }).first();

export const documents = (db: Db, applicationId: number): Promise<DocumentRow[]> =>
  db<DocumentRow>('kyc_documents').where({ application_id: applicationId }).orderBy('id');

export const documentByPublicId = (db: Db, applicationId: number, publicId: string): Promise<DocumentRow | undefined> =>
  db<DocumentRow>('kyc_documents').where({ application_id: applicationId, public_id: publicId }).first();

export async function insertDocument(db: Db, d: { publicId: string; applicationId: number; kind: string; storageKey: string; mime: string; size: number; sha256: string }): Promise<void> {
  await db('kyc_documents').insert({
    public_id: d.publicId, application_id: d.applicationId, kind: d.kind, storage_key: d.storageKey, mime: d.mime, size_bytes: d.size, sha256: d.sha256,
  });
}

export const deleteDocument = (db: Db, id: number): Promise<number> => db('kyc_documents').where({ id }).delete();

export const pii = (db: Db, applicationId: number): Promise<PiiRow | undefined> =>
  db<PiiRow>('kyc_pii').where({ application_id: applicationId }).first();

export async function upsertPii(db: Db, p: { applicationId: number; cnicEnc: string; cnicLast4: string; addressEnc: string; ntnEnc: string | null }): Promise<void> {
  const row = { application_id: p.applicationId, cnic_enc: p.cnicEnc, cnic_last4: p.cnicLast4, address_enc: p.addressEnc, ntn_enc: p.ntnEnc };
  await db('kyc_pii').insert(row).onConflict('application_id').merge();
}

export async function setStatus(db: Db, a: { applicationId: number; sellerId: number; to: KycStatus; note: string | null; reviewedBy: string | null; submittedAt?: Date; at: Date }): Promise<void> {
  const patch: Record<string, unknown> = { status: a.to, note: a.note, updated_at: a.at };
  if (a.submittedAt) patch.submitted_at = a.submittedAt;
  if (a.reviewedBy) Object.assign(patch, { reviewed_by: a.reviewedBy, reviewed_at: a.at });
  await db('kyc_applications').where({ id: a.applicationId }).update(patch);
  await db('sellers').where({ id: a.sellerId }).update({ kyc_status: a.to, updated_at: a.at });
}

export const addHistory = (db: Db, h: { applicationId: number; from: KycStatus; to: KycStatus; actorId: string; note: string | null }): Promise<unknown> =>
  db('kyc_status_history').insert({ application_id: h.applicationId, from_status: h.from, to_status: h.to, actor_id: h.actorId, note: h.note });

export async function history(db: Db, applicationId: number) {
  return db('kyc_status_history').where({ application_id: applicationId }).orderBy('id').select('from_status', 'to_status', 'actor_id', 'note', 'created_at');
}

export interface QueueRow {
  application_id: number;
  seller_id: string;
  store_name: string;
  status: KycStatus;
  submitted_at: Date | null;
  ntn_missing: number;
}

export async function queue(db: Db, q: { status?: string; cursor?: number; limit: number }): Promise<QueueRow[]> {
  const statuses = q.status ? [q.status] : ['submitted', 'under_review'];
  const rows = await db('kyc_applications as a')
    .join('sellers as s', 's.id', 'a.seller_id')
    .leftJoin('kyc_pii as p', 'p.application_id', 'a.id')
    .whereIn('a.status', statuses)
    .modify((qb) => { if (q.cursor) qb.where('a.id', '>', q.cursor); })
    .orderBy('a.id')
    .limit(q.limit + 1)
    .select('a.id as application_id', 's.public_id as seller_id', 's.store_name', 'a.status', 'a.submitted_at', db.raw('p.ntn_enc IS NULL as ntn_missing'));
  return rows;
}
