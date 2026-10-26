import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { SESSION_COOKIE } from './auth.guard.js';
import { SESSION_TTL_MS, type AuthService, type RequestContext } from './auth.service.js';
import {
  changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema,
  resetPasswordSchema, updateProfileSchema, verifyEmailSchema,
} from './schemas.js';

const ctxOf = (req: FastifyRequest): RequestContext => ({
  ip: req.ip ?? null,
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  requestId: req.id,
});

export function registerIdentityRoutes(app: FastifyInstance, service: AuthService, env: Env): void {
  const cookieOpts = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  // Credential-handling routes get a tighter limit than the global one.
  const limited = { config: { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };
  const auth = { preHandler: app.authz.requireAuth };
  const must = (req: FastifyRequest) => req.auth!;

  app.post('/api/v1/auth/register', limited, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const { verificationRequired } = await service.register(
      { email: body.email, password: body.password, fullName: body.fullName ?? null },
      ctxOf(req),
    );
    if (!verificationRequired) {
      return reply.code(201).send({ verificationRequired, message: 'Account created. You can sign in now.' });
    }
    return reply.code(202).send({ verificationRequired, message: 'If the address can be registered, a verification email has been sent.' });
  });

  app.post('/api/v1/auth/verify-email', limited, async (req, reply) => {
    await service.verifyEmail(verifyEmailSchema.parse(req.body).token, ctxOf(req));
    return reply.code(204).send();
  });

  app.post('/api/v1/auth/login', limited, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const { token, account } = await service.login(body, ctxOf(req));
    reply.setCookie(SESSION_COOKIE, token, { ...cookieOpts, maxAge: SESSION_TTL_MS / 1000 });
    return { account };
  });

  app.post('/api/v1/auth/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    const sid = req.cookies[SESSION_COOKIE];
    if (sid) await service.logout(sid, ctxOf(req), req.auth);
    reply.clearCookie(SESSION_COOKIE, cookieOpts);
    return reply.code(204).send();
  });

  app.post('/api/v1/auth/forgot-password', limited, async (req, reply) => {
    await service.forgotPassword(forgotPasswordSchema.parse(req.body).email);
    return reply.code(202).send({ message: 'If an account exists, a reset email has been sent.' });
  });

  app.post('/api/v1/auth/reset-password', limited, async (req, reply) => {
    const body = resetPasswordSchema.parse(req.body);
    await service.resetPassword(body.token, body.password, ctxOf(req));
    return reply.code(204).send();
  });

  app.post('/api/v1/auth/change-password', { ...limited, ...auth }, async (req, reply) => {
    const body = changePasswordSchema.parse(req.body);
    await service.changePassword(must(req), body.currentPassword, body.newPassword, ctxOf(req));
    return reply.code(204).send();
  });

  app.get('/api/v1/me', { preHandler: app.authz.requirePermission('account:read') }, async (req) => ({
    account: await service.accountView(must(req).userId),
  }));

  app.patch('/api/v1/me', { preHandler: app.authz.requirePermission('account:update') }, async (req) => {
    const body = updateProfileSchema.parse(req.body);
    if (Object.keys(body).length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'Nothing to update.');
    return { account: await service.updateProfile(must(req), body, ctxOf(req)) };
  });
}
