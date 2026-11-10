import type { Knex } from 'knex';

const PERMISSION = 'product:moderate';

export async function up(knex: Knex): Promise<void> {
  const [permissionId] = await knex('permissions').insert({ name: PERMISSION });
  const admin = await knex('roles').where({ name: 'admin' }).first('id');
  if (admin) await knex('role_permissions').insert({ role_id: admin.id, permission_id: permissionId });
}

export async function down(knex: Knex): Promise<void> {
  await knex('permissions').where({ name: PERMISSION }).delete(); // role_permissions rows cascade
}
