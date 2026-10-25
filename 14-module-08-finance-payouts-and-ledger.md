# Module 08 — Finance, Commission, Seller Statements, and Payouts

## Goal
Provide auditable seller balances and accurate marketplace financial operations.

## Step-by-step implementation
1. Define commission policy: fixed/percentage, category/seller overrides, fees, discounts, taxes, and effective dates.
2. Define who funds each promotion/discount and how it affects seller proceeds.
3. Define ledger accounts and posting rules with finance/accounting review.
4. Use immutable double-entry ledger entries or another formally reviewed accounting model; never silently overwrite posted entries.
5. Record source references for each posting: order, payment, refund, adjustment, fee, payout.
6. Ensure posting is idempotent and protected by unique business references.
7. Define when seller earnings become pending, available, held, or paid.
8. Define reserves/holds for returns, disputes, fraud risk, and chargebacks where applicable.
9. Generate seller statements with line-level transaction detail.
10. Implement payout requests or scheduled payouts with permission checks, approval limits, and provider/bank adapter.
11. Store payout status and provider references; reconcile failed, pending, and completed payouts.
12. Build finance exception reports: ledger imbalance, payment mismatch, refund mismatch, seller negative balance, stuck payout.
13. Add access controls and audit for manual adjustments; require reason and approval for material changes.
14. Test order, cancellation, partial refund, full refund, commission changes, and payout failure scenarios.

## Acceptance criteria
- Every financial movement has a traceable source and audit trail.
- Duplicate processing cannot duplicate ledger postings.
- Seller statements reconcile with underlying orders/payments/refunds/payouts.
- Payouts cannot exceed eligible available balance.
- Finance exceptions are visible and actionable.
