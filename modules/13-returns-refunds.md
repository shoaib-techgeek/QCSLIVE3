# 13 — Returns and Refunds

## Goal
Policy-driven item-level returns with pickup, inspection, refund and dispute escalation.

## SRS requirements covered
FR-RET-01 … FR-RET-04, FR-CS-03 (disputes).

## Dependencies
10, 11, 12

## Steps
1. **Design** — `ReturnPolicy` (window days by category, non-returnable categories, reasons), `ReturnRequest` (items, reason, photos, status: Requested → Approved | Rejected → PickupScheduled → Received → Inspected → Refunded | ReturnRejected; Disputed). Events `return.requested`, `return.approved`, `return.received`, `refund.requested`.
2. **Domain** — eligibility (within window, item delivered, category returnable, qty ≤ purchased − already returned); auto-approve rules (e.g. wrong item, seller unresponsive 48 h).
3. **Application** — RequestReturn, SellerDecide, SchedulePickup (reverse shipment via 12), MarkReceived, Inspect, IssueRefund (via 10; ledger via 11), OpenDispute, ResolveDispute (CS).
4. **Refund amount** — item price minus item-level discounts proportionally allocated; shipping refund rules.
5. **Abuse detection (Growth)** — buyer return rate threshold → manual review.
6. **UI** — buyer return wizard with photo upload; seller return queue; CS dispute console.
7. **SLA jobs** — seller response deadline; refund SLA tracking and alerts.

## Key tests
- Unit: eligibility matrix (table-driven); refund allocation with vouchers across items.
- Integration: refund after settlement creates seller debit; partial return of 1 of 3 items.
- E2E: journey 4 from SRS §9.5.

## Definition of Done
- [ ] Refund amounts reconcile with ledger in all tested scenarios
- [ ] Dispute flow usable by CS role

## Prompt for Claude
```
Follow CLAUDE.md. Module 13-returns-refunds Step <n>. Start with eligibility and refund
allocation as pure domain logic with table-driven tests.
```
