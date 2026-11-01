import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/knex.js';
import { testEnv } from './helpers.js';
import { publishEvent } from '../../src/shared/outbox.js';
import { EventBus, relayOnce } from '../../src/shared/outbox-relay.js';
import { FixedClock } from '../../src/shared/clock.js';

const db = createDb(testEnv());
const clock = new FixedClock(new Date('2026-11-01T00:00:00Z'));

const emit = (type: string, payload: object = {}) => db.transaction((trx) => publishEvent(trx, clock, type, payload));

describe('outbox relay', () => {
  beforeEach(async () => {
    await db.migrate.latest();
    await db('processed_events').delete();
    await db('outbox_events').delete();
  });
  afterAll(async () => { await db.destroy(); });

  it('delivers each event to its subscribers and marks it published', async () => {
    const bus = new EventBus();
    const seen: unknown[] = [];
    bus.subscribe('inventory', 'order.placed', async (e) => { seen.push(e.payload); });
    await emit('order.placed', { orderId: 7 });
    await emit('other.event');

    expect(await relayOnce(db, clock, bus)).toBe(2);
    expect(seen).toEqual([{ orderId: 7 }]);
    expect(await db('outbox_events').whereNull('published_at')).toHaveLength(0);
  });

  it('leaves an event pending when a handler fails, and retries without re-running handlers that succeeded', async () => {
    const bus = new EventBus();
    let okCalls = 0;
    let failing = true;
    bus.subscribe('notifications', 'order.placed', async () => { okCalls++; });
    bus.subscribe('inventory', 'order.placed', async () => { if (failing) throw new Error('boom'); });
    await emit('order.placed');

    expect(await relayOnce(db, clock, bus)).toBe(0);
    expect(await db('outbox_events').whereNull('published_at')).toHaveLength(1);

    failing = false;
    expect(await relayOnce(db, clock, bus)).toBe(1);
    expect(okCalls).toBe(1); // dedupe: notifications ran once only
    expect(await db('outbox_events').whereNull('published_at')).toHaveLength(0);
  });

  it('marks an event with no subscribers as published', async () => {
    await emit('nobody.listens');
    expect(await relayOnce(db, clock, new EventBus())).toBe(1);
  });
});
