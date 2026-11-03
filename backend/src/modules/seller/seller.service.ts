import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { SystemClock, type Clock } from '../../shared/clock.js';
import { recordAudit } from '../../shared/audit.js';
import { AppError } from '../../shared/errors.js';
import { publishEvent } from '../../shared/outbox.js';
import * as repo from './seller.repository.js';
import { validateStoreName } from './store-name.js';

export interface SellerView {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  status: string;
  kycStatus: string;
  createdAt: string;
}

export interface SellerActor {
  userId: number;
  publicId: string;
  requestId: string;
}

const view = (s: repo.SellerRow): SellerView => ({
  id: s.public_id, storeName: s.store_name, slug: s.slug, description: s.description,
  status: s.status, kycStatus: s.kyc_status, createdAt: s.created_at.toISOString(),
});

const isDuplicateKey = (err: unknown) => (err as { code?: string }).code === 'ER_DUP_ENTRY';

export class SellerService {
  constructor(private readonly db: Knex, private readonly clock: Clock = new SystemClock()) {}

  async register(actor: SellerActor, input: { storeName: string; description?: string }): Promise<SellerView> {
    const name = validateStoreName(input.storeName);
    if (!name.ok) throw new AppError(400, 'VALIDATION_ERROR', name.message);
    const storeName = input.storeName.trim();
    if (await repo.findByUserId(this.db, actor.userId)) throw new AppError(409, 'SELLER_EXISTS', 'You already have a store.');
    if (await repo.findByNameOrSlug(this.db, storeName, name.slug)) throw new AppError(409, 'STORE_NAME_TAKEN', 'This store name is already taken.');

    const publicId = randomUUID();
    try {
      await this.db.transaction(async (trx) => {
        await repo.insertSeller(trx, { publicId, userId: actor.userId, storeName, slug: name.slug, description: input.description || null });
        await recordAudit(trx, { actorId: actor.publicId, action: 'seller.registered', targetType: 'seller', targetId: publicId, requestId: actor.requestId });
        await publishEvent(trx, this.clock, 'seller.registered', { sellerId: publicId });
      });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      throw new AppError(409, 'STORE_NAME_TAKEN', 'This store name is already taken.'); // lost a race on a unique key
    }
    return this.mine(actor.userId);
  }

  async mine(userId: number): Promise<SellerView> {
    const seller = await repo.findByUserId(this.db, userId);
    if (!seller) throw new AppError(404, 'SELLER_NOT_FOUND', 'You do not have a store yet.');
    return view(seller);
  }

  async updateDescription(actor: SellerActor, description: string | null): Promise<SellerView> {
    if ((await repo.updateDescription(this.db, actor.userId, description)) === 0) {
      throw new AppError(404, 'SELLER_NOT_FOUND', 'You do not have a store yet.');
    }
    await recordAudit(this.db, { actorId: actor.publicId, action: 'seller.profile_updated', targetType: 'seller', requestId: actor.requestId, summary: { fields: ['description'] } });
    return this.mine(actor.userId);
  }
}
