import type { Knex } from 'knex';
import type { Clock } from './clock.js';
import { claimPendingEvents, markEventPublished, type OutboxEvent } from './outbox.js';

export type EventHandler = (event: OutboxEvent) => Promise<void>;

/** In-process subscriptions. Swap for a broker adapter when a module is extracted (ADR-0002). */
export class EventBus {
  private readonly subs = new Map<string, { consumer: string; handler: EventHandler }[]>();

  subscribe(consumer: string, type: string, handler: EventHandler): void {
    this.subs.set(type, [...(this.subs.get(type) ?? []), { consumer, handler }]);
  }

  handlersFor(type: string) {
    return this.subs.get(type) ?? [];
  }
}

/** Delivers one batch. Returns how many events were fully delivered; a failed event stays pending and is retried next run. */
export async function relayOnce(db: Knex, clock: Clock, bus: EventBus, batchSize = 50): Promise<number> {
  let delivered = 0;
  for (const event of await claimPendingEvents(db, batchSize)) {
    if (await deliver(db, clock, bus, event)) {
      await markEventPublished(db, clock, event.id);
      delivered++;
    }
  }
  return delivered;
}

async function deliver(db: Knex, clock: Clock, bus: EventBus, event: OutboxEvent): Promise<boolean> {
  let ok = true;
  for (const { consumer, handler } of bus.handlersFor(event.type)) {
    const done = await db('processed_events').where({ consumer, event_id: event.id }).first();
    if (done) continue;
    try {
      await handler(event);
      await db('processed_events').insert({ consumer, event_id: event.id, processed_at: clock.now() });
    } catch {
      ok = false; // other consumers still get their turn; the event is retried
    }
  }
  return ok;
}

/** Runs the relay on an interval; returns a stop function. */
export function startRelay(db: Knex, clock: Clock, bus: EventBus, intervalMs: number, onError: (e: unknown) => void): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    relayOnce(db, clock, bus).catch(onError).finally(() => { running = false; });
  }, intervalMs);
  return () => clearInterval(timer);
}
