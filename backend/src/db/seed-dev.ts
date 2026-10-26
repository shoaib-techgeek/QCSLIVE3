import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/identity/password.js';
import { assignRole, findUserByEmail, insertUser } from '../modules/identity/identity.repository.js';
import { createDb } from './knex.js';

// Synthetic, local-only account so the UI can be tried without the email-verification step.
const DEMO = { email: 'demo@example.com', password: 'Marketplace-Demo-2026', fullName: 'Demo Customer' };

const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('seed-dev must never run in production');

const db = createDb(env);
try {
  if (await findUserByEmail(db, DEMO.email)) {
    console.log(`${DEMO.email} already exists; nothing to do`);
  } else {
    await db.transaction(async (trx) => {
      const id = await insertUser(trx, {
        publicId: randomUUID(), email: DEMO.email, passwordHash: await hashPassword(DEMO.password), fullName: DEMO.fullName,
      });
      await trx('users').where({ id }).update({ status: 'active', email_verified_at: new Date() });
      await assignRole(trx, id, 'customer');
    });
    console.log(`Created ${DEMO.email} in ${env.DB_ACTIVE_NAME}`);
  }
} finally {
  await db.destroy();
}
