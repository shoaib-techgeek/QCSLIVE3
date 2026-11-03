import { describe, expect, it } from 'vitest';
import { KYC_STATUSES, canPublish, transitionKyc, type KycActor, type KycStatus } from '../../src/modules/seller/kyc.js';

// Every allowed edge: from -> [to, actor, noteRequired]
const ALLOWED: [KycStatus, KycStatus, KycActor, boolean][] = [
  ['not_submitted', 'submitted', 'seller', false],
  ['submitted', 'under_review', 'admin', false],
  ['under_review', 'approved', 'admin', false],
  ['under_review', 'approved_with_conditions', 'admin', true],
  ['under_review', 'rejected', 'admin', true],
  ['under_review', 'more_info_required', 'admin', true],
  ['more_info_required', 'submitted', 'seller', false],
];

describe('KYC state machine', () => {
  it.each(ALLOWED)('allows %s -> %s by %s', (from, to, actor, noteRequired) => {
    expect(transitionKyc(from, to, actor, noteRequired ? 'because' : undefined)).toEqual({ ok: true });
  });

  it.each(ALLOWED.filter((a) => a[3]))('requires a note for %s -> %s', (from, to, actor) => {
    expect(transitionKyc(from, to, actor).ok).toBe(false);
    expect(transitionKyc(from, to, actor, '   ').ok).toBe(false);
  });

  it.each(ALLOWED)('rejects %s -> %s by the wrong actor', (from, to, actor) => {
    const wrong: KycActor = actor === 'admin' ? 'seller' : 'admin';
    expect(transitionKyc(from, to, wrong, 'because').ok).toBe(false);
  });

  it('rejects every transition that is not in the allowed table', () => {
    const allowed = new Set(ALLOWED.map(([f, t]) => `${f}>${t}`));
    for (const from of KYC_STATUSES) {
      for (const to of KYC_STATUSES) {
        if (allowed.has(`${from}>${to}`)) continue;
        for (const actor of ['seller', 'admin'] as const) {
          expect(transitionKyc(from, to, actor, 'note').ok, `${from}>${to} by ${actor}`).toBe(false);
        }
      }
    }
  });

  it('treats approved, approved_with_conditions and rejected as terminal', () => {
    for (const from of ['approved', 'approved_with_conditions', 'rejected'] as const) {
      for (const to of KYC_STATUSES) expect(transitionKyc(from, to, 'admin', 'n').ok).toBe(false);
    }
  });

  it('only approved sellers may publish', () => {
    expect(KYC_STATUSES.filter(canPublish)).toEqual(['approved', 'approved_with_conditions']);
  });
});
