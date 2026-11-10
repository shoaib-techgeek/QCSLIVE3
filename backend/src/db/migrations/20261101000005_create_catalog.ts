import type { Knex } from 'knex';

const PRODUCT_STATUSES = ['draft', 'pending', 'active', 'inactive', 'rejected', 'banned', 'deleted'];
// Starter tree approved in docs/design/P1-seller-and-catalog.md; admins edit it later.
const STARTER = [
  ['women', 'Women'], ['men', 'Men'], ['home-kitchen', 'Home and kitchen'], ['electronics', 'Electronics'], ['phones', 'Phones and accessories'],
  ['beauty-health', 'Beauty and health'], ['kids-toys', 'Kids and toys'], ['bags-shoes', 'Bags and shoes'], ['sports', 'Sports and outdoors'], ['automotive', 'Automotive'],
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('categories', (t) => {
    t.bigIncrements('id');
    t.bigInteger('parent_id').unsigned().nullable().references('id').inTable('categories');
    t.string('name', 80).notNullable();
    t.string('slug', 80).notNullable().unique();
    t.string('path', 255).notNullable().defaultTo('/'); // materialized ancestry, e.g. /3/12/
    t.integer('position').notNullable().defaultTo(0);
    t.boolean('active').notNullable().defaultTo(true);
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });

  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id');
    t.specificType('public_id', 'char(36)').notNullable().unique();
    t.bigInteger('seller_id').unsigned().notNullable().references('id').inTable('sellers');
    t.bigInteger('category_id').unsigned().notNullable().references('id').inTable('categories');
    t.string('title', 200).notNullable();
    t.string('slug', 220).notNullable().unique();
    t.text('description').nullable(); // plain text; no HTML is accepted
    t.enu('status', PRODUCT_STATUSES).notNullable().defaultTo('draft');
    t.string('rejection_reason', 1000).nullable();
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['seller_id', 'status']);
    t.index(['category_id', 'status']);
  });

  await knex.schema.createTable('product_options', (t) => {
    t.bigIncrements('id');
    t.bigInteger('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.string('name', 60).notNullable();
    t.integer('position').notNullable().defaultTo(0);
    t.unique(['product_id', 'name']);
  });
  await knex.schema.createTable('product_option_values', (t) => {
    t.bigIncrements('id');
    t.bigInteger('option_id').unsigned().notNullable().references('id').inTable('product_options').onDelete('CASCADE');
    t.string('value', 60).notNullable();
    t.integer('position').notNullable().defaultTo(0);
    t.unique(['option_id', 'value']);
  });

  await knex.schema.createTable('skus', (t) => {
    t.bigIncrements('id');
    t.specificType('public_id', 'char(36)').notNullable().unique();
    t.bigInteger('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.bigInteger('seller_id').unsigned().notNullable().references('id').inTable('sellers'); // denormalised for the per-seller unique code
    t.string('seller_sku', 64).notNullable();
    t.json('option_value_ids').notNullable();
    t.bigInteger('price_minor').unsigned().notNullable();
    t.bigInteger('compare_at_minor').unsigned().nullable();
    t.specificType('currency', 'char(3)').notNullable();
    t.boolean('active').notNullable().defaultTo(true);
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.unique(['seller_id', 'seller_sku']);
    t.index(['product_id']);
  });
  await knex.raw('ALTER TABLE skus ADD CONSTRAINT chk_sku_price CHECK (price_minor > 0)');
  await knex.raw('ALTER TABLE skus ADD CONSTRAINT chk_sku_compare CHECK (compare_at_minor IS NULL OR compare_at_minor > price_minor)');

  // Append-only: never UPDATE/DELETE rows here (they go away only with the product).
  await knex.schema.createTable('price_history', (t) => {
    t.bigIncrements('id');
    t.bigInteger('sku_id').unsigned().notNullable().references('id').inTable('skus').onDelete('CASCADE');
    t.bigInteger('old_minor').unsigned().nullable();
    t.bigInteger('new_minor').unsigned().notNullable();
    t.specificType('currency', 'char(3)').notNullable();
    t.string('changed_by', 36).notNullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['sku_id', 'id']);
  });
  await knex.schema.createTable('product_status_history', (t) => {
    t.bigIncrements('id');
    t.bigInteger('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.enu('from_status', PRODUCT_STATUSES).notNullable();
    t.enu('to_status', PRODUCT_STATUSES).notNullable();
    t.string('actor_id', 36).notNullable();
    t.string('note', 1000).nullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['product_id', 'id']);
  });

  for (const [i, [slug, name]] of STARTER.entries()) {
    const [id] = await knex('categories').insert({ slug, name, position: i });
    await knex('categories').where({ id }).update({ path: `/${id}/` });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['product_status_history', 'price_history', 'skus', 'product_option_values', 'product_options', 'products', 'categories']) {
    await knex.schema.dropTableIfExists(t);
  }
}
