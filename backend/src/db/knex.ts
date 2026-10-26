import knex, { type Knex } from 'knex';
import type { Env } from '../config/env.js';

export function createDb(env: Env): Knex {
  return knex({
    client: 'mysql2',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_ACTIVE_NAME,
      timezone: 'Z', // store and read UTC
      decimalNumbers: false, // keep DECIMAL as strings; money must never become a float
    },
    pool: { min: 0, max: 10 },
    migrations: { directory: new URL('./migrations', import.meta.url).pathname, extension: 'ts', loadExtensions: ['.ts', '.js'] },
  });
}
