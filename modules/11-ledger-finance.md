# 11 — Ledger, Commission and Seller Settlements

## Goal
A double-entry ledger as the single source of truth for every money movement, with commission, settlements, statements and payouts.

## SRS requirements covered
FR-PAY-07, FR-FIN-01 … FR-FIN-05, FR-ADMIN-04 (maker-checker).

## Dependencies
10

## Steps
1. **Design** — chart of accounts: buyer_payments_clearing, platform_revenue_commission, platform_fees, seller_payable:{sellerId}, refunds_payable, wallet:{userId}, tax_withholding, courier_cod_receivable:{courier}. `LedgerTransaction` + `LedgerEntry` (debit/credit, amount, account). ADR on posting rules.
2. **Migrations** — append-only entries; DB constraint/trigger ensuring each transaction balances to zero.
3. **Posting rules (domain)** — for `payment.succeeded`, `order.delivered`, `refund.completed`, `cod.remitted`, `payout.paid`: map each event to balanced entries. Pure functions, exhaustively tested.
4. **Commission engine** — rules by category, seller tier, campaign, with effective dates; versioned; changes require maker-checker approval.
5. **Settlement** — funds payable N days after Delivered (config, default 7); weekly settlement job creates `Settlement` per seller with line breakdown.
6. **Statements** — seller statement per order (price, seller vs platform discount, commission, fees, tax, net), CSV/PDF export.
7. **Payouts** — payout batch generation (bank file or API), approval flow, status tracking, failed payout retries.
8. **Tax** — configurable rules per region/category; withholding on payouts; tax invoices.
9. **UI** — seller finance page (balance, upcoming payout, statements); admin finance (commission rules, settlements, payout approvals, reconciliation).
10. **Hardening** — daily trial balance job (all accounts sum to zero) with alert; access limited to finance roles.

## Key tests
- Property tests: any random sequence of events keeps the ledger balanced; seller payable equals sum of their net order amounts minus payouts.
- Unit: commission rule selection precedence; settlement eligibility date.
- Integration: refund after settlement creates negative balance carried to next cycle.
- E2E: journey 3 and 4 from SRS §9.5 produce correct ledger balances.

## Definition of Done
- [ ] Trial balance job green in staging for 7 consecutive days
- [ ] Coverage ≥ 95%/90%; mutation ≥ 80%
- [ ] Maker-checker enforced on commission changes and payouts

## Prompt for Claude
```
Follow CLAUDE.md. Module 11-ledger-finance Step <n>. Implement posting rules as pure functions
with property-based tests proving every transaction balances.
```
