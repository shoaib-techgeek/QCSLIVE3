import 'dotenv/config';
import { loadEnv } from '../config/env.js';
import { createDb } from './knex.js';

const command = process.argv[2];
const db = createDb(loadEnv());
try {
  if (command === 'latest') {
    const [batch, files] = await db.migrate.latest();
    console.log(`Batch ${batch}: ${files.length} migration(s) applied`);
  } else if (command === 'rollback') {
    const [batch, files] = await db.migrate.rollback();
    console.log(`Rolled back batch ${batch}: ${files.length} migration(s)`);
  } else {
    console.error('Usage: cli.ts <latest|rollback>');
    process.exitCode = 1;
  }
} finally {
  await db.destroy();
}
