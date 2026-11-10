import { slugify } from '../../shared/slug.js';

const RESERVED = new Set(['admin', 'api', 'seller', 'sellers', 'store', 'stores', 'support', 'qcs', 'qcs-store', 'www', 'help']);

export const slugifyStoreName = (name: string): string => slugify(name, 60);

export function validateStoreName(name: string): { ok: true; slug: string } | { ok: false; message: string } {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return { ok: false, message: 'Store name must be 3 to 60 characters.' };
  const slug = slugifyStoreName(trimmed);
  if (slug.length < 3) return { ok: false, message: 'Store name must contain at least 3 letters or numbers.' };
  if (RESERVED.has(slug)) return { ok: false, message: 'This store name is not available.' };
  return { ok: true, slug };
}
