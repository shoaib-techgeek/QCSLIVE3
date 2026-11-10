import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { AppError } from '../../shared/errors.js';

export interface CartSku {
  skuId: number; publicId: string; sellerId: number; productTitle: string; productSlug: string; imageUrl: string | null; options: Record<string, string>;
  priceMinor: number; compareAtMinor: number | null; currency: string; live: boolean; available: number;
}
export type Change =
  | { code: 'PRICE_CHANGED'; oldMinor: number; newMinor: number }
  | { code: 'UNAVAILABLE' }
  | { code: 'OUT_OF_STOCK' }
  | { code: 'QTY_EXCEEDS_STOCK'; available: number };

interface ItemRow { id: number; public_id: string; sku_id: number; qty: number; selected: number | boolean; added_price_minor: number | string }

const notFound = () => new AppError(404, 'NOT_FOUND', 'Resource not found.');
const conflict = (code: string, message: string, details: unknown[] = []) => new AppError(409, code, message, details);

/**
 * A buyer's cart. The cart stores only what the buyer chose (item, quantity, selected); every read recomputes
 * price, availability and status from the catalogue, so nothing here can become a source of truth for money.
 */
export class CartService {
  constructor(
    private readonly db: Knex,
    private readonly skuInfo: (skuIds: number[]) => Promise<Map<number, CartSku>>,
    private readonly skuIdsByPublicId: (publicIds: string[]) => Promise<Map<string, number>>,
    private readonly storeNames: (sellerIds: number[]) => Promise<Map<number, string>>,
    private readonly config: { maxQty: number; currency: string },
  ) {}

  async get(userId: number) {
    const cart = await this.db('carts').where({ user_id: userId }).first('id');
    const items: ItemRow[] = cart ? await this.db('cart_items').where({ cart_id: cart.id }).orderBy('id') : [];
    const infos = await this.skuInfo(items.map((i) => Number(i.sku_id)));
    const names = await this.storeNames([...new Set([...infos.values()].map((i) => i.sellerId))]);

    const lines = items.map((item) => {
      const info = infos.get(Number(item.sku_id));
      const qty = Number(item.qty);
      const changes: Change[] = [];
      if (!info || !info.live) changes.push({ code: 'UNAVAILABLE' });
      else {
        if (info.available <= 0) changes.push({ code: 'OUT_OF_STOCK' });
        else if (qty > info.available) changes.push({ code: 'QTY_EXCEEDS_STOCK', available: info.available });
        if (info.priceMinor !== Number(item.added_price_minor)) changes.push({ code: 'PRICE_CHANGED', oldMinor: Number(item.added_price_minor), newMinor: info.priceMinor });
      }
      const priceMinor = info?.priceMinor ?? Number(item.added_price_minor);
      return {
        sellerId: info?.sellerId ?? 0,
        purchasable: Boolean(info?.live) && (info?.available ?? 0) >= qty,
        view: {
          id: item.public_id, selected: Boolean(item.selected), qty, priceMinor, compareAtMinor: info?.compareAtMinor ?? null, currency: info?.currency ?? this.config.currency,
          lineTotalMinor: priceMinor * qty, available: info?.live ? info.available : null,
          product: { title: info?.productTitle ?? 'This item is no longer available', slug: info?.productSlug ?? null, imageUrl: info?.imageUrl ?? null },
          sku: { id: info?.publicId ?? null, options: info?.options ?? {} }, changes,
        },
      };
    });

    const groupsBySeller = new Map<number, typeof lines>();
    for (const l of lines) groupsBySeller.set(l.sellerId, [...(groupsBySeller.get(l.sellerId) ?? []), l]);
    const groups = [...groupsBySeller].map(([sellerId, ls]) => ({
      storeName: names.get(sellerId) ?? 'Store',
      items: ls.map((l) => l.view),
      subtotalMinor: ls.filter((l) => l.view.selected && l.purchasable).reduce((t, l) => t + l.view.lineTotalMinor, 0),
    }));
    const counted = lines.filter((l) => l.view.selected && l.purchasable);
    return {
      groups,
      summary: { itemCount: counted.reduce((n, l) => n + l.view.qty, 0), subtotalMinor: counted.reduce((t, l) => t + l.view.lineTotalMinor, 0), currency: this.config.currency },
      changes: lines.flatMap((l) => l.view.changes.map((c) => ({ itemId: l.view.id, ...c }))),
    };
  }

  async add(userId: number, skuPublicId: string, qty: number) {
    const id = (await this.skuIdsByPublicId([skuPublicId])).get(skuPublicId);
    const info = id === undefined ? undefined : (await this.skuInfo([id])).get(id);
    if (!info || !info.live) throw notFound();

    await this.db.raw('INSERT IGNORE INTO carts (user_id) VALUES (?)', [userId]);
    const cart = await this.db('carts').where({ user_id: userId }).first('id');
    const existing: ItemRow | undefined = await this.db('cart_items').where({ cart_id: cart.id, sku_id: info.skuId }).first();
    const total = (existing ? Number(existing.qty) : 0) + qty;
    this.checkQty(total, info);
    // shortcut: two simultaneous adds of the same item by one buyer could overshoot the limit by one add; the checkout re-checks everything.
    if (existing) await this.db('cart_items').where({ id: existing.id }).update({ qty: total, updated_at: this.db.fn.now(3) });
    else await this.db('cart_items').insert({ public_id: randomUUID(), cart_id: cart.id, sku_id: info.skuId, qty, selected: true, added_price_minor: info.priceMinor });
    return this.get(userId);
  }

  async update(userId: number, itemId: string, patch: { qty?: number | undefined; selected?: boolean | undefined; acceptPrice?: true | undefined }) {
    const item = await this.ownItem(userId, itemId);
    const set: Record<string, unknown> = {};
    if (patch.qty !== undefined || patch.acceptPrice) {
      const info = (await this.skuInfo([Number(item.sku_id)])).get(Number(item.sku_id));
      if (patch.qty !== undefined) {
        if (!info || !info.live) throw conflict('UNAVAILABLE', 'This item is no longer available.');
        this.checkQty(patch.qty, info);
        set.qty = patch.qty;
      }
      if (patch.acceptPrice && info) set.added_price_minor = info.priceMinor;
    }
    if (patch.selected !== undefined) set.selected = patch.selected;
    await this.db('cart_items').where({ id: item.id }).update({ ...set, updated_at: this.db.fn.now(3) });
    return this.get(userId);
  }

  async remove(userId: number, itemId: string): Promise<void> {
    const item = await this.ownItem(userId, itemId);
    await this.db('cart_items').where({ id: item.id }).delete();
  }

  private checkQty(qty: number, info: CartSku): void {
    if (qty > this.config.maxQty) throw conflict('QTY_LIMIT', `You can buy at most ${this.config.maxQty} of this item at a time.`);
    if (qty > info.available) throw conflict('OUT_OF_STOCK', info.available > 0 ? `Only ${info.available} left.` : 'This item is sold out.', [{ path: 'qty', message: `Available: ${info.available}` }]);
  }

  /** The item must belong to the caller's own cart; anything else looks like a missing item. */
  private async ownItem(userId: number, itemId: string): Promise<ItemRow> {
    const item = await this.db('cart_items as i').join('carts as c', 'c.id', 'i.cart_id').where({ 'c.user_id': userId, 'i.public_id': itemId }).first('i.*');
    if (!item) throw notFound();
    return item as ItemRow;
  }
}
