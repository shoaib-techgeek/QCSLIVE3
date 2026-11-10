import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('inventory_items', (t) => {
    t.bigInteger('sku_id').unsigned().primary().references('id').inTable('skus').onDelete('CASCADE');
    t.integer('on_hand').unsigned().notNullable().defaultTo(0);
    t.integer('reserved').unsigned().notNullable().defaultTo(0);
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });
  // Backstop for the conditional UPDATEs: even a bug elsewhere cannot make reserved exceed what is on the shelf.
  await knex.raw('ALTER TABLE inventory_items ADD CONSTRAINT chk_inventory_reserved CHECK (reserved <= on_hand)');

  await knex.schema.createTable('reservations', (t) => {
    t.bigIncrements('id');
    t.string('order_ref', 64).notNullable();
    t.bigInteger('sku_id').unsigned().notNullable().references('id').inTable('skus').onDelete('CASCADE');
    t.integer('qty').unsigned().notNullable();
    t.enu('status', ['reserved', 'released', 'committed']).notNullable().defaultTo('reserved');
    t.dateTime('expires_at', { precision: 3 }).nullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.unique(['order_ref', 'sku_id']);
    t.index(['status', 'expires_at']);
  });

  // Append-only ledger: the sum of each delta column always equals the stock figure.
  await knex.schema.createTable('stock_movements', (t) => {
    t.bigIncrements('id');
    t.bigInteger('sku_id').unsigned().notNullable().references('id').inTable('skus').onDelete('CASCADE');
    t.integer('delta_on_hand').notNullable().defaultTo(0);
    t.integer('delta_reserved').notNullable().defaultTo(0);
    t.enu('reason', ['adjustment', 'reserve', 'release', 'commit']).notNullable();
    t.string('ref', 64).nullable();
    t.string('actor_id', 36).nullable();
    t.string('note', 200).nullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['sku_id', 'id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['stock_movements', 'reservations', 'inventory_items']) await knex.schema.dropTableIfExists(t);
}
