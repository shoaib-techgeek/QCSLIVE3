import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors.js';
import { MAX_UPLOAD_BYTES } from '../../shared/file-storage.js';
import { adminQueueQuerySchema, createProductSchema, listQuerySchema, moderateSchema, updateProductSchema } from './catalog-schemas.js';
import type { CatalogActor, CatalogService } from './catalog.service.js';

const actorOf = (req: FastifyRequest): CatalogActor => ({ userId: req.auth!.userId, publicId: req.auth!.publicId, requestId: req.id });
const param = (req: FastifyRequest, name: string) => String((req.params as Record<string, string>)[name]);

export function registerCatalogRoutes(app: FastifyInstance, service: CatalogService): void {
  const auth = { preHandler: app.authz.requireAuth };

  app.get('/api/v1/seller/products', auth, async (req) => service.list(actorOf(req), listQuerySchema.parse(req.query)));

  app.post('/api/v1/seller/products', auth, async (req, reply) => {
    const product = await service.create(actorOf(req), createProductSchema.parse(req.body));
    return reply.code(201).send({ product });
  });

  app.get('/api/v1/seller/products/:productId', auth, async (req) => ({ product: await service.get(actorOf(req), param(req, 'productId')) }));

  app.patch('/api/v1/seller/products/:productId', auth, async (req) => ({
    product: await service.update(actorOf(req), param(req, 'productId'), updateProductSchema.parse(req.body)),
  }));

  app.delete('/api/v1/seller/products/:productId', auth, async (req, reply) => {
    await service.remove(actorOf(req), param(req, 'productId'));
    return reply.code(204).send();
  });

  app.post('/api/v1/seller/products/:productId/submit', auth, async (req) => ({ product: await service.submit(actorOf(req), param(req, 'productId')) }));
  app.post('/api/v1/seller/products/:productId/deactivate', auth, async (req) => ({ product: await service.deactivate(actorOf(req), param(req, 'productId')) }));
  app.post('/api/v1/seller/products/:productId/activate', auth, async (req) => ({ product: await service.activate(actorOf(req), param(req, 'productId')) }));

  // Optional `altText` field must be sent before the `file` part.
  app.post('/api/v1/seller/products/:productId/images', auth, async (req, reply) => {
    const part = await req.file();
    if (!part) throw new AppError(400, 'VALIDATION_ERROR', 'A file is required.');
    const alt = (part.fields.altText as { value?: unknown } | undefined)?.value;
    let data: Buffer;
    try {
      data = await part.toBuffer();
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new AppError(413, 'FILE_TOO_LARGE', `Files can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
      throw err;
    }
    if (part.file.truncated) throw new AppError(413, 'FILE_TOO_LARGE', `Files can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    return reply.code(201).send({ image: await service.addImage(actorOf(req), param(req, 'productId'), data, typeof alt === 'string' ? alt : undefined) });
  });

  app.delete('/api/v1/seller/products/:productId/images/:imageId', auth, async (req, reply) => {
    await service.removeImage(actorOf(req), param(req, 'productId'), param(req, 'imageId'));
    return reply.code(204).send();
  });

  const moderate = { preHandler: app.authz.requirePermission('product:moderate') };
  app.get('/api/v1/admin/products', moderate, async (req) => service.adminQueue(adminQueueQuerySchema.parse(req.query)));
  app.get('/api/v1/admin/products/:productId', moderate, async (req) => ({ product: await service.adminDetail(param(req, 'productId')) }));
  app.post('/api/v1/admin/products/:productId/moderate', moderate, async (req) => {
    const body = moderateSchema.parse(req.body);
    return { product: await service.moderate(actorOf(req), param(req, 'productId'), body.decision, body.reason) };
  });

  app.get('/api/v1/media/products/:imageId', async (req, reply) => {
    const moderator = await app.authz.can(req, 'product:moderate');
    const { data, mime, isPublic } = await service.media(param(req, 'imageId'), req.auth?.userId ?? null, moderator);
    return reply.header('content-type', mime).header('cache-control', isPublic ? 'public, max-age=3600' : 'private, no-store').send(data);
  });
}
