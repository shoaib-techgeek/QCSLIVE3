import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { buildApp } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';
import { createDb } from '../../src/db/knex.js';
import { MemoryMailer } from '../../src/shared/mailer.js';

export function testEnv(overrides: NodeJS.ProcessEnv = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DB_USER: process.env.DB_USER ?? 'root',
    DB_PASSWORD: process.env.DB_PASSWORD ?? '',
    DB_NAME: 'marketplace_dev',
    DB_TEST_NAME: process.env.DB_TEST_NAME ?? 'marketplace_test',
    AUTH_RATE_LIMIT_MAX: '1000',
    MAIL_DRIVER: 'memory',
    ...overrides,
  });
}

export interface TestContext {
  app: FastifyInstance;
  db: Knex;
  mailer: MemoryMailer;
}

/** Builds the app against the test database with all migrations applied. */
export async function startTestApp(envOverrides: NodeJS.ProcessEnv = {}): Promise<TestContext> {
  const env = testEnv(envOverrides);
  const db = createDb(env);
  await db.migrate.latest();
  const mailer = new MemoryMailer();
  const app = await buildApp({ env, db, mailer });
  await app.ready();
  return { app, db, mailer };
}

export async function stopTestApp({ app, db }: TestContext): Promise<void> {
  await app.close();
  await db.destroy();
}

/** Clears identity data between tests; seeded roles/permissions are kept. */
export async function resetIdentityData(db: Knex): Promise<void> {
  for (const t of ['sessions', 'one_time_tokens', 'user_roles', 'users', 'audit_events']) await db(t).delete();
}
