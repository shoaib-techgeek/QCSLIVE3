import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('product_images', (t) => {
    t.bigIncrements('id');
    t.specificType('public_id', 'char(36)').notNullable().unique();
    t.bigInteger('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.string('storage_key', 200).notNullable().unique();
    t.string('mime', 100).notNullable();
    t.integer('size_bytes').unsigned().notNullable();
    t.string('alt_text', 200).nullable();
    t.integer('position').notNullable().defaultTo(0);
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['product_id', 'position']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('product_images');
}
