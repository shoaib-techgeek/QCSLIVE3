import type { FastifyInstance } from 'fastify';
import { publicQuerySchema } from './public-schemas.js';
import type { CatalogService } from './catalog.service.js';

// Browsers always revalidate, so hiding or removing a product takes effect on the next page load; only shared caches (a CDN) may keep it for 60 s.
const CACHE = 'public, max-age=0, s-maxage=60';

/** Read-only storefront endpoints: no session, cacheable, never anything but live data. */
export function registerPublicCatalogRoutes(app: FastifyInstance, service: CatalogService): void {
  app.get('/api/v1/categories', async (_req, reply) => reply.header('cache-control', CACHE).send(await service.categories()));

  app.get('/api/v1/products', async (req, reply) => reply.header('cache-control', CACHE).send(await service.publicList(publicQuerySchema.parse(req.query))));

  app.get('/api/v1/products/:slug', async (req, reply) => {
    const product = await service.publicProduct(String((req.params as { slug: string }).slug));
    return reply.header('cache-control', CACHE).send({ product });
  });
}
