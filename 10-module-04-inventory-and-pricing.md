# Module 04 — Inventory and Pricing

## Goal
Keep available stock and displayed prices accurate under concurrent customer activity.

## Step-by-step implementation
1. Decide whether stock is tracked per seller SKU, warehouse/location, or both.
2. Define on-hand, reserved, available, damaged, returned, and safety-stock semantics as needed.
3. Implement inventory movement history; avoid unexplained direct stock edits.
4. Implement authorized stock adjustments with reason codes and audit.
5. Implement atomic reservation with expiry for checkout; choose row locking, optimistic concurrency, or another proven strategy.
6. Ensure available stock cannot become negative under concurrent requests.
7. Define reservation expiry and release behavior for abandoned/failed checkouts.
8. Define when stock is decremented permanently: reservation, payment, fulfilment, or an explicit combination.
9. Implement base price, sale price, currency, effective dates, and price validation.
10. Define how cart/checkout handles a price change after item was added.
11. Add promotion and price interactions only through a central pricing calculation service.
12. Add reconciliation for stock discrepancies and an operator adjustment workflow.
13. Add concurrency tests with two or more buyers competing for limited stock.

## Acceptance criteria
- Stock updates are atomic and auditable.
- Reservation expiration releases stock safely and idempotently.
- Checkout always revalidates price and availability.
- Financial calculations use fixed-point arithmetic and explicit rounding.
- Concurrent tests prove stock does not go negative.
