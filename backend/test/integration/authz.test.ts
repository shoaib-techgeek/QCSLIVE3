import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDb } from '../../src/db/knex.js';
import { MemoryMailer } from '../../src/shared/mailer.js';
import { resetIdentityData, testEnv } from './helpers.js';

// Exercises the permission primitive with a route that requires a permission no customer holds.
const env = testEnv();
const db = createDb(env);
const mailer = new MemoryMailer();
const H = { 'x-requested-with': 'XMLHttpRequest' };
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  await db.migrate.latest();
  app = await buildApp({ env, db, mailer });
  app.get('/__test/admin-only', { preHandler: app.authz.requirePermission('admin:everything') }, async () => ({ ok: true }));
  await app.ready();
});
afterAll(async () => { await app.close(); await db.destroy(); });
beforeEach(async () => { await resetIdentityData(db); });

describe('permission guard', () => {
  it('401 without a session, 403 with a session lacking the permission, 200 once granted', async () => {
    expect((await app.inject('/__test/admin-only')).statusCode).toBe(401);

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: H, payload: { email: 'jane@example.com', password: 'a-reasonably-long-passphrase' } });
    const token = /token=([\w-]+)/.exec(mailer.lastTo('jane@example.com')!.text)![1];
    await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', headers: H, payload: { token } });
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: H, payload: { email: 'jane@example.com', password: 'a-reasonably-long-passphrase' } });
    const cookie = `sid=${login.cookies.find((c) => c.name === 'sid')!.value}`;

    expect((await app.inject({ url: '/__test/admin-only', headers: { cookie } })).statusCode).toBe(403);

    const [permId] = await db('permissions').insert({ name: 'admin:everything' });
    const [roleId] = await db('roles').insert({ name: 'test-admin' });
    await db('role_permissions').insert({ role_id: roleId, permission_id: permId });
    const user = await db('users').first('id');
    await db('user_roles').insert({ user_id: user.id, role_id: roleId });
    expect((await app.inject({ url: '/__test/admin-only', headers: { cookie } })).statusCode).toBe(200);

    await db('user_roles').where({ role_id: roleId }).delete();
    await db('role_permissions').where({ role_id: roleId }).delete();
    await db('roles').where({ id: roleId }).delete();
    await db('permissions').where({ id: permId }).delete();
  });
});
