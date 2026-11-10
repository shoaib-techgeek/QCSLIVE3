import { randomBytes, randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { SystemClock, type Clock } from '../../shared/clock.js';
import { recordAudit } from '../../shared/audit.js';
import { AppError } from '../../shared/errors.js';
import { sniffMime } from '../../shared/file-sniff.js';
import type { FileStorage } from '../../shared/file-storage.js';
import { publishEvent } from '../../shared/outbox.js';
import { productSlug } from '../../shared/slug.js';
import { MODERATION_DECISIONS } from './catalog-schemas.js';
import { decodeCursor, encodeCursor, type Sort } from './public-schemas.js';
import * as repo from './catalog.repository.js';
import { validatePrice } from './pricing.js';
import { transitionProduct, type ProductStatus } from './product-status.js';
import { generateVariants, matchSkusToVariants, type VariantLimits } from './variants.js';

export interface CatalogConfig extends VariantLimits { platformCurrency: string; maxImages: number }
export interface SellerRef { id: number; publicId: string; kycStatus: string }
export interface CatalogActor { userId: number; publicId: string; requestId: string }
export interface SkuInfo {
  skuId: number; publicId: string; sellerId: number; productTitle: string; productSlug: string; imageUrl: string | null; options: Record<string, string>;
  priceMinor: number; compareAtMinor: number | null; currency: string; live: boolean; available: number;
}
export interface CreateInput {
  title: string; description?: string | undefined; categorySlug: string;
  options: { name: string; values: string[] }[];
  skus: { sellerSku: string; options: Record<string, string>; priceMinor: number; compareAtMinor?: number | undefined }[];
}
export interface UpdateInput {
  title?: string | undefined; description?: string | null | undefined; categorySlug?: string | undefined;
  skus?: { id: string; priceMinor?: number | undefined; compareAtMinor?: number | null | undefined; active?: boolean | undefined }[] | undefined;
}

const CONTENT_EDITABLE: ProductStatus[] = ['draft', 'rejected', 'inactive'];
const PRICE_EDITABLE: ProductStatus[] = ['draft', 'rejected', 'inactive', 'active'];
const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
const bad = (message: string, path?: string) => new AppError(400, 'VALIDATION_ERROR', message, path ? [{ path, message }] : []);
const notFound = () => new AppError(404, 'NOT_FOUND', 'Resource not found.');
const isDup = (e: unknown) => (e as { code?: string }).code === 'ER_DUP_ENTRY';

export class CatalogService {
  constructor(
    private readonly db: Knex,
    private readonly storage: FileStorage,
    private readonly resolveSeller: (userId: number) => Promise<SellerRef | null>,
    private readonly config: CatalogConfig,
    private readonly storeNames: (sellerIds: number[]) => Promise<Map<number, string>>,
    private readonly excludedSellerIds: () => Promise<number[]>,
    private readonly stockFor: (skuIds: number[]) => Promise<Map<number, { onHand: number; reserved: number; available: number }>>,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  // ---------- reads ----------
  async list(actor: CatalogActor, q: { status?: string | undefined; cursor?: number | undefined; limit: number }) {
    const seller = await this.seller(actor);
    const rows = await repo.listOwn(this.db, seller.id, q);
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((r) => ({
        id: r.public_id, title: r.title, slug: r.slug, status: r.status,
        priceFromMinor: num(r.price_from), currency: r.currency, imageUrl: r.image_id ? imageUrl(r.image_id) : null,
      })),
      nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null,
    };
  }

  async get(actor: CatalogActor, productId: string) {
    const { product } = await this.owned(actor, productId);
    return this.view(product);
  }

  // ---------- create / edit ----------
  async create(actor: CatalogActor, input: CreateInput) {
    const seller = await this.seller(actor);
    const category = await repo.categoryBySlug(this.db, input.categorySlug);
    if (!category) throw bad('Choose a valid category.', 'categorySlug');
    const matrix = generateVariants(input.options, this.config);
    if (!matrix.ok) throw bad(matrix.message, 'options');
    const match = matchSkusToVariants(matrix.variants, input.skus.map((s) => s.options));
    if (!match.ok) throw bad(match.message, 'skus');
    if (new Set(input.skus.map((s) => s.sellerSku.toLowerCase())).size !== input.skus.length) throw bad('Each variant needs its own SKU code.', 'skus');
    input.skus.forEach((s, i) => {
      const errors = validatePrice({ priceMinor: s.priceMinor, compareAtMinor: s.compareAtMinor, currency: this.config.platformCurrency, platformCurrency: this.config.platformCurrency });
      if (errors[0]) throw bad(errors[0].message, `skus.${i}.${errors[0].path}`);
    });

    const publicId = randomUUID();
    const slug = productSlug(input.title, randomBytes(3).toString('hex'));
    try {
      await this.db.transaction(async (trx) => {
        const [productId] = await trx('products').insert({
          public_id: publicId, seller_id: seller.id, category_id: category.id, title: input.title, slug, description: input.description ?? null,
        });
        const valueIds = new Map<string, number>(); // "option|value" (lowercase) -> id
        for (const [pos, o] of input.options.entries()) {
          const [optionId] = await trx('product_options').insert({ product_id: productId, name: o.name.trim(), position: pos });
          for (const [vpos, v] of o.values.entries()) {
            const [valueId] = await trx('product_option_values').insert({ option_id: optionId, value: v.trim(), position: vpos });
            valueIds.set(`${o.name.trim().toLowerCase()}|${v.trim().toLowerCase()}`, valueId!);
          }
        }
        for (const s of input.skus) {
          const ids = input.options.map((o) => valueIds.get(`${o.name.trim().toLowerCase()}|${lookup(s.options, o.name).toLowerCase()}`));
          const [skuId] = await trx('skus').insert({
            public_id: randomUUID(), product_id: productId, seller_id: seller.id, seller_sku: s.sellerSku, option_value_ids: JSON.stringify(ids),
            price_minor: s.priceMinor, compare_at_minor: s.compareAtMinor ?? null, currency: this.config.platformCurrency,
          });
          await repo.insertPriceHistory(trx, { skuId: skuId!, oldMinor: null, newMinor: s.priceMinor, currency: this.config.platformCurrency, changedBy: actor.publicId });
        }
        await repo.insertStatusHistory(trx, { productId: productId!, from: 'draft', to: 'draft', actorId: actor.publicId });
        await recordAudit(trx, { actorId: actor.publicId, action: 'product.created', targetType: 'product', targetId: publicId, requestId: actor.requestId });
      });
    } catch (err) {
      if (isDup(err)) throw new AppError(409, 'SKU_CODE_TAKEN', 'One of your SKU codes is already used by another product.');
      throw err;
    }
    return this.get(actor, publicId);
  }

  async update(actor: CatalogActor, productId: string, patch: UpdateInput) {
    const { product } = await this.owned(actor, productId);
    const content = patch.title !== undefined || patch.description !== undefined || patch.categorySlug !== undefined;
    if (content && !CONTENT_EDITABLE.includes(product.status)) throw new AppError(409, 'PRODUCT_LOCKED', 'This product cannot be edited right now.');
    if (patch.skus && !PRICE_EDITABLE.includes(product.status)) throw new AppError(409, 'PRODUCT_LOCKED', 'This product cannot be edited right now.');

    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.categorySlug !== undefined) {
      const category = await repo.categoryBySlug(this.db, patch.categorySlug);
      if (!category) throw bad('Choose a valid category.', 'categorySlug');
      update.category_id = category.id;
    }
    const skuChanges = await this.prepareSkuChanges(product, patch.skus);

    await this.db.transaction(async (trx) => {
      if (Object.keys(update).length > 0 || skuChanges.length > 0) {
        await trx('products').where({ id: product.id }).update({ ...update, version: trx.raw('version + 1'), updated_at: trx.fn.now(3) });
      }
      for (const c of skuChanges) {
        await trx('skus').where({ id: c.row.id }).update({ ...c.set, version: trx.raw('version + 1'), updated_at: trx.fn.now(3) });
        if (c.priceChanged) {
          await repo.insertPriceHistory(trx, { skuId: c.row.id, oldMinor: Number(c.row.price_minor), newMinor: c.newPrice, currency: c.row.currency, changedBy: actor.publicId });
          await publishEvent(trx, this.clock, 'price.changed', { productId: product.public_id, skuId: c.row.public_id, oldMinor: Number(c.row.price_minor), newMinor: c.newPrice, currency: c.row.currency });
        }
      }
      await recordAudit(trx, { actorId: actor.publicId, action: 'product.updated', targetType: 'product', targetId: product.public_id, requestId: actor.requestId, summary: { fields: [...Object.keys(update), ...(skuChanges.length ? ['skus'] : [])] } });
    });
    return this.get(actor, productId);
  }

  // ---------- lifecycle ----------
  async submit(actor: CatalogActor, productId: string) {
    const { seller, product } = await this.owned(actor, productId);
    this.requireApproved(seller);
    return this.move(actor, product, 'pending', 'product.submitted', ['product.submitted', 'product.status_changed']);
  }

  async deactivate(actor: CatalogActor, productId: string) {
    const { product } = await this.owned(actor, productId);
    return this.move(actor, product, 'inactive', 'product.deactivated', ['product.status_changed']);
  }

  async activate(actor: CatalogActor, productId: string) {
    const { seller, product } = await this.owned(actor, productId);
    this.requireApproved(seller);
    return this.move(actor, product, 'active', 'product.activated', ['product.status_changed']);
  }

  async remove(actor: CatalogActor, productId: string): Promise<void> {
    const { product } = await this.owned(actor, productId);
    await this.move(actor, product, 'deleted', 'product.deleted', ['product.status_changed'], false);
  }

  // ---------- images ----------
  async addImage(actor: CatalogActor, productId: string, data: Buffer, altText?: string) {
    const { seller, product } = await this.owned(actor, productId);
    this.requireEditable(product);
    const mime = sniffMime(data);
    if (mime !== 'image/png' && mime !== 'image/jpeg' && mime !== 'image/webp') throw new AppError(400, 'FILE_TYPE_NOT_ALLOWED', 'Upload a JPG, PNG or WebP image.');
    const existing = await repo.imagesOf(this.db, product.id);
    if (existing.length >= this.config.maxImages) throw new AppError(400, 'TOO_MANY_FILES', `You can upload at most ${this.config.maxImages} images.`);
    const publicId = randomUUID();
    const storageKey = `products/${seller.publicId}/${randomUUID()}`;
    await this.storage.put(storageKey, data);
    const position = existing.length;
    await this.db('product_images').insert({
      public_id: publicId, product_id: product.id, storage_key: storageKey, mime, size_bytes: data.length, alt_text: altText?.trim().slice(0, 200) || null, position,
    });
    return { id: publicId, url: imageUrl(publicId), altText: altText?.trim().slice(0, 200) || null, position };
  }

  async removeImage(actor: CatalogActor, productId: string, imageId: string): Promise<void> {
    const { product } = await this.owned(actor, productId);
    this.requireEditable(product);
    const image = await this.db('product_images').where({ product_id: product.id, public_id: imageId }).first();
    if (!image) throw notFound();
    await this.db('product_images').where({ id: image.id }).delete();
    await this.storage.delete(image.storage_key);
  }

  /** Public for active products; otherwise only the owning seller may preview. Anything else looks like a missing file. */
  async media(imageId: string, viewerUserId: number | null, isModerator = false) {
    const image = await this.db('product_images as i').join('products as p', 'p.id', 'i.product_id').where('i.public_id', imageId)
      .first('i.storage_key', 'i.mime', 'p.status', 'p.seller_id');
    if (!image || image.status === 'deleted') throw notFound();
    const isPublic = image.status === 'active';
    if (!isPublic && !isModerator) {
      const viewer = viewerUserId === null ? null : await this.resolveSeller(viewerUserId);
      if (!viewer || viewer.id !== image.seller_id) throw notFound();
    }
    const data = await this.storage.get(image.storage_key);
    if (!data) throw notFound();
    return { data: data as Buffer, mime: image.mime as string, isPublic };
  }

  // ---------- public catalogue ----------
  async categories() {
    return { items: (await repo.categories(this.db)).map((c) => ({ slug: c.slug, name: c.name })) };
  }

  async publicList(q: { q?: string | undefined; category?: string | undefined; minPrice?: number | undefined; maxPrice?: number | undefined; sort?: Sort | undefined; cursor?: string | undefined; limit: number }) {
    const search = q.q || undefined;
    const sort: Sort = q.sort === 'relevance' && !search ? 'newest' : q.sort ?? (search ? 'relevance' : 'newest');
    const keyset = sort === 'newest';
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;
    if (q.cursor && (!cursor || (keyset ? cursor.k !== 'id' : cursor.k !== 'off'))) throw bad('That page link is not valid.', 'cursor');
    const offset = cursor?.k === 'off' ? cursor.n : 0;
    const rows = await repo.publicList(this.db, {
      search, category: q.category, minPrice: q.minPrice, maxPrice: q.maxPrice, sort, limit: q.limit, offset,
      keysetId: cursor?.k === 'id' ? cursor.id : undefined, excludeSellerIds: await this.excludedSellerIds(),
    });
    const page = rows.slice(0, q.limit);
    const [names, skuIds] = await Promise.all([this.storeNames(page.map((r) => r.seller_id)), repo.activeSkuIdsByProduct(this.db, page.map((r) => r.id))]);
    const stock = await this.stockFor([...skuIds.values()].flat());
    const more = rows.length > q.limit;
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        id: r.public_id, title: r.title, slug: r.slug, priceMinor: Number(r.price_from), compareAtMinor: num(r.compare_at), currency: r.currency,
        imageUrl: r.image_id ? imageUrl(r.image_id) : null, category: { slug: r.category_slug, name: r.category_name },
        storeName: names.get(r.seller_id) ?? null, inStock: (skuIds.get(r.id) ?? []).some((id) => (stock.get(id)?.available ?? 0) > 0),
      })),
      nextCursor: !more || !last ? null : encodeCursor(keyset ? { k: 'id', id: last.id } : { k: 'off', n: offset + q.limit }),
    };
  }

  async publicProduct(slug: string) {
    const product = await repo.liveBySlug(this.db, slug);
    if (!product || (await this.excludedSellerIds()).includes(product.seller_id)) throw notFound();
    const v = await this.view(product);
    const live = v.skus.filter((s) => s.active);
    if (live.length === 0) throw notFound();
    const names = await this.storeNames([product.seller_id]);
    return {
      id: v.id, title: v.title, slug: v.slug, description: v.description, category: v.category, store: { name: names.get(product.seller_id) ?? null },
      options: v.options,
      skus: live.map((s) => ({ id: s.id, options: s.options, priceMinor: s.priceMinor, compareAtMinor: s.compareAtMinor, currency: s.currency, inStock: s.stock.available > 0 })),
      images: v.images.map((i) => ({ url: i.url, altText: i.altText })),
    };
  }

  // ---------- for other modules (inventory) ----------
  /** A SKU the caller owns, or 404: the single ownership check for anything that acts on a SKU. */
  async ownSku(actor: CatalogActor, skuPublicId: string): Promise<{ skuId: number; skuPublicId: string }> {
    const seller = await this.seller(actor);
    const sku = await this.db('skus as s').join('products as p', 'p.id', 's.product_id')
      .where({ 's.public_id': skuPublicId, 's.seller_id': seller.id }).whereNot('p.status', 'deleted').first('s.id', 's.public_id');
    if (!sku) throw notFound();
    return { skuId: Number(sku.id), skuPublicId: sku.public_id as string };
  }

  async skuIdsByPublicId(publicIds: string[]): Promise<Map<string, number>> {
    if (publicIds.length === 0) return new Map();
    const rows = await this.db('skus').whereIn('public_id', publicIds).select('id', 'public_id');
    return new Map(rows.map((r) => [r.public_id as string, Number(r.id)]));
  }

  /** Current, trusted facts about SKUs for the cart and checkout: never taken from anything a client sent or a cart stored. */
  async skuInfoByIds(ids: number[]): Promise<Map<number, SkuInfo>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db('skus as s').join('products as p', 'p.id', 's.product_id').whereIn('s.id', ids)
      .select('s.id', 's.public_id', 's.product_id', 's.option_value_ids', 's.price_minor', 's.compare_at_minor', 's.currency', 's.active', 's.seller_id', 'p.title', 'p.slug', 'p.status');
    const productIds = [...new Set(rows.map((r) => Number(r.product_id)))];
    const [excluded, stock, images, values] = await Promise.all([
      this.excludedSellerIds(), this.stockFor(ids),
      this.db('product_images').whereIn('product_id', productIds).orderBy('position').orderBy('id').select('product_id', 'public_id'),
      this.db('product_option_values as v').join('product_options as o', 'o.id', 'v.option_id').whereIn('o.product_id', productIds).select('v.id', 'v.value', 'o.name'),
    ]);
    const firstImage = new Map<number, string>();
    for (const i of images) if (!firstImage.has(Number(i.product_id))) firstImage.set(Number(i.product_id), i.public_id as string);
    const valueById = new Map(values.map((v) => [Number(v.id), { option: v.name as string, value: v.value as string }]));
    return new Map(rows.map((r) => {
      const optionIds: number[] = typeof r.option_value_ids === 'string' ? JSON.parse(r.option_value_ids) : r.option_value_ids;
      const image = firstImage.get(Number(r.product_id));
      return [Number(r.id), {
        skuId: Number(r.id), publicId: r.public_id as string, sellerId: Number(r.seller_id), productTitle: r.title as string, productSlug: r.slug as string,
        imageUrl: image ? imageUrl(image) : null, options: Object.fromEntries(optionIds.map((id) => { const v = valueById.get(id); return v ? [v.option, v.value] : []; }).filter((e) => e.length)),
        priceMinor: Number(r.price_minor), compareAtMinor: num(r.compare_at_minor), currency: r.currency as string,
        live: r.status === 'active' && Boolean(r.active) && !excluded.includes(Number(r.seller_id)), available: stock.get(Number(r.id))?.available ?? 0,
      }];
    }));
  }

  // ---------- admin moderation ----------
  async adminQueue(q: { status: string; cursor?: number | undefined; limit: number }) {
    const rows = await repo.adminQueue(this.db, q);
    const page = rows.slice(0, q.limit);
    const names = await this.storeNames(page.map((r) => r.seller_id));
    return {
      items: page.map((r) => ({
        id: r.public_id, title: r.title, status: r.status, storeName: names.get(r.seller_id) ?? null, submittedAt: new Date(r.created_at).toISOString(),
        priceFromMinor: num(r.price_from), currency: r.currency, imageCount: Number(r.image_count),
      })),
      nextCursor: rows.length > q.limit ? page[page.length - 1]!.id : null,
    };
  }

  async adminDetail(productId: string) {
    const product = await repo.productByPublicId(this.db, productId);
    if (!product) throw notFound();
    return this.adminView(product);
  }

  async moderate(actor: CatalogActor, productId: string, decision: keyof typeof MODERATION_DECISIONS, reason?: string) {
    const product = await repo.productByPublicId(this.db, productId);
    if (!product) throw notFound();
    const to = MODERATION_DECISIONS[decision];
    const result = transitionProduct(product.status, to, 'admin', reason);
    if (!result.ok) {
      if (result.code === 'reason_required') throw bad(result.reason, 'reason');
      throw new AppError(409, 'PRODUCT_INVALID_TRANSITION', result.reason);
    }
    const note = reason?.trim() || null;
    const audit = { approve: 'product.approved', reject: 'product.rejected', ban: 'product.banned', deactivate: 'product.deactivated_by_admin' }[decision];
    await this.db.transaction(async (trx) => {
      const fresh = await trx('products').where({ id: product.id }).forUpdate().first('status');
      if (fresh.status !== product.status) throw new AppError(409, 'PRODUCT_INVALID_TRANSITION', 'This product was just changed. Reload and try again.');
      await trx('products').where({ id: product.id }).update({ status: to, rejection_reason: to === 'active' ? null : note, version: trx.raw('version + 1'), updated_at: trx.fn.now(3) });
      await repo.insertStatusHistory(trx, { productId: product.id, from: product.status, to, actorId: actor.publicId, note });
      await recordAudit(trx, { actorId: actor.publicId, action: audit, targetType: 'product', targetId: product.public_id, requestId: actor.requestId, summary: { from: product.status, to } });
      await publishEvent(trx, this.clock, 'product.status_changed', { productId: product.public_id, from: product.status, to, byAdmin: true });
    });
    const updated = await repo.productByPublicId(this.db, productId);
    return this.adminView(updated!);
  }

  // ---------- internals ----------
  private async prepareSkuChanges(product: repo.ProductRow, skus: UpdateInput['skus']) {
    if (!skus) return [];
    if (new Set(skus.map((s) => s.id)).size !== skus.length) throw bad('A SKU is listed twice.', 'skus');
    const rows = await repo.skusOf(this.db, product.id);
    return skus.map((s, i) => {
      const row = rows.find((r) => r.public_id === s.id);
      if (!row) throw notFound();
      const newPrice = s.priceMinor ?? Number(row.price_minor);
      const newCompare = s.compareAtMinor === undefined ? num(row.compare_at_minor) : s.compareAtMinor;
      const errors = validatePrice({ priceMinor: newPrice, compareAtMinor: newCompare ?? undefined, currency: row.currency, platformCurrency: this.config.platformCurrency });
      if (errors[0]) throw bad(errors[0].message, `skus.${i}.${errors[0].path}`);
      const set: Record<string, unknown> = { price_minor: newPrice, compare_at_minor: newCompare };
      if (s.active !== undefined) set.active = s.active;
      return { row, set, newPrice, priceChanged: newPrice !== Number(row.price_minor) };
    });
  }

  private async move(actor: CatalogActor, product: repo.ProductRow, to: ProductStatus, auditAction: string, events: string[], returnView = true) {
    const result = transitionProduct(product.status, to, 'seller');
    if (!result.ok) throw new AppError(409, 'PRODUCT_INVALID_TRANSITION', result.reason);
    await this.db.transaction(async (trx) => {
      // Re-check inside the transaction so two requests cannot both move the same product.
      const fresh = await trx('products').where({ id: product.id }).forUpdate().first('status');
      if (fresh.status !== product.status) throw new AppError(409, 'PRODUCT_INVALID_TRANSITION', 'This product was just changed. Reload and try again.');
      await trx('products').where({ id: product.id }).update({ status: to, ...(to === 'pending' ? { rejection_reason: null } : {}), version: trx.raw('version + 1'), updated_at: trx.fn.now(3) });
      await repo.insertStatusHistory(trx, { productId: product.id, from: product.status, to, actorId: actor.publicId });
      await recordAudit(trx, { actorId: actor.publicId, action: auditAction, targetType: 'product', targetId: product.public_id, requestId: actor.requestId, summary: { from: product.status, to } });
      for (const type of events) await publishEvent(trx, this.clock, type, { productId: product.public_id, from: product.status, to });
    });
    return returnView ? this.view({ ...product, status: to, ...(to === 'pending' ? { rejection_reason: null } : {}) }) : undefined;
  }

  private requireApproved(seller: SellerRef): void {
    if (seller.kycStatus !== 'approved' && seller.kycStatus !== 'approved_with_conditions') {
      throw new AppError(403, 'SELLER_NOT_APPROVED', 'Your seller verification must be approved before you can publish products.');
    }
  }

  private requireEditable(product: repo.ProductRow): void {
    if (!CONTENT_EDITABLE.includes(product.status)) throw new AppError(409, 'PRODUCT_LOCKED', 'This product cannot be edited right now.');
  }

  private async seller(actor: CatalogActor): Promise<SellerRef> {
    const seller = await this.resolveSeller(actor.userId);
    if (!seller) throw new AppError(404, 'SELLER_NOT_FOUND', 'You do not have a store yet.');
    return seller;
  }

  private async owned(actor: CatalogActor, productId: string) {
    const seller = await this.seller(actor);
    const product = await repo.ownProduct(this.db, seller.id, productId);
    if (!product) throw notFound();
    return { seller, product };
  }

  private async adminView(product: repo.ProductRow) {
    const [base, history, names] = await Promise.all([this.view(product), repo.statusHistory(this.db, product.id), this.storeNames([product.seller_id])]);
    return {
      ...base,
      store: { name: names.get(product.seller_id) ?? null },
      history: history.map((h) => ({ from: h.from_status as string, to: h.to_status as string, note: h.note as string | null, at: new Date(h.created_at).toISOString() })),
    };
  }

  private async view(product: repo.ProductRow) {
    const [category, skus, images, { options, values }] = await Promise.all([
      repo.categoryById(this.db, product.category_id), repo.skusOf(this.db, product.id), repo.imagesOf(this.db, product.id), repo.optionsOf(this.db, product.id),
    ]);
    const stock = await this.stockFor(skus.map((s) => s.id));
    const byValueId = new Map(values.map((v) => [v.id as number, { option: options.find((o) => o.id === v.option_id)!.name as string, value: v.value as string }]));
    return {
      id: product.public_id, title: product.title, slug: product.slug, description: product.description, status: product.status,
      rejectionReason: product.rejection_reason, category: category ? { slug: category.slug, name: category.name } : null,
      options: options.map((o) => ({ name: o.name as string, values: values.filter((v) => v.option_id === o.id).map((v) => v.value as string) })),
      skus: skus.map((s) => {
        const ids: number[] = typeof s.option_value_ids === 'string' ? JSON.parse(s.option_value_ids) : s.option_value_ids;
        return {
          id: s.public_id, sellerSku: s.seller_sku, priceMinor: Number(s.price_minor), compareAtMinor: num(s.compare_at_minor), currency: s.currency, active: Boolean(s.active), stock: stock.get(s.id)!,
          options: Object.fromEntries(ids.map((id) => { const v = byValueId.get(id)!; return [v.option, v.value]; })),
        };
      }),
      images: images.map((i) => ({ id: i.public_id, url: imageUrl(i.public_id), altText: i.alt_text, position: i.position })),
    };
  }
}

const imageUrl = (id: string) => `/api/v1/media/products/${id}`;
const lookup = (options: Record<string, string>, name: string): string => {
  const key = Object.keys(options).find((k) => k.trim().toLowerCase() === name.trim().toLowerCase());
  return (key ? options[key] : '')!.trim();
};
