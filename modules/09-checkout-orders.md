# 09 — Checkout and Orders

## Goal
Idempotent checkout that splits a buyer order into per-seller sub-orders and drives them through a strict state machine.

## SRS requirements covered
FR-ORDER-01 … FR-ORDER-08, NFR-PERF-02.

## Dependencies
08 (and contracts with 06, 10, 12, 14)

## Steps
1. **Design** — `Order`, `SubOrder`, `OrderItem` (snapshot), `OrderStatusHistory`. Draw the state machine (Pending Payment → Confirmed → Packed → Ready to Ship → Shipped → Out for Delivery → Delivered → Completed; Cancelled, Failed Delivery, Returned, Refunded). Checkout sequence diagram. Events `order.placed`, `order.confirmed`, `order.status_changed`, `order.cancelled`, `order.completed`.
2. **Migrations** — orders (unique order_no, unique (buyer_id, idempotency_key)), sub_orders (sla_due_at), order_items, status_history (append-only); time partitioning plan.
3. **Domain** — totals calculation (items, seller/platform discounts, shipping, tax) using Money allocation; state machine class with guards per actor (buyer, seller, system, admin).
4. **Checkout quote** — `POST /v1/checkout/quote`: recompute everything server-side (prices, promotions, shipping, tax); return quote id valid 10 min.
5. **Place order** — `POST /v1/orders` with Idempotency-Key + quote id: in one transaction create order + sub-orders + reserve stock (06) + redeem vouchers (14) + outbox `order.placed`. COD → Confirmed; online → Pending Payment with payment intent (10).
6. **Lifecycle commands** — Cancel (buyer before Packed; seller with reason), MarkPacked, MarkReadyToShip (creates shipment via 12), consume shipping events, Complete after return window.
7. **SLA jobs** — auto-cancel sub-orders not Ready to Ship by `sla_due_at`; auto-cancel unpaid orders after timeout; penalties event to seller scorecard.
8. **Read models** — buyer order list, seller order list (CQRS, see 01 §6).
9. **API + UI** — checkout page (address, per-seller shipping, voucher, payment), order success, order list/detail with tracking timeline, invoice PDF.
10. **Hardening** — load test checkout, chaos test (payment gateway timeout during placement).

## Key tests
- Unit: every legal and illegal transition per actor; totals with mixed discounts (property tests: totals never negative, allocation sums exact).
- Integration: same Idempotency-Key twice → one order; order with 2 sellers → 2 sub-orders with correct split of platform voucher; failure mid-transaction leaves no reservation.
- Concurrency: two checkouts racing for last unit → one succeeds.
- E2E: journeys 1, 2 and 7 from SRS §9.5.

## Scalability notes
- Checkout is the most critical path: isolate its workers, give it its own DB pool, cache nothing price-related beyond seconds.
- At Scale, Order becomes its own service with orders sharded by buyer; flash-sale orders created asynchronously (01 §7).

## Definition of Done
- [ ] State machine 100% branch coverage; mutation ≥ 80%
- [ ] p95 place-order < 800 ms under load
- [ ] Order events consumed by inventory, payments, notifications, search in staging

## Prompt for Claude
```
Follow CLAUDE.md. Module 09-checkout-orders Step 1: design only. Include the state machine
as a transition table (from, to, actor, guard, side effects) and the checkout sequence diagram.
```
