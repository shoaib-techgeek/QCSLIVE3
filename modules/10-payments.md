# 10 — Payments

## Goal
Collect payments through cards, wallets, bank transfer and COD with webhook-verified status, refunds and daily reconciliation, without card data touching our servers.

## SRS requirements covered
FR-PAY-01 … FR-PAY-07, NFR-COMP-01 (PCI SAQ-A), NFR-SEC-01 (ASVS L3).

## Dependencies
09

## Steps
1. **Design** — `PaymentIntent` (order, method, amount, status: Created → Pending → Succeeded | Failed | Expired; Succeeded → PartiallyRefunded | Refunded), `PaymentAttempt`, `Refund`, `WebhookEvent` (raw, signature status). `PaymentProvider` interface: `createIntent`, `verifyWebhook`, `refund`, `getStatus`. Events `payment.succeeded`, `payment.failed`, `refund.completed`.
2. **Migrations** — payment_intents (unique order + attempt), webhook_events (unique provider_event_id), refunds.
3. **Domain** — status transitions; refund ceilings (sum of refunds ≤ captured); COD eligibility rules (max order value, buyer risk).
4. **Provider adapters** — one per gateway (card gateway, JazzCash, Easypaisa, bank transfer) + `FakeProvider` for tests. Hosted page / SDK only (tokenised).
5. **Webhooks** — endpoint verifies signature, stores raw event, dedupes by provider event id, processes asynchronously; order is paid only on verified webhook or server-side status poll.
6. **Status poller** — for intents Pending > N minutes, query provider (handles missed webhooks).
7. **Refunds** — RefundPayment (full/partial, idempotent), wallet-refund option, retries with backoff.
8. **Reconciliation job** — daily import of provider settlement reports; match by reference; mismatches → finance queue + alert.
9. **API + UI** — payment method selection, redirect/SDK flow, result page that polls order status (never trusts redirect params).
10. **Hardening** — security review, webhook replay test, secrets rotation runbook.

## Key tests
- Unit: transitions; refund ceiling; COD rules.
- Integration (WireMock provider): duplicate webhook processed once; invalid signature rejected and logged; webhook arriving before redirect handled; missed webhook resolved by poller.
- Contract tests per provider adapter using recorded sandbox responses.
- E2E: card payment in sandbox → order Confirmed.

## Scalability notes
- Separate worker pool and DB pool for payments (bulkhead); circuit breaker per provider; fallback to other methods when a provider is down.

## Definition of Done
- [ ] No card data stored or logged (verified by log scan test)
- [ ] Reconciliation report in admin; mismatch alert works
- [ ] Coverage ≥ 95% line / 90% branch; mutation ≥ 80%

## Prompt for Claude
```
Follow CLAUDE.md. Module 10-payments Step <n>. Build PaymentProvider interface and FakeProvider first,
then webhook handling with signature verification and idempotency tests.
```
