# 01 — Roadmap and Module Sequence

## Delivery rule

Deliver vertical slices that include database, backend, UI, authorization, tests, telemetry, and documentation. Avoid building every database table first and leaving integration until later.

## Ordered roadmap

| Phase | Modules | Dependencies | Exit criteria |
|---|---|---|---|
| 0. Discovery | Scope, policies, stack, ADRs | None | Decisions recorded; MVP scope approved |
| 1. Engineering foundation | Repo, CI, environments, auth, roles | Phase 0 | Reproducible build; CI gates pass |
| 2. Seller and admin foundation | Seller application, approval, admin permissions | Phase 1 | Seller isolation tests pass |
| 3. Catalogue | Categories, products, variants, media, moderation | Phase 2 | Approved products visible; invalid listings blocked |
| 4. Search and browse | Search, filters, sort, pagination, SEO | Phase 3 | Search relevance and pagination tests pass |
| 5. Inventory and pricing | Stock ledger/reservations, price rules | Phase 3 | Concurrent stock tests pass |
| 6. Cart and checkout | Address, cart, shipping quote, promotions | Phases 4–5 | Checkout validation and pricing consistency pass |
| 7. Orders and payments | Order state machine, provider integration, refunds | Phase 6 | Duplicate callback and failure recovery tests pass |
| 8. Fulfilment and returns | Shipments, delivery, cancellations, returns | Phase 7 | End-to-end lifecycle works |
| 9. Finance | Commission, ledger, seller statements, payouts | Phases 7–8 | Ledger reconciles with orders/payments |
| 10. Engagement/support | Notifications, reviews, support tickets | Phases 7–8 | Delivery retries and review eligibility pass |
| 11. Analytics | Operational reports, event definitions | All relevant modules | Metrics definitions are documented |
| 12. Launch hardening | Load/security/restore/incident tests | All MVP modules | Release checklist approved |

## Work item template

Every module implementation should follow this exact sequence:

1. Read the relevant SRS sections and this module file.
2. Inspect existing code, conventions, dependencies, and tests.
3. Identify open business rules. Ask the owner if they affect money, permissions, privacy, fulfilment, or legal compliance.
4. Write a short implementation plan and list affected files.
5. Define data model and migration strategy.
6. Define API contracts, validation, permissions, and error responses.
7. Implement domain logic with clear boundaries.
8. Implement UI and loading/empty/error states where applicable.
9. Add unit tests for rules and edge cases.
10. Add integration tests for DB, permissions, queues, and external adapters.
11. Add contract or E2E tests for cross-module flows.
12. Add logs, metrics, audit events, and runbook notes.
13. Run formatter, linter, static analysis, unit/integration tests, and relevant E2E tests.
14. Review security, query performance, transaction boundaries, and accessibility.
15. Update docs, traceability CSV, changelog, and ADRs if needed.
16. Provide a completion report and wait for approval before moving to the next module.

## Dependency policy

- Modules may call domain services/interfaces, but avoid circular dependencies.
- A module must not directly update another module's tables unless an explicitly documented transaction boundary requires it.
- Cross-module workflows should use application services initially; introduce durable events/queues when asynchronous processing is valuable.
- Keep provider-specific code behind adapters.
- Use feature flags for risky rollout or behavior changes when appropriate.

## Suggested milestones

- **M0:** Repository and architecture approved
- **M1:** Customer and seller can authenticate safely
- **M2:** Seller can submit and publish a moderated product
- **M3:** Customer can find a product and add it to cart
- **M4:** Customer can place and pay for an order safely
- **M5:** Seller can fulfil; customer can track, cancel/return when eligible
- **M6:** Commission, reconciliation, and payout process verified
- **M7:** Security, performance, restore, and launch sign-off complete
