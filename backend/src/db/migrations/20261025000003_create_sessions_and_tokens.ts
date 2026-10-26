import type { Knex } from 'knex';

// Only SHA-256 hashes of session / one-time tokens are stored, so a DB leak does not yield usable tokens.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sessions', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.specificType('token_hash', 'char(64)').notNullable().unique();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('expires_at', { precision: 3 }).notNullable();
    t.dateTime('revoked_at', { precision: 3 }).nullable();
    t.string('ip', 64).nullable();
    t.string('user_agent', 255).nullable();
    t.index(['user_id', 'revoked_at'], 'idx_sessions_user');
  });

  await knex.schema.createTable('one_time_tokens', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enu('purpose', ['email_verification', 'password_reset']).notNullable();
    t.specificType('token_hash', 'char(64)').notNullable().unique();
    t.dateTime('expires_at', { precision: 3 }).notNullable();
    t.dateTime('used_at', { precision: 3 }).nullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['user_id', 'purpose'], 'idx_ott_user_purpose');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('one_time_tokens');
  await knex.schema.dropTableIfExists('sessions');
}
