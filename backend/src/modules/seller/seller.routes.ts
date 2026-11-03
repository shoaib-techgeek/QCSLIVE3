import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createSellerSchema, updateSellerSchema } from './schemas.js';
import type { SellerActor, SellerService } from './seller.service.js';

const actorOf = (req: FastifyRequest): SellerActor => ({ userId: req.auth!.userId, publicId: req.auth!.publicId, requestId: req.id });

export function registerSellerRoutes(app: FastifyInstance, service: SellerService): void {
  const auth = { preHandler: app.authz.requireAuth };

  app.post('/api/v1/seller/profile', auth, async (req, reply) => {
    const body = createSellerSchema.parse(req.body);
    return reply.code(201).send({ seller: await service.register(actorOf(req), body) });
  });

  app.get('/api/v1/seller/profile', auth, async (req) => ({ seller: await service.mine(req.auth!.userId) }));

  app.patch('/api/v1/seller/profile', auth, async (req) => {
    const body = updateSellerSchema.parse(req.body);
    return { seller: await service.updateDescription(actorOf(req), body.description) };
  });
}
