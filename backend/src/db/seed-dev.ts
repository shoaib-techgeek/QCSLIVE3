import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/identity/password.js';
import { assignRole, findUserByEmail, insertUser } from '../modules/identity/identity.repository.js';
import { createDb } from './knex.js';

// Synthetic, local-only account so the UI can be tried without the email-verification step.
const DEMOS = [
  { email: 'demo@example.com', password: 'Marketplace-Demo-2026', fullName: 'Demo Customer', role: 'customer' },
  { email: 'admin@example.com', password: 'Marketplace-Admin-2026', fullName: 'Demo Admin', role: 'admin' },
];

const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('seed-dev must never run in production');

const db = createDb(env);
try {
  for (const demo of DEMOS) {
    if (await findUserByEmail(db, demo.email)) {
      console.log(`${demo.email} already exists; nothing to do`);
      continue;
    }
    await db.transaction(async (trx) => {
      const id = await insertUser(trx, {
        publicId: randomUUID(), email: demo.email, passwordHash: await hashPassword(demo.password), fullName: demo.fullName,
      });
      await trx('users').where({ id }).update({ status: 'active', email_verified_at: new Date() });
      await assignRole(trx, id, demo.role);
    });
    console.log(`Created ${demo.email} in ${env.DB_ACTIVE_NAME}`);
  }
} finally {
  await db.destroy();
}
