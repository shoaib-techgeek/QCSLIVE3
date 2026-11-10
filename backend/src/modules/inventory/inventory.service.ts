import type { Knex } from 'knex';
import { SystemClock, type Clock } from '../../shared/clock.js';
import { AppError } from '../../shared/errors.js';
import { publishEvent } from '../../shared/outbox.js';

export interface StockTarget { skuId: number; skuPublicId: string }
export interface StockLevel { onHand: number; reserved: number; available: number }
export interface ReserveLine { skuPublicId: string; qty: number }

const level = (onHand: number, reserved: number): StockLevel => ({ onHand, reserved, available: onHand - reserved });
const fail = (status: number, code: string, message: string, details: unknown[] = []) => new AppError(status, code, message, details);

/**
 * Stock per SKU. Reservations are one conditional UPDATE per line (`reserved + qty <= on_hand`), so the database,
 * not application code, decides who wins a race for the last unit.
 */
export class InventoryService {
  constructor(
    private readonly db: Knex,
    private readonly clock: Clock = new SystemClock(),
    private readonly resolveSkus: (publicIds: string[]) => Promise<Map<string, number>> = async () => new Map(),
  ) {}

  /** Used by catalogue screens; a SKU that was never counted has no row and shows zero. */
  async stockFor(skuIds: number[]): Promise<Map<number, StockLevel>> {
    if (skuIds.length === 0) return new Map();
    const rows = await this.db('inventory_items').whereIn('sku_id', skuIds).select('sku_id', 'on_hand', 'reserved');
    const found = new Map(rows.map((r) => [Number(r.sku_id), level(Number(r.on_hand), Number(r.reserved))]));
    return new Map(skuIds.map((id) => [id, found.get(id) ?? level(0, 0)]));
  }

  async setOnHand(target: StockTarget, onHand: number, who: { actorId: string; note?: string | undefined }): Promise<StockLevel> {
    return this.db.transaction(async (trx) => {
      await trx.raw('INSERT IGNORE INTO inventory_items (sku_id) VALUES (?)', [target.skuId]);
      const row = await trx('inventory_items').where({ sku_id: target.skuId }).forUpdate().first();
      const current = Number(row.on_hand);
      if (onHand < Number(row.reserved)) throw fail(409, 'BELOW_RESERVED', `${row.reserved} units are reserved for open orders, so stock cannot go below that.`);
      await trx('inventory_items').where({ sku_id: target.skuId }).update({ on_hand: onHand, version: trx.raw('version + 1'), updated_at: trx.fn.now(3) });
      await trx('stock_movements').insert({ sku_id: target.skuId, delta_on_hand: onHand - current, reason: 'adjustment', actor_id: who.actorId, note: who.note?.trim() || null });
      await this.emitStockEvents(trx, [target.skuId], new Map([[target.skuId, target.skuPublicId]]));
      return level(onHand, Number(row.reserved));
    });
  }

