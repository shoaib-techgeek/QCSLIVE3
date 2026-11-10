import { describe, expect, it } from 'vitest';
import { PRODUCT_STATUSES, transitionProduct, type ProductActor, type ProductStatus } from '../../src/modules/catalog/product-status.js';

// [from, to, actor, reasonRequired]
const ALLOWED: [ProductStatus, ProductStatus, ProductActor, boolean][] = [
  ['draft', 'pending', 'seller', false],
  ['pending', 'active', 'admin', false],
  ['pending', 'rejected', 'admin', true],
  ['rejected', 'pending', 'seller', false],
  ['active', 'inactive', 'seller', false],
  ['active', 'inactive', 'admin', true],
  ['inactive', 'active', 'seller', false],
  ['pending', 'banned', 'admin', true],
  ['active', 'banned', 'admin', true],
  ['inactive', 'banned', 'admin', true],
  ['draft', 'deleted', 'seller', false],
  ['rejected', 'deleted', 'seller', false],
  ['inactive', 'deleted', 'seller', false],
];

describe('product state machine', () => {
  it.each(ALLOWED)('allows %s -> %s by %s', (from, to, actor, reasonRequired) => {
    expect(transitionProduct(from, to, actor, reasonRequired ? 'because' : undefined)).toEqual({ ok: true });
  });

  it.each(ALLOWED.filter((a) => a[3]))('requires a reason for %s -> %s by %s', (from, to, actor) => {
    const r = transitionProduct(from, to, actor);
    expect(r).toMatchObject({ ok: false, code: 'reason_required' });
    expect(transitionProduct(from, to, actor, '  ').ok).toBe(false);
  });

  it('rejects every transition outside the table, for either actor', () => {
    const allowed = new Set(ALLOWED.map(([f, t, a]) => `${f}>${t}>${a}`));
    for (const from of PRODUCT_STATUSES) {
      for (const to of PRODUCT_STATUSES) {
        for (const actor of ['seller', 'admin'] as const) {
          if (allowed.has(`${from}>${to}>${actor}`)) continue;
          expect(transitionProduct(from, to, actor, 'reason').ok, `${from}>${to} by ${actor}`).toBe(false);
        }
      }
    }
  });

  it('a seller can never approve, reject or ban their own product', () => {
    expect(transitionProduct('pending', 'active', 'seller').ok).toBe(false);
    expect(transitionProduct('pending', 'rejected', 'seller', 'x').ok).toBe(false);
    expect(transitionProduct('active', 'banned', 'seller', 'x').ok).toBe(false);
  });

  it('banned and deleted are terminal', () => {
    for (const from of ['banned', 'deleted'] as const) {
      for (const to of PRODUCT_STATUSES) expect(transitionProduct(from, to, 'admin', 'x').ok).toBe(false);
    }
  });
});
