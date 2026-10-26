import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors.js';
import type { AuthContext, AuthService } from './auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    authz: {
      requireAuth: (req: FastifyRequest) => Promise<void>;
      requirePermission: (permission: string) => (req: FastifyRequest) => Promise<void>;
    };
  }
}

export const SESSION_COOKIE = 'sid';

export function registerAuthGuard(app: FastifyInstance, service: AuthService): void {
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (req) => {
    const sid = req.cookies[SESSION_COOKIE];
    if (sid) req.auth = await service.authenticate(sid);
  });

  // CSRF defence in depth on top of SameSite=Lax: a custom header cannot be sent cross-origin
  // without a CORS preflight, which this API never approves.
  app.addHook('onRequest', async (req) => {
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutating && req.url.startsWith('/api/') && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      throw new AppError(403, 'CSRF_REJECTED', 'Request rejected.');
    }
  });

  const requireAuth = async (req: FastifyRequest) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  };
  // Deny by default: no session -> 401, session without the permission -> 403.
  const requirePermission = (permission: string) => async (req: FastifyRequest) => {
    await requireAuth(req);
    if (!(await service.hasPermission(req.auth!.userId, permission))) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this.');
    }
  };
  app.decorate('authz', { requireAuth, requirePermission });
}
