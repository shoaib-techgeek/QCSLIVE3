import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../config/env.js';
import { hashPassword } from '../modules/identity/password.js';
import { assignRole, findUserByEmail, insertUser } from '../modules/identity/identity.repository.js';
import { deflateSync } from 'node:zlib';
import { LocalFileStorage } from '../shared/file-storage.js';
import { productSlug } from '../shared/slug.js';
import { createDb } from './knex.js';

// Synthetic, local-only account so the UI can be tried without the email-verification step.
const DEMOS = [
  { email: 'demo@example.com', password: 'Marketplace-Demo-2026', fullName: 'Demo Customer', role: 'customer' },
  { email: 'admin@example.com', password: 'Marketplace-Admin-2026', fullName: 'Demo Admin', role: 'admin' },
  { email: 'seller@example.com', password: 'Marketplace-Seller-2026', fullName: 'Demo Seller', role: 'seller' },
];

const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('seed-dev must never run in production');

async function seedUsers(): Promise<void> {
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
}

// ---------- demo catalogue (development only) ----------
const CRC = (() => { const t: number[] = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A plain coloured square, so the demo store has photos without bundling image files. */
function solidPng(r: number, g: number, b: number, size = 240): Buffer {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const DEMO_PRODUCTS: { title: string; category: string; description: string; price: number; was?: number; colour: [number, number, number]; sizes?: string[] }[] = [
  { title: 'Stainless steel water bottle, 750 ml', category: 'sports', description: 'Keeps drinks cold for 24 hours.', price: 129900, was: 179900, colour: [21, 184, 166] },
  { title: 'Cotton bedsheet set, double', category: 'home-kitchen', description: 'Soft, breathable cotton.', price: 249900, colour: [255, 194, 51] },
  { title: 'Wireless earbuds with charging case', category: 'electronics', description: 'Bluetooth 5.3, 20 hours of play.', price: 349900, was: 499900, colour: [34, 34, 34] },
  { title: 'Women\u2019s lawn suit, 3-piece', category: 'women', description: 'Printed lawn, unstitched.', price: 289900, colour: [255, 111, 89], sizes: ['Small', 'Medium', 'Large'] },
  { title: 'Phone stand, adjustable aluminium', category: 'phones', description: 'Folds flat, fits phones and tablets.', price: 49900, colour: [251, 119, 1] },
  { title: 'Men\u2019s running shoes, lightweight', category: 'bags-shoes', description: 'Breathable mesh upper.', price: 399900, was: 549900, colour: [182, 3, 12], sizes: ['41', '42', '43', '44'] },
  { title: 'Kids\u2019 building blocks, 120 pieces', category: 'kids-toys', description: 'Colourful blocks in a storage tub.', price: 119900, colour: [255, 194, 51] },
  { title: 'Yoga mat, non-slip, 6 mm', category: 'sports', description: 'Cushioned and easy to roll up.', price: 139900, colour: [11, 128, 0] },
];

async function seedCatalogue(): Promise<void> {
  const db = createDb(env);
  try {
    if (await db('sellers').where({ store_name: 'Demo Traders' }).first()) return console.log('Demo catalogue already exists; nothing to do');
    const user = await findUserByEmail(db, 'seller@example.com');
    if (!user) return;
    const storage = new LocalFileStorage(env.STORAGE_DIR);
    await db.transaction(async (trx) => {
      const [sellerId] = await trx('sellers').insert({
        public_id: randomUUID(), user_id: user.id, store_name: 'Demo Traders', slug: 'demo-traders', description: 'Demo store with sample products.', status: 'active', kyc_status: 'approved',
      });
      const categories = new Map((await trx('categories').select('id', 'slug')).map((c) => [c.slug as string, Number(c.id)]));
      for (const [i, d] of DEMO_PRODUCTS.entries()) {
        const publicId = randomUUID();
        const [productId] = await trx('products').insert({
          public_id: publicId, seller_id: sellerId, category_id: categories.get(d.category), title: d.title, slug: productSlug(d.title, `d${i}x`), description: d.description, status: 'active',
        });
        let valueIds: (number | undefined)[][] = [[]];
        if (d.sizes) {
          const [optionId] = await trx('product_options').insert({ product_id: productId, name: 'Size', position: 0 });
          valueIds = [];
          for (const [pos, v] of d.sizes.entries()) valueIds.push([(await trx('product_option_values').insert({ option_id: optionId, value: v, position: pos }))[0]]);
        }
        for (const [j, ids] of valueIds.entries()) {
          const [skuId] = await trx('skus').insert({
            public_id: randomUUID(), product_id: productId, seller_id: sellerId, seller_sku: `DEMO-${i + 1}-${j + 1}`, option_value_ids: JSON.stringify(ids),
            price_minor: d.price, compare_at_minor: d.was ?? null, currency: env.PLATFORM_CURRENCY,
          });
          await trx('inventory_items').insert({ sku_id: skuId, on_hand: 25 });
          await trx('stock_movements').insert({ sku_id: skuId, delta_on_hand: 25, reason: 'adjustment', actor_id: 'seed-dev', note: 'Demo stock' });
        }
        const png = solidPng(...d.colour);
        const key = `products/demo/${publicId}`;
        await storage.put(key, png);
        await trx('product_images').insert({ public_id: randomUUID(), product_id: productId, storage_key: key, mime: 'image/png', size_bytes: png.length, alt_text: d.title, position: 0 });
      }
    });
    console.log(`Created the demo store "Demo Traders" with ${DEMO_PRODUCTS.length} live products in ${env.DB_ACTIVE_NAME}`);
  } finally {
    await db.destroy();
  }
}

await seedUsers();
await seedCatalogue();
