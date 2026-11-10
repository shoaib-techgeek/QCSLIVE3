import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('carts', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });
  await knex.schema.createTable('cart_items', (t) => {
    t.bigIncrements('id');
    t.specificType('public_id', 'char(36)').notNullable().unique();
    t.bigInteger('cart_id').unsigned().notNullable().references('id').inTable('carts').onDelete('CASCADE');
    t.bigInteger('sku_id').unsigned().notNullable().references('id').inTable('skus').onDelete('CASCADE');
    t.integer('qty').unsigned().notNullable();
    t.boolean('selected').notNullable().defaultTo(true);
    t.bigInteger('added_price_minor').unsigned().notNullable(); // only for change detection; prices are never taken from here
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.unique(['cart_id', 'sku_id']);
  });
  await knex.raw('ALTER TABLE cart_items ADD CONSTRAINT chk_cart_qty CHECK (qty > 0)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cart_items');
  await knex.schema.dropTableIfExists('carts');
}
