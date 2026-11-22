import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_identities', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('provider', 20).notNullable();
    t.string('provider_subject', 255).notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['provider', 'provider_subject']);
  });
  await knex.raw('ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL');
}

export async function down(knex: Knex): Promise<void> {
  const { n } = await knex('users').whereNull('password_hash').count({ n: '*' }).first() as { n: number | string };
  if (Number(n) > 0) {
    throw new Error(`Cannot roll back: ${n} user(s) have a NULL password_hash (social sign-in accounts). Resolve them first.`);
  }
  await knex.raw('ALTER TABLE users MODIFY password_hash VARCHAR(255) NOT NULL');
  await knex.schema.dropTableIfExists('user_identities');
}
