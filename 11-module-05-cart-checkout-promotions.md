# Module 05 — Cart, Checkout, and Promotions

## Goal
Create a trustworthy checkout that revalidates all commercial rules and cannot be manipulated by the client.

## Step-by-step implementation
1. Define guest and authenticated cart behavior, merge rules, and expiry.
2. Implement cart item operations using product variant/SKU IDs rather than trusting client-supplied price.
3. Recalculate prices server-side on every meaningful cart/checkout operation.
4. Define multi-seller checkout behavior: parent order plus seller sub-orders, or separate orders; record the decision.
5. Implement address selection and immutable checkout/order address snapshots.
6. Implement shipping quote calculation using destination, seller/warehouse, package rules, and carrier response where available.
7. Implement promotion engine with explicit rule types, start/end times, eligible products/sellers/customers, limits, stacking rules, and exclusions.
8. Protect coupon redemption limits against concurrent requests.
9. Implement tax/fees only after rules for the target market are confirmed.
10. Create a checkout summary with item subtotal, discount, shipping, tax, and grand total, all calculated server-side.
11. Implement checkout idempotency and safe handling of double clicks/retries.
12. Reserve inventory atomically as part of the checkout workflow.
13. Define payment-failure and reservation-release behavior.
14. Add abuse controls for coupon guessing, cart flooding, and checkout attempts.
15. Add tests for price tampering, expired promotions, coupon race conditions, shipping changes, and duplicate checkout.

## Acceptance criteria
- Client values cannot override prices, discounts, taxes, shipping, or totals.
- Every checkout has a traceable calculation breakdown.
- Duplicate requests do not create duplicate orders/reservations.
- Invalid or expired promotions are rejected consistently.
- Checkout fails safely when stock or price changes.
