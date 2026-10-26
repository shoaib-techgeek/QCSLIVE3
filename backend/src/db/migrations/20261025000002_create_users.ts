import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id');
    // Non-sequential identifier exposed in APIs; `id` stays internal.
    t.specificType('public_id', 'char(36)').notNullable().unique();
    t.string('email', 254).notNullable().unique(); // stored trimmed + lowercased
    t.string('password_hash', 255).notNullable();
    t.string('full_name', 120).nullable();
    t.string('phone', 32).nullable();
    t.enu('status', ['pending_verification', 'active', 'suspended', 'deleted']).notNullable().defaultTo('pending_verification');
    t.dateTime('email_verified_at', { precision: 3 }).nullable();
    t.integer('failed_login_count').unsigned().notNullable().defaultTo(0);
    t.dateTime('locked_until', { precision: 3 }).nullable();
    t.dateTime('last_login_at', { precision: 3 }).nullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
