export const KYC_STATUSES = [
  'not_submitted', 'submitted', 'under_review', 'approved', 'approved_with_conditions', 'rejected', 'more_info_required',
] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];
export type KycActor = 'seller' | 'admin';

interface Edge { actor: KycActor; noteRequired: boolean }

// Terminal states (approved*, rejected) have no outgoing edges; a rejected seller applies again as a new application.
const EDGES: Partial<Record<KycStatus, Partial<Record<KycStatus, Edge>>>> = {
  not_submitted: { submitted: { actor: 'seller', noteRequired: false } },
  submitted: { under_review: { actor: 'admin', noteRequired: false } },
  under_review: {
    approved: { actor: 'admin', noteRequired: false },
    approved_with_conditions: { actor: 'admin', noteRequired: true },
    rejected: { actor: 'admin', noteRequired: true },
    more_info_required: { actor: 'admin', noteRequired: true },
  },
  more_info_required: { submitted: { actor: 'seller', noteRequired: false } },
};

export type KycTransition = { ok: true } | { ok: false; code: 'invalid_transition' | 'note_required'; reason: string };

export function transitionKyc(from: KycStatus, to: KycStatus, actor: KycActor, note?: string): KycTransition {
  const edge = EDGES[from]?.[to];
  if (!edge) return { ok: false, code: 'invalid_transition', reason: `Cannot move KYC from ${from} to ${to}.` };
  if (edge.actor !== actor) return { ok: false, code: 'invalid_transition', reason: `Only ${edge.actor} can move KYC from ${from} to ${to}.` };
  if (edge.noteRequired && !note?.trim()) return { ok: false, code: 'note_required', reason: 'A note is required for this decision.' };
  return { ok: true };
}

/** Soft KYC policy: unapproved sellers can draft, but only approved ones can publish. */
export const canPublish = (status: KycStatus): boolean => status === 'approved' || status === 'approved_with_conditions';
