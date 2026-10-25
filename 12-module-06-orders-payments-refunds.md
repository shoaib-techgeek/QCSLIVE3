# Module 06 — Orders, Payments, and Refunds

## Goal
Manage order and payment lifecycles safely, including retries, duplicate webhooks, timeouts, cancellations, and refunds.

## Step-by-step implementation
1. Define separate order and payment state machines; document allowed transitions.
2. Snapshot purchased product details, quantities, unit prices, discounts, tax, shipping, seller, and commission inputs.
3. Implement order creation as a transaction with idempotency.
4. Add payment-provider adapter for a sandbox environment first.
5. Implement provider checkout/authorization using hosted or tokenized provider flows; do not store raw card data.
6. Verify provider webhook signatures and store event IDs with unique constraints.
7. Process webhooks idempotently; handle duplicate and out-of-order events.
8. Never treat the browser success redirect as proof of payment.
9. Define timeout/unknown state behavior and reconciliation before retrying uncertain payment actions.
10. Implement cancellation rules based on order/payment/fulfilment state.
11. Implement refund eligibility, partial/full refunds, provider references, and refund status.
12. Ensure refunds cannot exceed the captured/refundable amount and duplicate refund attempts are blocked.
13. Emit post-commit events through an outbox or equivalent reliable mechanism.
14. Add payment/refund reconciliation jobs and exception queues.
15. Add operational tools for authorized staff to inspect stuck payment/order state.
16. Add end-to-end tests using provider sandbox or realistic adapter fakes.

## Acceptance criteria
- Order state and payment state are distinct and transition-validated.
- Duplicate webhook delivery cannot double-charge, double-refund, or double-post ledger.
- Uncertain payment outcomes are reconciled instead of blindly retried.
- Every payment/refund has provider reference, status history, and audit trail.
- Money totals reconcile from order snapshots to payment/refund records.
