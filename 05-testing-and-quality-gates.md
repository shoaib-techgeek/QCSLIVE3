# 05 — Testing and Quality Gates

## 1. Test pyramid

### Unit tests
Test pure domain rules and small services without real network or database:
- price/discount/commission calculations
- order/payment/return state transitions
- permissions and policy decisions
- promotion eligibility and limits
- shipping fee calculations
- money rounding and currency validation
- input normalization and validation rules

### Integration tests
Test real integration boundaries:
- repositories and database constraints
- transactions and concurrent stock reservation
- authorization scoping
- queue/outbox persistence and consumer deduplication
- payment/shipping/email adapters using provider sandbox or test doubles
- cache invalidation
- file upload/storage behavior

### Contract tests
Verify API request/response schemas, event schemas, provider adapter assumptions, and backward compatibility.

### End-to-end tests
Automate the highest-value user journeys:
1. Customer registers/logs in.
2. Seller applies; admin approves.
3. Seller creates product; moderator approves.
4. Customer searches and adds product to cart.
5. Checkout validates price, shipping, promotion, and stock.
6. Payment succeeds; order confirmation appears.
7. Seller fulfils; tracking updates.
8. Customer receives order and submits eligible review.
9. Customer cancels/returns within policy; refund is reconciled.
10. Finance generates seller statement and payout record.

### Non-functional tests
- Load/stress/soak tests
- Security tests and dependency scanning
- Accessibility checks and manual keyboard testing
- Backup restoration and disaster-recovery drills
- Migration tests on realistic data
- Browser/device compatibility checks

## 2. Required negative tests

- Customer cannot access another customer's order.
- Seller cannot access another seller's products, orders, inventory, reports, or documents.
- Unapproved seller cannot publish products.
- Unapproved/rejected products are not publicly searchable.
- Price changed between cart and checkout is handled explicitly.
- Two buyers compete for the last unit; stock never goes negative.
- Duplicate checkout request creates no duplicate order.
- Duplicate/out-of-order payment webhook does not double-charge or double-post ledger.
- Payment timeout triggers a safe pending/reconciliation path.
- Refund exceeds neither captured/refundable amount nor policy allowance.
- Coupon cannot be redeemed beyond limits under concurrency.
- Review cannot be created without eligible purchase.
- Admin actions are authorized and audited.
- Oversized or spoofed uploads are rejected.
- Sensitive information is absent from logs and error responses.

## 3. CI quality gates

Required for every pull request:
- formatting check
- lint
- static analysis/type checks where available
- unit tests
- integration tests
- migration validation
- dependency vulnerability scan
- secret scan
- build
- API schema/contract validation
- minimum agreed coverage for critical domain modules
- no new critical/high vulnerabilities without documented exception and owner

Do not set one arbitrary coverage number as a substitute for meaningful tests. Agree coverage thresholds with the team and require high coverage for money, permissions, stock, and state machines.

## 4. Test data and environments

- Use synthetic fixtures and factories.
- Avoid production PII in tests.
- Reset integration test state deterministically.
- Keep provider sandbox credentials separate from production.
- Make tests repeatable and independent of execution order.
- Mark slow/flaky tests and fix the root cause; do not routinely skip them.
- Seed reference data through versioned scripts/migrations.

## 5. Bug-fix workflow

1. Reproduce the bug.
2. Add a failing regression test.
3. Fix the root cause.
4. Run the focused test, related module tests, and full required CI.
5. Explain the cause and risk of regression.
6. Update documentation if behavior or operations changed.
