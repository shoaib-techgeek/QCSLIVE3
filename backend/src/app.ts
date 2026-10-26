import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';
import type { Knex } from 'knex';
import type { Env } from './config/env.js';
import { AppError } from './shared/errors.js';
import { registerHealthRoutes } from './modules/health/health.routes.js';
import { LogMailer, MemoryMailer, type Mailer } from './shared/mailer.js';
import { AuthService } from './modules/identity/auth.service.js';
import { registerAuthGuard } from './modules/identity/auth.guard.js';
import { registerIdentityRoutes } from './modules/identity/auth.routes.js';

export interface AppDeps {
  env: Env;
  db: Knex;
  mailer?: Mailer;
}

export async function buildApp({ env, db, mailer }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    genReqId: (req) => (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].length <= 64
      ? req.headers['x-request-id']
      : randomUUID()),
    bodyLimit: 1_048_576,
  });

  // Body-less POSTs (e.g. logout) may still carry a JSON content type; treat an empty body as "no body"
  // so handlers' schemas decide whether that is acceptable. Malformed JSON stays a 400.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (body === '') return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON.'), undefined);
    }
  });

  await app.register(helmet);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(cookie);

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  // Uniform error shape from docs 04; never leak stack traces or SQL.
  app.setErrorHandler((err, req, reply) => {
    const requestId = req.id;
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, requestId, details: err.details } });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          requestId,
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.', requestId, details: [] } });
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(status).send({ error: { code: 'BAD_REQUEST', message: 'The request could not be processed.', requestId, details: [] } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId, details: [] } });
  });

  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Resource not found.', requestId: req.id, details: [] } }),
  );

  const authService = new AuthService({
    db,
    env,
    mailer: mailer ?? (env.MAIL_DRIVER === 'memory' ? new MemoryMailer() : new LogMailer(app.log)),
  });
  registerAuthGuard(app, authService);

  registerHealthRoutes(app, db);
  registerIdentityRoutes(app, authService, env);
  return app;
}
