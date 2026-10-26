import type { Knex } from 'knex';

// Append-only record of privileged/important actions (see docs 03: Audit).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_events', (t) => {
    t.bigIncrements('id');
    t.dateTime('occurred_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.string('actor_id', 64).nullable();
    t.string('action', 100).notNullable();
    t.string('target_type', 64).nullable();
    t.string('target_id', 64).nullable();
    t.string('request_id', 64).nullable();
    t.json('summary').nullable();
    t.index(['target_type', 'target_id', 'occurred_at'], 'idx_audit_target');
    t.index(['actor_id', 'occurred_at'], 'idx_audit_actor');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_events');
}
