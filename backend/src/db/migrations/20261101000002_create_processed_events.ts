import type { Knex } from 'knex';

// Consumer dedupe: a handler that already handled an event is not run again on retry.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('processed_events', (t) => {
    t.string('consumer', 64).notNullable();
    t.bigInteger('event_id').unsigned().notNullable();
    t.dateTime('processed_at', { precision: 3 }).notNullable();
    t.primary(['consumer', 'event_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('processed_events');
}
