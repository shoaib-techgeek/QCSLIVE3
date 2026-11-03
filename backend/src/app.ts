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
import { SellerService } from './modules/seller/seller.service.js';
import { registerSellerRoutes } from './modules/seller/seller.routes.js';
import { KycService } from './modules/seller/kyc.service.js';
import { registerKycRoutes } from './modules/seller/kyc.routes.js';
import { assignRole } from './modules/identity/identity.repository.js';
import multipart from '@fastify/multipart';
import { Aes256GcmEncryptor, parseEncryptionKey, type Encryptor } from './shared/encryptor.js';
import { LocalFileStorage, MemoryFileStorage, type FileStorage } from './shared/file-storage.js';
import { MAX_FILE_BYTES } from './modules/seller/kyc-schemas.js';

export interface AppDeps {
  env: Env;
  db: Knex;
  mailer?: Mailer;
  storage?: FileStorage;
  encryptor?: Encryptor;
}

export async function buildApp({ env, db, mailer, storage, encryptor }: AppDeps): Promise<FastifyInstance> {
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
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 5 } });

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
  registerSellerRoutes(app, new SellerService(db));
  registerKycRoutes(app, new KycService(db, storage ?? defaultStorage(env), encryptor ?? defaultEncryptor(env), assignRole));
  return app;
}

function defaultStorage(env: Env): FileStorage {
  if (env.STORAGE_DRIVER === 'memory') return new MemoryFileStorage();
  if (env.STORAGE_DRIVER === 'local') return new LocalFileStorage(env.STORAGE_DIR);
  throw new Error('STORAGE_DRIVER=s3 is not implemented yet');
}

function defaultEncryptor(env: Env): Encryptor {
  if (env.PII_ENCRYPTION_KEY) return new Aes256GcmEncryptor(parseEncryptionKey(env.PII_ENCRYPTION_KEY));
  // Dev convenience: the API boots without a key, but KYC details cannot be saved until one is set.
  const fail = () => { throw new AppError(503, 'ENCRYPTION_NOT_CONFIGURED', 'Set PII_ENCRYPTION_KEY to use seller verification.'); };
  return { encrypt: fail, decrypt: fail };
}
