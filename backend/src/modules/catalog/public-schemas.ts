import { z } from 'zod';

export const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc'] as const;
export type Sort = (typeof SORTS)[number];

export const publicQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(SORTS).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

/** Cursors are opaque to clients. Newest-first uses a keyset on id; other sorts carry an offset. */
export type Cursor = { k: 'id'; id: number } | { k: 'off'; n: number };

export const encodeCursor = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');

export function decodeCursor(raw: string): Cursor | null {
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (v.k === 'id' && Number.isSafeInteger(v.id) && (v.id as number) > 0) return { k: 'id', id: v.id as number };
    if (v.k === 'off' && Number.isSafeInteger(v.n) && (v.n as number) > 0) return { k: 'off', n: v.n as number };
  } catch {
    // fall through: anything unreadable is treated as a bad cursor
  }
  return null;
}
