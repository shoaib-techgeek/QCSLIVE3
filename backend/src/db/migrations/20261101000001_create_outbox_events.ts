import type { Knex } from 'knex';

// Transactional outbox: rows are written in the same transaction as the business change, then relayed.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('outbox_events', (t) => {
    t.bigIncrements('id');
    t.string('type', 100).notNullable();
    t.json('payload').notNullable();
    t.dateTime('created_at', { precision: 3 }).notNullable();
    t.dateTime('published_at', { precision: 3 }).nullable();
    t.index(['published_at', 'id'], 'idx_outbox_pending');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('outbox_events');
}
