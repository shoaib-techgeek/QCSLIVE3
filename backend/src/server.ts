import 'dotenv/config';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/knex.js';
import { EventBus, startRelay } from './shared/outbox-relay.js';
import { SystemClock } from './shared/clock.js';

const env = loadEnv();
const db = createDb(env);
const app = await buildApp({ env, db });

// Modules register subscribers on this bus when they need events.
const eventBus = new EventBus();
const stopRelay = startRelay(db, new SystemClock(), eventBus, 2000, (err) => app.log.error({ err }, 'outbox relay failed'));

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopRelay();
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
