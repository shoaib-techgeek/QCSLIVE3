import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import type { Env } from '../../config/env.js';
import { recordAudit } from '../../shared/audit.js';
import { AppError } from '../../shared/errors.js';
import type { Mailer } from '../../shared/mailer.js';
import { hashPassword, verifyPassword } from './password.js';
import { generateToken, hashToken } from './tokens.js';
import * as repo from './identity.repository.js';

export const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESET_TTL_MS = 3600 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

export interface AuthContext {
  sessionId: number;
  userId: number;
  publicId: string;
}

export interface AccountView {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  status: repo.UserStatus;
  permissions: string[];
}

const INVALID_TOKEN = () => new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.');
const INVALID_CREDENTIALS = () => new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

// Verified against when the email is unknown, so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('timing-equalisation-placeholder'));

export class AuthService {
  constructor(
    private readonly deps: { db: Knex; mailer: Mailer; env: Env },
  ) {}

  private get db() {
    return this.deps.db;
  }

  /**
   * With verification required: always succeeds from the caller's view; an existing address gets a
   * notice email instead of a duplicate account (no account enumeration).
   * With verification disabled: the account is active immediately, and a duplicate email is reported
   * (409), since there is no mailbox to notify.
   */
  async register(
    input: { email: string; password: string; fullName: string | null },
    ctx: RequestContext,
  ): Promise<{ verificationRequired: boolean }> {
    const verificationRequired = this.deps.env.REQUIRE_EMAIL_VERIFICATION;
    const passwordHash = await hashPassword(input.password); // hashed first so both paths cost the same
    const now = new Date();
    const existing = await repo.findUserByEmail(this.db, input.email);
    const emailTaken = () => new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
    if (existing && !verificationRequired) throw emailTaken();
    if (existing) {
      await this.deps.mailer.send({
        to: input.email,
        subject: 'You already have an account',
        text: `Someone tried to register with this email. If it was you, sign in or reset your password: ${this.deps.env.APP_BASE_URL}/forgot-password`,
      });
      return { verificationRequired };
    }

    const publicId = randomUUID();
    const { token, hash } = generateToken();
    try {
      await this.db.transaction(async (trx) => {
        const userId = await repo.insertUser(trx, { publicId, email: input.email, passwordHash, fullName: input.fullName });
        await repo.assignRole(trx, userId, 'customer');
        if (verificationRequired) {
          await repo.createOneTimeToken(trx, {
            userId, purpose: 'email_verification', tokenHash: hash, expiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
          });
        } else {
          // Active without proof of mailbox ownership: email_verified_at deliberately stays NULL.
          await repo.setStatus(trx, userId, 'active', now);
        }
        await recordAudit(trx, { actorId: publicId, action: 'auth.register', targetType: 'user', targetId: publicId, requestId: ctx.requestId });
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') { // lost a race with a concurrent registration
        if (!verificationRequired) throw emailTaken();
        return { verificationRequired };
      }
      throw err;
    }
    if (!verificationRequired) return { verificationRequired };
    await this.deps.mailer.send({
      to: input.email,
      subject: 'Verify your email',
      text: `Confirm your email address (valid 24 hours): ${this.deps.env.APP_BASE_URL}/verify-email?token=${token}`,
    });
    return { verificationRequired };
  }

  async verifyEmail(token: string, ctx: RequestContext): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (trx) => {
      const userId = await repo.consumeOneTimeToken(trx, 'email_verification', hashToken(token), now);
      if (userId === null) throw INVALID_TOKEN();
      await repo.activateUser(trx, userId, now);
      const user = await repo.findUserById(trx, userId);
      await recordAudit(trx, { actorId: user?.public_id, action: 'auth.email_verified', targetType: 'user', targetId: user?.public_id, requestId: ctx.requestId });
    });
  }

  async login(input: { email: string; password: string }, ctx: RequestContext): Promise<{ token: string; account: AccountView }> {
    const now = new Date();
    const user = await repo.findUserByEmail(this.db, input.email);
    if (!user) {
      await verifyPassword(input.password, await getDummyHash());
      throw INVALID_CREDENTIALS();
    }
    if (user.locked_until && user.locked_until > now) {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts. Try again later.');
    }

    if (!(await verifyPassword(input.password, user.password_hash))) {
      const locked = await repo.registerFailedLogin(this.db, user.id, MAX_FAILED_LOGINS, new Date(now.getTime() + LOCK_MS));
      await recordAudit(this.db, {
        actorId: user.public_id, action: locked ? 'auth.account_locked' : 'auth.login_failed',
        targetType: 'user', targetId: user.public_id, requestId: ctx.requestId,
      });
      throw INVALID_CREDENTIALS();
    }

    // Status is only disclosed after a correct password, so it cannot be used to probe accounts.
    if (user.status === 'pending_verification') {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address before signing in.');
    }
    if (user.status !== 'active') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is not available.');
    }

    const { token, hash } = generateToken(); // fresh token every login: no session fixation
    await this.db.transaction(async (trx) => {
      await repo.resetLoginState(trx, user.id, now);
      await repo.createSession(trx, { userId: user.id, tokenHash: hash, expiresAt: new Date(now.getTime() + SESSION_TTL_MS), ip: ctx.ip, userAgent: ctx.userAgent });
      await recordAudit(trx, { actorId: user.public_id, action: 'auth.login', targetType: 'user', targetId: user.public_id, requestId: ctx.requestId });
    });
    return { token, account: await this.accountView(user.id) };
  }

  async authenticate(sessionToken: string): Promise<AuthContext | null> {
    return repo.findActiveSession(this.db, hashToken(sessionToken), new Date());
  }

  async logout(sessionToken: string, ctx: RequestContext, auth: AuthContext | null): Promise<void> {
    await repo.revokeSessionByHash(this.db, hashToken(sessionToken), new Date());
    if (auth) await recordAudit(this.db, { actorId: auth.publicId, action: 'auth.logout', targetType: 'user', targetId: auth.publicId, requestId: ctx.requestId });
  }

  /** Same outcome whether or not the account exists. */
  async forgotPassword(email: string): Promise<void> {
    const now = new Date();
    const user = await repo.findUserByEmail(this.db, email);
    if (!user || user.status !== 'active') return;
    const { token, hash } = generateToken();
    await this.db.transaction(async (trx) => {
      await repo.invalidateOneTimeTokens(trx, user.id, 'password_reset', now);
      await repo.createOneTimeToken(trx, { userId: user.id, purpose: 'password_reset', tokenHash: hash, expiresAt: new Date(now.getTime() + RESET_TTL_MS) });
    });
    await this.deps.mailer.send({
      to: email,
      subject: 'Reset your password',
      text: `Reset your password (valid 1 hour): ${this.deps.env.APP_BASE_URL}/reset-password?token=${token}`,
    });
  }

  async resetPassword(token: string, newPassword: string, ctx: RequestContext): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    const now = new Date();
    await this.db.transaction(async (trx) => {
      const userId = await repo.consumeOneTimeToken(trx, 'password_reset', hashToken(token), now);
      if (userId === null) throw INVALID_TOKEN();
      await repo.setPassword(trx, userId, passwordHash, now);
      await repo.revokeUserSessions(trx, userId, now); // a reset signs out every device
      const user = await repo.findUserById(trx, userId);
      await recordAudit(trx, { actorId: user?.public_id, action: 'auth.password_reset', targetType: 'user', targetId: user?.public_id, requestId: ctx.requestId });
    });
  }

  async changePassword(auth: AuthContext, current: string, next: string, ctx: RequestContext): Promise<void> {
    const user = await repo.findUserById(this.db, auth.userId);
    if (!user || !(await verifyPassword(current, user.password_hash))) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
    }
    const passwordHash = await hashPassword(next);
    const now = new Date();
    await this.db.transaction(async (trx) => {
      await repo.setPassword(trx, user.id, passwordHash, now);
      await repo.revokeUserSessions(trx, user.id, now, auth.sessionId); // other devices are signed out
      await recordAudit(trx, { actorId: user.public_id, action: 'auth.password_changed', targetType: 'user', targetId: user.public_id, requestId: ctx.requestId });
    });
  }

  async accountView(userId: number): Promise<AccountView> {
    const user = await repo.findUserById(this.db, userId);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Resource not found.');
    return {
      id: user.public_id, email: user.email, fullName: user.full_name, phone: user.phone, status: user.status,
      permissions: await repo.getPermissions(this.db, userId),
    };
  }

  async updateProfile(auth: AuthContext, patch: { fullName?: string | null; phone?: string | null }, ctx: RequestContext): Promise<AccountView> {
    const update: { full_name?: string | null; phone?: string | null } = {};
    if (patch.fullName !== undefined) update.full_name = patch.fullName;
    if (patch.phone !== undefined) update.phone = patch.phone;
    if (Object.keys(update).length > 0) {
      await repo.updateProfile(this.db, auth.userId, update, new Date());
      await recordAudit(this.db, {
        actorId: auth.publicId, action: 'account.profile_updated', targetType: 'user', targetId: auth.publicId,
        requestId: ctx.requestId, summary: { fields: Object.keys(update) },
      });
    }
    return this.accountView(auth.userId);
  }

  hasPermission(userId: number, permission: string): Promise<boolean> {
    return repo.getPermissions(this.db, userId).then((p) => p.includes(permission));
  }
}
