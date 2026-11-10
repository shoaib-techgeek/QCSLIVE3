export const PRODUCT_STATUSES = ['draft', 'pending', 'active', 'inactive', 'rejected', 'banned', 'deleted'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductActor = 'seller' | 'admin';

interface Edge { actor: ProductActor; reasonRequired: boolean }
const edge = (actor: ProductActor, reasonRequired = false): Edge => ({ actor, reasonRequired });

// Every key is "from>to>actor". Banned and deleted have no outgoing edges.
const EDGES: Record<string, Edge> = {
  'draft>pending>seller': edge('seller'),
  'pending>active>admin': edge('admin'),
  'pending>rejected>admin': edge('admin', true),
  'rejected>pending>seller': edge('seller'),
  'active>inactive>seller': edge('seller'),
  'active>inactive>admin': edge('admin', true),
  'inactive>active>seller': edge('seller'),
  'pending>banned>admin': edge('admin', true),
  'active>banned>admin': edge('admin', true),
  'inactive>banned>admin': edge('admin', true),
  'draft>deleted>seller': edge('seller'),
  'rejected>deleted>seller': edge('seller'),
  'inactive>deleted>seller': edge('seller'),
};

export type ProductTransition = { ok: true } | { ok: false; code: 'invalid_transition' | 'reason_required'; reason: string };

export function transitionProduct(from: ProductStatus, to: ProductStatus, actor: ProductActor, reason?: string): ProductTransition {
  const e = EDGES[`${from}>${to}>${actor}`];
  if (!e) return { ok: false, code: 'invalid_transition', reason: `A ${actor} cannot move a product from ${from} to ${to}.` };
  if (e.reasonRequired && !reason?.trim()) return { ok: false, code: 'reason_required', reason: 'A reason is required for this change.' };
  return { ok: true };
}
