import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors.js';
import { decisionSchema, documentKindSchema, kycPiiSchema, queueQuerySchema } from './kyc-schemas.js';
import type { KycActor, KycService } from './kyc.service.js';

const actorOf = (req: FastifyRequest): KycActor => ({ userId: req.auth!.userId, publicId: req.auth!.publicId, requestId: req.id });
const idParam = (req: FastifyRequest, name: string) => String((req.params as Record<string, string>)[name]);

export function registerKycRoutes(app: FastifyInstance, service: KycService): void {
  const auth = { preHandler: app.authz.requireAuth };
  const review = { preHandler: app.authz.requirePermission('kyc:review') };

  app.get('/api/v1/seller/kyc', auth, async (req) => ({ kyc: await service.mine(actorOf(req)) }));

  // The `kind` field must be sent before the `file` part.
  app.post('/api/v1/seller/kyc/documents', auth, async (req, reply) => {
    const part = await req.file();
    if (!part) throw new AppError(400, 'VALIDATION_ERROR', 'A file is required.');
    const kindField = part.fields.kind as { value?: unknown } | undefined;
    const kind = documentKindSchema.safeParse(kindField?.value);
    if (!kind.success) throw new AppError(400, 'VALIDATION_ERROR', 'Unknown document kind.', [{ path: 'kind', message: 'Unknown document kind.' }]);
    let data: Buffer;
    try {
      data = await part.toBuffer();
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new AppError(413, 'FILE_TOO_LARGE', 'Files can be at most 5 MB.');
      throw err;
    }
    if (part.file.truncated) throw new AppError(413, 'FILE_TOO_LARGE', 'Files can be at most 5 MB.');
    return reply.code(201).send({ document: await service.upload(actorOf(req), kind.data, data) });
  });

  app.delete('/api/v1/seller/kyc/documents/:documentId', auth, async (req, reply) => {
    await service.removeDocument(actorOf(req), idParam(req, 'documentId'));
    return reply.code(204).send();
  });

  app.put('/api/v1/seller/kyc/pii', auth, async (req) => ({ kyc: await service.savePii(actorOf(req), kycPiiSchema.parse(req.body)) }));

  app.post('/api/v1/seller/kyc/submit', auth, async (req) => ({ kyc: await service.submit(actorOf(req)) }));

  app.get('/api/v1/admin/kyc', review, async (req) => service.queue(queueQuerySchema.parse(req.query)));

  app.get('/api/v1/admin/kyc/:sellerId', review, async (req) => ({ kyc: await service.detail(actorOf(req), idParam(req, 'sellerId')) }));

  app.get('/api/v1/admin/kyc/:sellerId/documents/:documentId', review, async (req, reply) => {
    const { data, mime } = await service.download(actorOf(req), idParam(req, 'sellerId'), idParam(req, 'documentId'));
    return reply.header('content-type', mime).header('cache-control', 'no-store').header('content-disposition', 'inline').send(data);
  });

  app.post('/api/v1/admin/kyc/:sellerId/decision', review, async (req) => {
    const body = decisionSchema.parse(req.body);
    return { kyc: await service.decide(actorOf(req), idParam(req, 'sellerId'), body.decision, body.note) };
  });
}
