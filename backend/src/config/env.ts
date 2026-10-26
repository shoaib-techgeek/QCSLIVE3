import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1),
  DB_TEST_NAME: z.string().min(1).default('marketplace_test'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  MAIL_DRIVER: z.enum(['log', 'memory']).default('log'),
  // When false, new accounts are active immediately (no email step). Safe default is true.
  REQUIRE_EMAIL_VERIFICATION: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
});

export type Env = z.infer<typeof schema> & { DB_ACTIVE_NAME: string };

/** Validates configuration once at boot; fails fast without echoing secret values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.DB_PASSWORD === '') {
    throw new Error('Invalid environment configuration: DB_PASSWORD must be set in production');
  }
  if (env.NODE_ENV === 'production' && env.MAIL_DRIVER === 'log') {
    // The log driver writes verification/reset links to logs; never acceptable in production.
    throw new Error('Invalid environment configuration: MAIL_DRIVER must be a real provider in production');
  }
  // Tests must never touch the development database.
  const DB_ACTIVE_NAME = env.NODE_ENV === 'test' ? env.DB_TEST_NAME : env.DB_NAME;
  return { ...env, DB_ACTIVE_NAME };
}
