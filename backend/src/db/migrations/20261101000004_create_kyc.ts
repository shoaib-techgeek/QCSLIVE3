import type { Knex } from 'knex';

const STATUSES = ['not_submitted', 'submitted', 'under_review', 'approved', 'approved_with_conditions', 'rejected', 'more_info_required'];
const KINDS = ['cnic_front', 'cnic_back', 'business_registration', 'business_photo', 'tax_certificate'];
const PERMISSIONS = ['seller:access', 'admin:access', 'kyc:review'];
const ROLES: Record<string, string[]> = {
  seller: ['account:read', 'account:update', 'seller:access'],
  admin: ['account:read', 'account:update', 'admin:access', 'kyc:review'],
};

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kyc_applications', (t) => {
    t.bigIncrements('id');
    t.bigInteger('seller_id').unsigned().notNullable().unique().references('id').inTable('sellers');
    t.enu('status', STATUSES).notNullable().defaultTo('not_submitted');
    t.string('note', 1000).nullable(); // latest reviewer note shown to the seller
    t.dateTime('submitted_at', { precision: 3 }).nullable();
    t.string('reviewed_by', 36).nullable();
    t.dateTime('reviewed_at', { precision: 3 }).nullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });
  await knex.schema.createTable('kyc_documents', (t) => {
    t.bigIncrements('id');
    t.specificType('public_id', 'char(36)').notNullable().unique();
    t.bigInteger('application_id').unsigned().notNullable().references('id').inTable('kyc_applications').onDelete('CASCADE');
    t.enu('kind', KINDS).notNullable();
    t.string('storage_key', 200).notNullable().unique();
    t.string('mime', 100).notNullable();
    t.integer('size_bytes').unsigned().notNullable();
    t.specificType('sha256', 'char(64)').notNullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['application_id', 'kind']);
  });
  await knex.schema.createTable('kyc_pii', (t) => {
    t.bigInteger('application_id').unsigned().primary().references('id').inTable('kyc_applications').onDelete('CASCADE');
    t.text('cnic_enc').notNullable();
    t.specificType('cnic_last4', 'char(4)').notNullable();
    t.text('address_enc').notNullable();
    t.text('ntn_enc').nullable();
    t.dateTime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });
  // Append-only: never UPDATE/DELETE.
  await knex.schema.createTable('kyc_status_history', (t) => {
    t.bigIncrements('id');
    t.bigInteger('application_id').unsigned().notNullable().references('id').inTable('kyc_applications').onDelete('CASCADE');
    t.enu('from_status', STATUSES).notNullable();
    t.enu('to_status', STATUSES).notNullable();
    t.string('actor_id', 36).notNullable();
    t.string('note', 1000).nullable();
    t.dateTime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.index(['application_id', 'id']);
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
  await knex('roles').whereIn('name', Object.keys(ROLES)).delete();
  await knex('permissions').whereIn('name', PERMISSIONS).delete();
  for (const t of ['kyc_status_history', 'kyc_pii', 'kyc_documents', 'kyc_applications']) await knex.schema.dropTableIfExists(t);
}
