import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/knex.js';
import { clearPasswordAndVerify, findIdentity, findUserById, insertIdentity, insertUser } from '../../src/modules/identity/identity.repository.js';
import { resetIdentityData, testEnv } from './helpers.js';

describe('oauth repository', () => {
  const db = createDb(testEnv());
  beforeAll(async () => { await db.migrate.latest(); });
  beforeEach(async () => { await resetIdentityData(db); });
  afterAll(async () => { await db.destroy(); });

  const mkUser = (n: string, passwordHash: string | null = 'h') =>
    insertUser(db, { publicId: `01HZZZZZZZZZZZZZZZZZZZZZ${n}`, email: `u${n}@example.com`, passwordHash, fullName: null });

  it('insertIdentity twice with the same (provider, subject) throws ER_DUP_ENTRY', async () => {
    const a = await mkUser('A');
    const b = await mkUser('B');
    await insertIdentity(db, { userId: a, provider: 'google', subject: 's1' });
    expect(await findIdentity(db, 'google', 's1')).toEqual({ user_id: a });
    await expect(insertIdentity(db, { userId: b, provider: 'google', subject: 's1' })).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('insertUser accepts a null passwordHash', async () => {
    const id = await mkUser('C', null);
    expect((await findUserById(db, id))?.password_hash).toBeNull();
  });

  it('clearPasswordAndVerify nulls the hash, sets email_verified_at and status active', async () => {
    const id = await mkUser('D');
    const now = new Date();
    await clearPasswordAndVerify(db, id, now);
    const u = await findUserById(db, id);
    expect(u).toMatchObject({ password_hash: null, status: 'active', failed_login_count: 0, locked_until: null });
    expect(u?.email_verified_at).not.toBeNull();
  });
});
