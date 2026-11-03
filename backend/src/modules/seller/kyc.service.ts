import { createHash, randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { SystemClock, type Clock } from '../../shared/clock.js';
import { recordAudit } from '../../shared/audit.js';
import type { Encryptor } from '../../shared/encryptor.js';
import { AppError } from '../../shared/errors.js';
import type { FileStorage } from '../../shared/file-storage.js';
import { publishEvent } from '../../shared/outbox.js';
import { sniffMime } from './file-sniff.js';
import { canPublish, transitionKyc, type KycStatus } from './kyc.js';
import * as repo from './kyc.repository.js';
import { DECISIONS, MAX_PHOTOS, REQUIRED_KINDS } from './kyc-schemas.js';

export interface KycActor { userId: number; publicId: string; requestId: string }
type Decision = keyof typeof DECISIONS;
type GrantRole = (trx: Knex.Transaction, userId: number, role: string) => Promise<void>;

const EDITABLE: KycStatus[] = ['not_submitted', 'more_info_required'];
const SINGLE_KINDS = ['cnic_front', 'cnic_back', 'business_registration', 'tax_certificate'];
const notFound = () => new AppError(404, 'NOT_FOUND', 'Resource not found.');

const docView = (d: repo.DocumentRow) => ({ id: d.public_id, kind: d.kind, mime: d.mime, sizeBytes: d.size_bytes });

export class KycService {
  constructor(
    private readonly db: Knex,
    private readonly storage: FileStorage,
    private readonly encryptor: Encryptor,
    private readonly grantRole: GrantRole,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  // ---------- seller ----------
  async mine(actor: KycActor) {
    const { application } = await this.own(actor);
    return this.sellerView(application);
  }

  async upload(actor: KycActor, kind: string, data: Buffer) {
    const { seller, application } = await this.own(actor, true);
    const mime = sniffMime(data);
    if (!mime) throw new AppError(400, 'FILE_TYPE_NOT_ALLOWED', 'Upload a JPG, PNG or PDF file.');
    const existing = (await repo.documents(this.db, application.id)).filter((d) => d.kind === kind);
    if (kind === 'business_photo' && existing.length >= MAX_PHOTOS) throw new AppError(400, 'TOO_MANY_FILES', `You can upload at most ${MAX_PHOTOS} photos.`);

    const publicId = randomUUID();
    const storageKey = `kyc/${seller.public_id}/${randomUUID()}`;
    await this.storage.put(storageKey, data);
    await this.db.transaction(async (trx) => {
      await repo.insertDocument(trx, { publicId, applicationId: application.id, kind, storageKey, mime, size: data.length, sha256: createHash('sha256').update(data).digest('hex') });
      if (SINGLE_KINDS.includes(kind)) for (const old of existing) await repo.deleteDocument(trx, old.id);
    });
    for (const old of SINGLE_KINDS.includes(kind) ? existing : []) await this.storage.delete(old.storage_key);
    return { id: publicId, kind, mime, sizeBytes: data.length };
  }

  async removeDocument(actor: KycActor, documentId: string): Promise<void> {
    const { application } = await this.own(actor, true);
    const doc = await repo.documentByPublicId(this.db, application.id, documentId); // scoped to the caller's own application
    if (!doc) throw notFound();
    await repo.deleteDocument(this.db, doc.id);
    await this.storage.delete(doc.storage_key);
  }

  async savePii(actor: KycActor, input: { cnic: string; address: string; ntn?: string }) {
    const { application } = await this.own(actor, true);
    await repo.upsertPii(this.db, {
      applicationId: application.id,
      cnicEnc: this.encryptor.encrypt(input.cnic),
      cnicLast4: input.cnic.slice(-4),
      addressEnc: this.encryptor.encrypt(input.address),
      ntnEnc: input.ntn ? this.encryptor.encrypt(input.ntn) : null,
    });
    await recordAudit(this.db, { actorId: actor.publicId, action: 'kyc.details_saved', targetType: 'seller', requestId: actor.requestId });
    return this.sellerView(application);
  }

  async submit(actor: KycActor) {
    const { seller, application } = await this.own(actor, true);
    const kinds = new Set((await repo.documents(this.db, application.id)).map((d) => d.kind));
    const missing: string[] = REQUIRED_KINDS.filter((k) => !kinds.has(k));
    if (!(await repo.pii(this.db, application.id))) missing.push('pii');
    if (missing.length > 0) {
      throw new AppError(400, 'KYC_INCOMPLETE', 'Some required documents or details are missing.', missing.map((path) => ({ path, message: 'Required.' })));
    }
    await this.move(application, seller.id, 'submitted', 'seller', { id: actor.publicId, requestId: actor.requestId }, undefined, 'kyc.submitted', 'seller.kyc_submitted', seller.public_id);
    return this.sellerView((await repo.applicationBySeller(this.db, seller.id))!);
  }

  // ---------- admin ----------
  async queue(q: { status?: string; cursor?: number; limit: number }) {
    const rows = await repo.queue(this.db, q);
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((r) => ({
        id: r.seller_id, storeName: r.store_name, status: r.status, submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
        flags: r.ntn_missing ? ['ntn_missing'] : [],
      })),
      nextCursor: rows.length > q.limit ? page[page.length - 1]!.application_id : null,
    };
  }

  async detail(reviewer: KycActor, sellerPublicId: string) {
    const { seller, application } = await this.byPublicId(sellerPublicId);
    const [docs, pii, history] = await Promise.all([repo.documents(this.db, application.id), repo.pii(this.db, application.id), repo.history(this.db, application.id)]);
    await recordAudit(this.db, { actorId: reviewer.publicId, action: 'kyc.pii_viewed', targetType: 'seller', targetId: seller.public_id, requestId: reviewer.requestId });
    return {
      id: seller.public_id, storeName: seller.store_name, status: application.status, note: application.note,
      flags: pii && !pii.ntn_enc ? ['ntn_missing'] : [],
      documents: docs.map(docView),
      pii: pii ? { cnic: this.encryptor.decrypt(pii.cnic_enc), address: this.encryptor.decrypt(pii.address_enc), ntn: pii.ntn_enc ? this.encryptor.decrypt(pii.ntn_enc) : null } : null,
      history: history.map((h) => ({ from: h.from_status, to: h.to_status, note: h.note, at: new Date(h.created_at).toISOString() })),
    };
  }

  async download(reviewer: KycActor, sellerPublicId: string, documentId: string) {
    const { seller, application } = await this.byPublicId(sellerPublicId);
    const doc = await repo.documentByPublicId(this.db, application.id, documentId);
    const data = doc ? await this.storage.get(doc.storage_key) : null;
    if (!doc || !data) throw notFound();
    await recordAudit(this.db, { actorId: reviewer.publicId, action: 'kyc.document_viewed', targetType: 'seller', targetId: seller.public_id, requestId: reviewer.requestId, summary: { kind: doc.kind } });
    return { data, mime: doc.mime };
  }

  async decide(reviewer: KycActor, sellerPublicId: string, decision: Decision, note?: string) {
    const { seller, application } = await this.byPublicId(sellerPublicId);
    const to = DECISIONS[decision];
    const eventType = to === 'approved' || to === 'approved_with_conditions' ? 'seller.kyc_approved' : to === 'rejected' ? 'seller.kyc_rejected' : undefined;
    await this.move(application, seller.id, to, 'admin', { id: reviewer.publicId, requestId: reviewer.requestId }, note, `kyc.${decision === 'start_review' ? 'review_started' : to}`, eventType, seller.public_id, seller.user_id);
    return this.detailNoAudit(seller.public_id);
  }

  // ---------- internals ----------
  private async move(
    application: repo.ApplicationRow, sellerId: number, to: KycStatus, actor: 'seller' | 'admin',
    who: { id: string; requestId: string }, note: string | undefined, auditAction: string, eventType: string | undefined,
    sellerPublicId: string, sellerUserId?: number,
  ): Promise<void> {
    const result = transitionKyc(application.status, to, actor, note);
    if (!result.ok) throw new AppError(result.code === 'note_required' ? 400 : 409, result.code === 'note_required' ? 'VALIDATION_ERROR' : 'KYC_INVALID_TRANSITION', result.reason);
    const at = this.clock.now();
    await this.db.transaction(async (trx) => {
      // The status check inside the transaction stops two reviewers from deciding the same application.
      const fresh = await trx('kyc_applications').where({ id: application.id }).forUpdate().first('status');
      if (fresh.status !== application.status) throw new AppError(409, 'KYC_INVALID_TRANSITION', 'This application was just changed. Reload and try again.');
      await repo.setStatus(trx, { applicationId: application.id, sellerId, to, note: note?.trim() || null, reviewedBy: actor === 'admin' ? who.id : null, submittedAt: to === 'submitted' ? at : undefined, at });
      await repo.addHistory(trx, { applicationId: application.id, from: application.status, to, actorId: who.id, note: note?.trim() || null });
      await recordAudit(trx, { actorId: who.id, action: auditAction, targetType: 'seller', targetId: sellerPublicId, requestId: who.requestId, summary: { from: application.status, to } });
      if (eventType) await publishEvent(trx, this.clock, eventType, { sellerId: sellerPublicId });
      if (canPublish(to) && sellerUserId !== undefined) {
        await trx('sellers').where({ id: sellerId }).update({ status: 'active' });
        await this.grantRole(trx, sellerUserId, 'seller');
      }
    });
  }

  private async own(actor: KycActor, mustBeEditable = false) {
    const seller = await repo.sellerByUser(this.db, actor.userId);
    if (!seller) throw new AppError(404, 'SELLER_NOT_FOUND', 'You do not have a store yet.');
    const application = await repo.ensureApplication(this.db, seller.id);
    if (mustBeEditable && !EDITABLE.includes(application.status)) throw new AppError(409, 'KYC_LOCKED', 'Your application cannot be edited right now.');
    return { seller, application };
  }

  private async byPublicId(publicId: string) {
    const seller = await repo.sellerByPublicId(this.db, publicId);
    const application = seller ? await repo.applicationBySeller(this.db, seller.id) : undefined;
    if (!seller || !application) throw notFound();
    return { seller, application };
  }

  private async detailNoAudit(sellerPublicId: string) {
    const { seller, application } = await this.byPublicId(sellerPublicId);
    return { id: seller.public_id, storeName: seller.store_name, status: application.status, note: application.note };
  }

  private async sellerView(application: repo.ApplicationRow) {
    const [docs, pii] = await Promise.all([repo.documents(this.db, application.id), repo.pii(this.db, application.id)]);
    return {
      status: application.status, note: application.note, documents: docs.map(docView),
      pii: pii ? { cnicLast4: pii.cnic_last4, hasAddress: true, hasNtn: Boolean(pii.ntn_enc) } : null,
      requiredDocuments: REQUIRED_KINDS,
    };
  }
}
