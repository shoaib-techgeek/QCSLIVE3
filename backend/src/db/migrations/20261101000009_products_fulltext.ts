import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE products ADD FULLTEXT INDEX ft_products_search (title, description)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE products DROP INDEX ft_products_search');
}