  /** All-or-nothing. Repeating a call for the same order returns without reserving again. */
  async reserve(orderRef: string, lines: ReserveLine[], expiresAt?: Date): Promise<void> {
    this.validate(lines);
    const ids = await this.resolveSkus(lines.map((l) => l.skuPublicId));
    const resolved = lines.map((l) => ({ ...l, skuId: ids.get(l.skuPublicId) }));
    const missing = resolved.find((l) => l.skuId === undefined);
    if (missing) throw fail(404, 'SKU_NOT_FOUND', 'One of the products is no longer available.', [{ path: missing.skuPublicId, message: 'Unknown SKU.' }]);
    const ordered = resolved.map((l) => ({ ...l, skuId: l.skuId! })).sort((a, b) => a.skuId - b.skuId); // fixed lock order avoids deadlocks

    // Idempotency uses a plain read plus the (order_ref, sku_id) unique key. A locking read on an empty range would take gap locks
    // and deadlock parallel orders; instead the stock row lock (taken first, in a fixed order) is what serialises competing buyers.
    if (await this.sameReservationExists(orderRef, ordered)) return;
    try {
      await this.inTransaction(async (trx) => {
        for (const l of ordered) {
          const changed = await trx('inventory_items').where({ sku_id: l.skuId }).whereRaw('reserved + ? <= on_hand', [l.qty])
            .update({ reserved: trx.raw('reserved + ?', [l.qty]), version: trx.raw('version + 1'), updated_at: trx.fn.now(3) });
          if (changed === 0) throw fail(409, 'OUT_OF_STOCK', 'Not enough stock for one of the products.', [{ path: l.skuPublicId, message: 'Not enough stock.' }]);
          await trx('reservations').insert({ order_ref: orderRef, sku_id: l.skuId, qty: l.qty, expires_at: expiresAt ?? null });
          await trx('stock_movements').insert({ sku_id: l.skuId, delta_reserved: l.qty, reason: 'reserve', ref: orderRef });
        }
        await publishEvent(trx, this.clock, 'inventory.reserved', { orderRef, lines: ordered.map((l) => ({ skuId: l.skuPublicId, qty: l.qty })) });
        await this.emitStockEvents(trx, ordered.map((l) => l.skuId), new Map(ordered.map((l) => [l.skuId, l.skuPublicId])), true);
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'ER_DUP_ENTRY') throw err;
      // The same order reserved concurrently: fine if it is the same request, a conflict otherwise.
      if (!(await this.sameReservationExists(orderRef, ordered))) throw fail(409, 'RESERVATION_EXISTS', 'This order already has a different reservation.');
    }
  }

  /** Cancelled or unpaid order: units go back on sale. Does nothing for reservations already released or shipped. */
  async release(orderRef: string): Promise<void> {
    await this.settle(orderRef, 'released', 'release');
  }

  /** Shipped: the units leave stock for good. */
  async commit(orderRef: string): Promise<void> {
    await this.settle(orderRef, 'committed', 'commit');
  }

  /** Releases reservations whose time ran out and that were never paid or shipped. Safe to run repeatedly. Returns how many orders were released. */
  async releaseExpired(): Promise<number> {
    const due = await this.db('reservations').where({ status: 'reserved' }).whereNotNull('expires_at').where('expires_at', '<=', this.clock.now()).distinct('order_ref');
    let released = 0;
    for (const { order_ref } of due) {
      if (await this.settle(order_ref, 'released', 'release', true)) released++;
    }
    return released;
  }

  // ---------- internals ----------
  /** Same-order retries are expected; a different reservation under the same order reference is a conflict. */
  private async sameReservationExists(orderRef: string, lines: { skuId: number; qty: number }[]): Promise<boolean> {
    const existing = await this.db('reservations').where({ order_ref: orderRef });
    if (existing.length === 0) return false;
    const same = existing.length === lines.length && lines.every((l) => existing.some((e) => Number(e.sku_id) === l.skuId && Number(e.qty) === l.qty));
    if (!same) throw fail(409, 'RESERVATION_EXISTS', 'This order already has a different reservation.');
    return true;
  }

  /** InnoDB may pick one transaction as a deadlock victim; the work is safe to repeat, so retry a few times. */
  private async inTransaction<T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.db.transaction(work);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if ((code !== 'ER_LOCK_DEADLOCK' && code !== 'ER_LOCK_WAIT_TIMEOUT') || attempt >= 5) throw err;
      }
    }
  }

  private async settle(orderRef: string, to: 'released' | 'committed', reason: 'release' | 'commit', onlyExpired = false): Promise<boolean> {
    return this.inTransaction(async (trx) => {
      const rows = await trx('reservations').where({ order_ref: orderRef, status: 'reserved' }).modify((q) => {
        if (onlyExpired) q.whereNotNull('expires_at').where('expires_at', '<=', this.clock.now());
      }).orderBy('sku_id').forUpdate();
      if (rows.length === 0) return false;
      for (const r of rows) {
        const qty = Number(r.qty);
        const sets = to === 'committed'
          ? { on_hand: trx.raw('on_hand - ?', [qty]), reserved: trx.raw('reserved - ?', [qty]) }
          : { reserved: trx.raw('reserved - ?', [qty]) };
        await trx('inventory_items').where({ sku_id: r.sku_id }).update({ ...sets, version: trx.raw('version + 1'), updated_at: trx.fn.now(3) });
        await trx('reservations').where({ id: r.id }).update({ status: to, updated_at: trx.fn.now(3) });
        await trx('stock_movements').insert({ sku_id: r.sku_id, delta_on_hand: to === 'committed' ? -qty : 0, delta_reserved: -qty, reason, ref: orderRef });
      }
      await publishEvent(trx, this.clock, to === 'committed' ? 'inventory.committed' : 'inventory.released', { orderRef, reason: onlyExpired ? 'expired' : undefined });
      return true;
    });
  }

  private async emitStockEvents(trx: Knex.Transaction, skuIds: number[], publicIds: Map<number, string>, afterReserve = false): Promise<void> {
    const rows = await trx('inventory_items').whereIn('sku_id', skuIds).select('sku_id', 'on_hand', 'reserved');
    for (const r of rows) {
      if (Number(r.on_hand) - Number(r.reserved) === 0 && (afterReserve || Number(r.on_hand) === 0)) {
        await publishEvent(trx, this.clock, 'inventory.out_of_stock', { skuId: publicIds.get(Number(r.sku_id)) });
      }
    }
  }

  private validate(lines: ReserveLine[]): void {
    if (lines.length === 0) throw fail(400, 'VALIDATION_ERROR', 'An order needs at least one item.');
    if (lines.some((l) => !Number.isSafeInteger(l.qty) || l.qty <= 0)) throw fail(400, 'VALIDATION_ERROR', 'Quantities must be whole numbers above zero.');
    if (new Set(lines.map((l) => l.skuPublicId)).size !== lines.length) throw fail(400, 'VALIDATION_ERROR', 'Each product can appear only once per order.');
  }
}
