import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/knex.js';
import { testEnv } from './helpers.js';
import { publishEvent, claimPendingEvents, markEventPublished } from '../../src/shared/outbox.js';
import { FixedClock } from '../../src/shared/clock.js';

const db = createDb(testEnv());
const clock = new FixedClock(new Date('2026-11-01T00:00:00Z'));

describe('outbox', () => {
  beforeEach(async () => {
    await db.migrate.latest();
    await db('outbox_events').delete();
  });
  afterAll(async () => { await db.destroy(); });

  it('persists the event only when the business transaction commits', async () => {
    await db.transaction(async (trx) => publishEvent(trx, clock, 'order.placed', { orderId: 1 }));
    await expect(db.transaction(async (trx) => {
      await publishEvent(trx, clock, 'order.cancelled', { orderId: 2 });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    const rows = await db('outbox_events');
    expect(rows.map((r) => r.type)).toEqual(['order.placed']);
  });

  it('claims pending events in order and skips published ones', async () => {
    await db.transaction(async (trx) => {
      await publishEvent(trx, clock, 'a', {});
      await publishEvent(trx, clock, 'b', {});
    });
    const [first, second] = await claimPendingEvents(db, 10);
    expect([first?.type, second?.type]).toEqual(['a', 'b']);
    await markEventPublished(db, clock, first!.id);
    expect((await claimPendingEvents(db, 10)).map((e) => e.type)).toEqual(['b']);
  });
});
