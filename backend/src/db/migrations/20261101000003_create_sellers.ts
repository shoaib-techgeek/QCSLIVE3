import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sellers', (t) => {
    t.bigIncrements('id');
    t.specificType('public_id', 'char(36)').notNullable().unique();
    t.bigInteger('user_id').unsigned().notNullable().unique().references('id').inTable('users'); // one store per user
    t.string('store_name', 60).notNullable().unique();
    t.string('slug', 60).notNullable().unique();
    t.string('description', 1000).nullable();
    t.enu('status', ['pending', 'active', 'suspended', 'closed']).notNullable().defaultTo('pending');
    t.enu('kyc_status', ['not_submitted', 'submitted', 'under_review', 'approved', 'approved_with_conditions', 'rejected', 'more_info_required'])
      .notNullable().defaultTo('not_submitted');
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sellers');
}
