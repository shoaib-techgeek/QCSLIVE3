import type { FastifyInstance } from 'fastify';
import { addItemSchema, updateItemSchema } from './cart-schemas.js';
import type { CartService } from './cart.service.js';

export function registerCartRoutes(app: FastifyInstance, service: CartService): void {
  const auth = { preHandler: app.authz.requireAuth };

  app.get('/api/v1/cart', auth, async (req, reply) => reply.header('cache-control', 'private, no-store').send(await service.get(req.auth!.userId)));

  app.post('/api/v1/cart/items', auth, async (req, reply) => {
    const body = addItemSchema.parse(req.body);
    return reply.code(201).send(await service.add(req.auth!.userId, body.skuId, body.qty));
  });

  app.patch('/api/v1/cart/items/:itemId', auth, async (req) =>
    service.update(req.auth!.userId, String((req.params as { itemId: string }).itemId), updateItemSchema.parse(req.body)));

  app.delete('/api/v1/cart/items/:itemId', auth, async (req, reply) => {
    await service.remove(req.auth!.userId, String((req.params as { itemId: string }).itemId));
    return reply.code(204).send();
  });
}
