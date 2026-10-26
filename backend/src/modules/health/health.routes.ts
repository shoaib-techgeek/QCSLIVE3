import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';

export function registerHealthRoutes(app: FastifyInstance, db: Knex): void {
  // Liveness: process is up. No dependency checks, so orchestrators don't restart on DB blips.
  app.get('/health/live', async () => ({ status: 'ok' }));

  // Readiness: safe to receive traffic only if the database answers.
  app.get('/health/ready', async (_req, reply) => {
    try {
      await db.raw('select 1');
      return { status: 'ok', checks: { database: 'up' } };
    } catch (err) {
      app.log.error({ err }, 'readiness check failed');
      return reply.code(503).send({ status: 'unavailable', checks: { database: 'down' } });
    }
  });
}
