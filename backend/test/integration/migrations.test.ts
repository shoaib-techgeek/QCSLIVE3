import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/knex.js';
import { testEnv } from './helpers.js';

describe('migrations', () => {
  const db = createDb(testEnv());
  beforeAll(async () => { await db.migrate.latest(); });
  afterAll(async () => { await db.destroy(); });

  it('creates audit_events with the expected columns', async () => {
    const cols = await db('information_schema.columns')
      .where({ table_schema: testEnv().DB_ACTIVE_NAME, table_name: 'audit_events' })
      .pluck('COLUMN_NAME');
    expect(cols).toEqual(expect.arrayContaining(['id', 'occurred_at', 'actor_id', 'action', 'target_type', 'target_id', 'request_id', 'summary']));
  });

  it('rolls back and re-applies cleanly', async () => {
    await db.migrate.rollback(undefined, true);
    expect(await db.schema.hasTable('audit_events')).toBe(false);
    await db.migrate.latest();
    expect(await db.schema.hasTable('audit_events')).toBe(true);
  });

  it('only ever targets the test database', () => {
    expect(testEnv().DB_ACTIVE_NAME).toBe('marketplace_test');
  });
});
