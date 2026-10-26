import type { Knex } from 'knex';

// Authorization checks use permissions, not role names (docs 07 step 8).
const PERMISSIONS = ['account:read', 'account:update'];
const ROLES: Record<string, string[]> = { customer: ['account:read', 'account:update'] };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('roles', (t) => {
    t.increments('id');
    t.string('name', 64).notNullable().unique();
  });
  await knex.schema.createTable('permissions', (t) => {
    t.increments('id');
    t.string('name', 100).notNullable().unique();
  });
  await knex.schema.createTable('role_permissions', (t) => {
    t.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE');
    t.integer('permission_id').unsigned().notNullable().references('id').inTable('permissions').onDelete('CASCADE');
    t.primary(['role_id', 'permission_id']);
  });
  await knex.schema.createTable('user_roles', (t) => {
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE');
    t.primary(['user_id', 'role_id']);
  });

  for (const name of PERMISSIONS) await knex('permissions').insert({ name });
  for (const [role, perms] of Object.entries(ROLES)) {
    const [roleId] = await knex('roles').insert({ name: role });
    for (const p of perms) {
      const row = await knex('permissions').where({ name: p }).first('id');
      await knex('role_permissions').insert({ role_id: roleId, permission_id: row.id });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['user_roles', 'role_permissions', 'permissions', 'roles']) await knex.schema.dropTableIfExists(t);
}
