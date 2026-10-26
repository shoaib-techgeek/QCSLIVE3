import type { Knex } from 'knex';

type Db = Knex | Knex.Transaction;

export type UserStatus = 'pending_verification' | 'active' | 'suspended' | 'deleted';
export type TokenPurpose = 'email_verification' | 'password_reset';

export interface UserRow {
  id: number;
  public_id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  phone: string | null;
  status: UserStatus;
  email_verified_at: Date | null;
  failed_login_count: number;
  locked_until: Date | null;
}

export interface SessionUser {
  sessionId: number;
  userId: number;
  publicId: string;
}

export const findUserByEmail = (db: Db, email: string): Promise<UserRow | undefined> =>
  db<UserRow>('users').where({ email }).first();

export const findUserById = (db: Db, id: number): Promise<UserRow | undefined> =>
  db<UserRow>('users').where({ id }).first();

export async function insertUser(
  db: Db,
  u: { publicId: string; email: string; passwordHash: string; fullName: string | null },
): Promise<number> {
  const [id] = await db('users').insert({
    public_id: u.publicId,
    email: u.email,
    password_hash: u.passwordHash,
    full_name: u.fullName,
  });
  return id as number;
}

export async function assignRole(db: Db, userId: number, roleName: string): Promise<void> {
  const role = await db('roles').where({ name: roleName }).first('id');
  if (!role) throw new Error(`Role ${roleName} is not seeded`);
  await db('user_roles').insert({ user_id: userId, role_id: role.id });
}

export async function getPermissions(db: Db, userId: number): Promise<string[]> {
  return db('user_roles as ur')
    .join('role_permissions as rp', 'rp.role_id', 'ur.role_id')
    .join('permissions as p', 'p.id', 'rp.permission_id')
    .where('ur.user_id', userId)
    .distinct()
    .pluck('p.name');
}

export const createOneTimeToken = (
  db: Db,
  t: { userId: number; purpose: TokenPurpose; tokenHash: string; expiresAt: Date },
): Promise<unknown> =>
  db('one_time_tokens').insert({ user_id: t.userId, purpose: t.purpose, token_hash: t.tokenHash, expires_at: t.expiresAt });

/** Marks all unused tokens of a purpose as used, so only the newest link works. */
export const invalidateOneTimeTokens = (db: Db, userId: number, purpose: TokenPurpose, now: Date): Promise<unknown> =>
  db('one_time_tokens').where({ user_id: userId, purpose }).whereNull('used_at').update({ used_at: now });

/**
 * Atomically consumes a token. The conditional UPDATE guarantees single use even
 * if two requests present the same token concurrently.
 */
export async function consumeOneTimeToken(
  db: Db,
  purpose: TokenPurpose,
  tokenHash: string,
  now: Date,
): Promise<number | null> {
  const row = await db('one_time_tokens')
    .where({ purpose, token_hash: tokenHash })
    .whereNull('used_at')
    .where('expires_at', '>', now)
    .first('id', 'user_id');
  if (!row) return null;
  const affected = await db('one_time_tokens').where({ id: row.id }).whereNull('used_at').update({ used_at: now });
  return affected === 1 ? (row.user_id as number) : null;
}

export const createSession = (
  db: Db,
  s: { userId: number; tokenHash: string; expiresAt: Date; ip: string | null; userAgent: string | null },
): Promise<unknown> =>
  db('sessions').insert({
    user_id: s.userId,
    token_hash: s.tokenHash,
    expires_at: s.expiresAt,
    ip: s.ip,
    user_agent: s.userAgent?.slice(0, 255) ?? null,
  });

export async function findActiveSession(db: Db, tokenHash: string, now: Date): Promise<SessionUser | null> {
  const row = await db('sessions as s')
    .join('users as u', 'u.id', 's.user_id')
    .where('s.token_hash', tokenHash)
    .whereNull('s.revoked_at')
    .where('s.expires_at', '>', now)
    .where('u.status', 'active')
    .first('s.id as sessionId', 'u.id as userId', 'u.public_id as publicId');
  return row ?? null;
}

export const revokeSessionByHash = (db: Db, tokenHash: string, now: Date): Promise<unknown> =>
  db('sessions').where({ token_hash: tokenHash }).whereNull('revoked_at').update({ revoked_at: now });

export function revokeUserSessions(db: Db, userId: number, now: Date, exceptSessionId?: number): Promise<unknown> {
  const q = db('sessions').where({ user_id: userId }).whereNull('revoked_at');
  if (exceptSessionId !== undefined) q.whereNot({ id: exceptSessionId });
  return q.update({ revoked_at: now });
}

export async function registerFailedLogin(db: Db, userId: number, max: number, lockUntil: Date): Promise<boolean> {
  await db('users').where({ id: userId }).increment('failed_login_count', 1);
  const user = await findUserById(db, userId);
  if (user && user.failed_login_count >= max) {
    await db('users').where({ id: userId }).update({ failed_login_count: 0, locked_until: lockUntil });
    return true;
  }
  return false;
}

export const resetLoginState = (db: Db, userId: number, now: Date): Promise<unknown> =>
  db('users').where({ id: userId }).update({ failed_login_count: 0, locked_until: null, last_login_at: now });

export const activateUser = (db: Db, userId: number, now: Date): Promise<unknown> =>
  db('users')
    .where({ id: userId, status: 'pending_verification' })
    .update({ status: 'active', email_verified_at: now, updated_at: now });

export const setStatus = (db: Db, userId: number, status: UserStatus, now: Date): Promise<unknown> =>
  db('users').where({ id: userId }).update({ status, updated_at: now });

export const setPassword = (db: Db, userId: number, passwordHash: string, now: Date): Promise<unknown> =>
  db('users').where({ id: userId }).update({ password_hash: passwordHash, failed_login_count: 0, locked_until: null, updated_at: now });

export const updateProfile = (
  db: Db,
  userId: number,
  patch: { full_name?: string | null; phone?: string | null },
  now: Date,
): Promise<unknown> => db('users').where({ id: userId }).update({ ...patch, updated_at: now });
