import type { Knex } from 'knex';
import type { Clock } from './clock.js';

export interface OutboxEvent {
  id: number;
  type: string;
  payload: unknown;
}

/** Call inside the business transaction so the event commits or rolls back with it. */
export async function publishEvent(trx: Knex.Transaction, clock: Clock, type: string, payload: object): Promise<void> {
  await trx('outbox_events').insert({ type, payload: JSON.stringify(payload), created_at: clock.now() });
}

/** Oldest unpublished events first. A relay worker (added with the first consumer) publishes them, then marks them. */
export async function claimPendingEvents(db: Knex, limit: number): Promise<OutboxEvent[]> {
  const rows = await db('outbox_events').whereNull('published_at').orderBy('id').limit(limit).select('id', 'type', 'payload');
  // MariaDB returns JSON columns as text; MySQL returns them parsed.
  return rows.map((r) => ({ ...r, payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload }));
}

export async function markEventPublished(db: Knex, clock: Clock, id: number): Promise<void> {
  await db('outbox_events').where({ id }).update({ published_at: clock.now() });
}
