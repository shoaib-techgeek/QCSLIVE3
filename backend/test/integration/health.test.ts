import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createDb } from '../../src/db/knex.js';
import { startTestApp, stopTestApp, testEnv, type TestContext } from './helpers.js';

describe('health endpoints', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp(); });
  afterAll(async () => { await stopTestApp(ctx); });

  it('liveness returns ok', async () => {
    const res = await ctx.app.inject('/health/live');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('readiness returns ok when the database is reachable', async () => {
    const res = await ctx.app.inject('/health/ready');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('readiness returns 503 when the database is unreachable, liveness stays ok', async () => {
    const badEnv = testEnv({ DB_PORT: '1' });
    const badDb = createDb(badEnv);
    const app = await buildApp({ env: badEnv, db: badDb });
    try {
      const ready = await app.inject('/health/ready');
      expect(ready.statusCode).toBe(503);
      expect(ready.json().checks.database).toBe('down');
      expect(ready.body).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/);
      expect((await app.inject('/health/live')).statusCode).toBe(200);
    } finally {
      await app.close();
      await badDb.destroy();
    }
  });
});

describe('http conventions', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp(); });
  afterAll(async () => { await stopTestApp(ctx); });

  it('returns the standard error shape with a request id for unknown routes', async () => {
    const res = await ctx.app.inject({ url: '/nope', headers: { 'x-request-id': 'req-123' } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Resource not found.', requestId: 'req-123', details: [] },
    });
    expect(res.headers['x-request-id']).toBe('req-123');
  });

  it('generates a request id when none is supplied or it is oversized', async () => {
    const res = await ctx.app.inject({ url: '/health/live', headers: { 'x-request-id': 'x'.repeat(200) } });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets security headers', async () => {
    const res = await ctx.app.inject('/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
