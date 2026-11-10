import type { FastifyInstance, FastifyRequest } from 'fastify';
import { setStockSchema } from './inventory-schemas.js';
import type { InventoryService, StockTarget } from './inventory.service.js';

export function registerInventoryRoutes(app: FastifyInstance, service: InventoryService, ownSku: (req: FastifyRequest, skuPublicId: string) => Promise<StockTarget>): void {
  app.put('/api/v1/seller/skus/:skuId/stock', { preHandler: app.authz.requireAuth }, async (req) => {
    const target = await ownSku(req, String((req.params as { skuId: string }).skuId)); // ownership first: a stranger gets 404 before validation details
    const body = setStockSchema.parse(req.body);
    return { stock: await service.setOnHand(target, body.onHand, { actorId: req.auth!.publicId, note: body.note }) };
  });
}
