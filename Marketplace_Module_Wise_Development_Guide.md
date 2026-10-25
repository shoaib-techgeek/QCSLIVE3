# Marketplace Module-Wise Development Guide

This combined guide is generated from the separate Markdown files in the development pack. For implementation, prefer the separate files so Claude Code can read one module at a time.



---

<!-- Source file: 00-project-charter-and-working-agreement.md -->

# 00 — Project Charter and Working Agreement

## 1. Product vision

Build a multi-vendor e-commerce marketplace where customers can discover products, compare sellers, place orders, pay, track delivery, return eligible items, and review purchases. Sellers manage their stores, catalogue, inventory, fulfilment, and earnings. Marketplace operators moderate listings, support users, manage commissions, resolve disputes, and monitor business operations.

The product may eventually support high catalogue volume, promotional campaigns, multiple fulfilment models, recommendations, and multiple regions. These are growth goals, not reasons to over-engineer the first release.

## 2. Initial personas

- Guest visitor
- Registered customer
- Seller applicant
- Approved seller / seller staff
- Customer support agent
- Catalogue moderator
- Finance operator
- Operations / fulfilment operator
- Marketplace administrator
- System integration / background worker

## 3. Release principles

1. Security and data integrity before convenience.
2. A seller must never access another seller's private data.
3. Money, inventory, order state, and permissions must be enforced on the server.
4. Critical operations must be idempotent or safely reject duplicates.
5. External services can fail, time out, or send duplicate callbacks.
6. Every important state transition should be auditable.
7. Prefer a modular monolith until real evidence justifies service extraction.
8. Build observability and automated tests as part of each module, not after it.
9. Do not invent business rules. Record unresolved decisions and ask the product owner.
10. Never use production customer/payment data in development or test environments.

## 4. MVP boundary

### Required for first usable release
- Customer registration/login and profile
- Seller application, approval, and seller permissions
- Categories, products, variants, images, and moderation
- Inventory and stock reservation
- Product listing/search/filter/sort
- Cart, address, shipping option, checkout
- One payment method plus a documented cash-on-delivery option if commercially required
- Order lifecycle and customer/seller order views
- Shipment status tracking (manual or carrier integration)
- Cancellation and a basic return/refund workflow
- Reviews restricted to eligible purchases
- Admin console, audit log, customer support contact path
- Commission calculation and seller balance/payout process
- Transactional notifications for key order events
- CI, automated tests, backup/restore procedure, monitoring

### Later releases, unless business needs require them earlier
- Personalized recommendations and ranking ML
- Flash-sale infrastructure and dynamic pricing
- Advanced loyalty/wallet, referral programs, subscriptions
- Multi-region active-active deployment
- Sophisticated fraud/risk scoring
- Full event data platform and real-time BI
- Splitting modules into independently deployed microservices

## 5. Decisions required before implementation

Record each decision in an ADR:
- Backend framework and language
- Frontend framework
- Primary database
- Payment provider(s) and supported currencies
- Shipping/carrier integrations and shipping fee rules
- Tax and invoicing obligations by market
- COD availability and cash reconciliation process
- Seller verification/KYC requirements
- Commission rules, refund rules, settlement schedule, payout method
- Single country/currency at launch or multi-region from day one
- Hosting provider, data residency, backup retention
- Email/SMS/WhatsApp notification providers
- Product moderation policy and prohibited products
- Return eligibility windows and dispute policy

## 6. Working agreement for Claude Code

- First inspect the existing repository and summarize its structure before changing files.
- Do not rewrite or replace existing application architecture without approval.
- Work in small, reviewable increments; one module or vertical slice per task.
- Before coding, state assumptions, dependencies, planned files, migrations, tests, and risks.
- Ask questions when a business rule is unresolved; otherwise choose a conservative default and document it.
- Do not silently change API contracts, schema semantics, dependencies, or build tooling.
- Use parameterized queries/ORM protections; never concatenate untrusted input into SQL.
- Do not hard-code credentials, secrets, environment-specific URLs, or provider keys.
- Do not claim tests pass unless you ran them and can report the command and result.
- Never disable or weaken tests just to get a green build.
- Keep a `CHANGELOG` or release notes for user-visible behavior changes.
- Add/update tests for every bug fix.
- Do not implement real payments against live credentials during development.
- At the end of each task, report: changes, migration steps, tests run, known limitations, manual QA, and next task.

## 7. Repository baseline

Recommended top-level structure (adapt to the chosen framework):

```text
/apps
  /storefront
  /seller-portal
  /admin-portal
  /api                 # if separate app; otherwise backend root
/packages              # shared UI/types/client libraries if appropriate
/docs
  /adr
  /runbooks
  /api
  /architecture
/tests
/infra
/scripts
```

For a single-backend repository, keep domain modules grouped by business capability, not by generic file type alone.

## 8. Product success measures

Define real targets before launch; do not invent targets after the fact:
- Product discovery to add-to-cart conversion
- Checkout completion rate
- Payment success rate
- Order cancellation and return rates
- On-time delivery rate
- Seller activation and fulfilment performance
- Search zero-result rate and search-to-purchase conversion
- Support first-response and resolution time
- Platform error rate and latency
- Fraud, chargeback, and refund rates


---

<!-- Source file: 01-roadmap-and-module-sequence.md -->

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


---

<!-- Source file: 02-architecture-and-engineering-standards.md -->

# 02 — Architecture and Engineering Standards

## 1. Recommended starting architecture

Use a **modular monolith** with explicit domain modules and well-defined interfaces. This lowers operational complexity while keeping a path to extract services later.

Core components:
- Responsive customer storefront
- Seller portal
- Admin/operations portal
- Backend application/API
- Relational primary database
- Background job queue and workers
- Object storage for product and user-uploaded media
- CDN for static/media delivery
- Cache for measured hot reads, sessions, or rate-limit counters
- Payment, shipping, email/SMS providers behind adapters
- Search engine when database search no longer meets relevance/scale needs
- Centralized logs, metrics, traces, alerts, and audit trail

## 2. Suggested domain boundaries

- Identity & Access
- Customer Profile
- Seller Management
- Catalogue & Media
- Search & Discovery
- Pricing & Promotions
- Inventory
- Cart & Checkout
- Orders
- Payments & Refunds
- Shipping & Fulfilment
- Returns & Disputes
- Reviews & Ratings
- Finance, Commission & Payouts
- Notifications
- Support
- Admin & Moderation
- Analytics & Reporting

Each module owns its domain logic and exposes application interfaces. The primary database may be shared initially, but tables and write ownership must be explicit.

## 3. Architecture diagrams to create before major implementation

Create and maintain:
- C4 context diagram
- C4 container diagram
- Module/component diagram
- Key sequence diagrams: checkout, payment webhook, cancellation/refund, return, seller payout
- Deployment diagram
- Data-flow diagram for personal data and payment data
- Threat model
- ERD with ownership and cardinality

Use Mermaid in Markdown where practical. Keep diagrams version-controlled and update them when architecture changes.

## 4. Code quality rules

- Follow framework idioms and official style guides.
- Use formatting and linting in CI.
- Use static analysis/type checking where supported.
- Separate controllers/handlers, application use cases, domain rules, and persistence adapters.
- Validate all untrusted input at the API boundary and enforce invariants in domain logic/database constraints.
- Use explicit DTOs/request schemas; do not expose persistence models blindly.
- Keep functions focused and names business-oriented.
- Avoid global mutable state and hidden side effects.
- Use dependency injection or clear adapter boundaries for external systems.
- No secrets in source control; use environment configuration and a secret manager.
- Pin dependencies and automate security/dependency updates with review.
- Add comments for why a non-obvious decision exists, not to narrate obvious code.

## 5. Database and consistency

- Use foreign keys, unique constraints, check constraints, and appropriate indexes.
- Use transactions for order creation, inventory reservation, payment state updates, and financial ledger entries.
- Define isolation/locking behavior for concurrent stock reservation and coupon usage.
- Use decimal/fixed-point types for money; never floating-point arithmetic for financial calculations.
- Store money with currency code; define rounding rules.
- Use UTC timestamps in storage; convert for display using explicit user/market timezone.
- Use immutable or append-only ledger entries for financial movements.
- Use migrations as the only supported schema change path.
- Avoid destructive migrations without a staged expand/migrate/contract plan.
- Use optimistic concurrency/version columns or row locks where appropriate.
- Define data retention, deletion/anonymization, and archival policies.

## 6. Scalability without premature complexity

Start with a single deployable backend and separate worker processes. Scale horizontally behind a load balancer when the application is stateless and sessions are externalized.

Scale in this order:
1. Measure and remove inefficient queries and N+1 access.
2. Add missing indexes and query plans.
3. Add CDN/object storage for media.
4. Add caching for proven hot paths with clear invalidation rules.
5. Move slow/retryable work to background jobs.
6. Add dedicated search infrastructure when needed.
7. Partition large tables or introduce read replicas only with measured justification.
8. Extract a module into a service only when independent scaling, deployment, ownership, or reliability needs justify the added distributed-systems cost.

Set explicit targets for p95/p99 latency, error rates, order throughput, catalogue size, and concurrent users before performance testing. Targets are product decisions, not values to guess.

## 7. Reliability patterns

- Idempotency keys for checkout/order creation and payment/refund requests.
- Webhook signature verification and duplicate-event handling.
- Transactional outbox for reliable publishing of events after database commits.
- Inbox/deduplication table for consumers where duplicate processing would be harmful.
- Retries with exponential backoff and jitter; cap attempts.
- Dead-letter queue and a documented replay process.
- Timeouts and bounded concurrency for external calls.
- Circuit breakers where the platform/library supports them and the failure mode warrants it.
- Reconciliation jobs for payments, refunds, payouts, inventory, and shipment state.
- Explicit state machines for orders, payments, returns, and payouts.
- Never assume that a network timeout means an external operation failed; query/reconcile before retrying non-idempotent actions.

## 8. Security and privacy baseline

- Least privilege and deny-by-default authorization.
- Object-level authorization on every resource access.
- Seller tenant isolation in all list, read, update, export, and background-job paths.
- Secure password hashing through a maintained framework/library.
- MFA for privileged staff and optionally sellers.
- Rate limiting and abuse controls for login, OTP, search, checkout, coupons, reviews, and APIs.
- CSRF protection where cookie-based sessions are used; secure, HttpOnly, SameSite cookies.
- Contextual output encoding and framework-safe rendering to reduce XSS risk.
- SQL parameterization/ORM protections.
- Upload validation: content type, file signature, size, dimensions, safe filenames; scan where appropriate.
- Encrypt traffic; encrypt sensitive data at rest where supported; restrict access to keys.
- Redact tokens, passwords, payment data, and personal data from logs.
- Maintain audit trails for admin actions, seller changes, refunds, and payouts.
- Follow applicable privacy, consumer, tax, and payment rules in the launch market. Obtain legal review.
- Never store raw card PAN/CVV. Use a compliant payment provider's hosted/tokenized flow.

## 9. Accessibility, SEO, and UX

- Target WCAG 2.2 AA for key customer journeys where feasible.
- Keyboard access, visible focus, semantic controls, labels, contrast, error summaries.
- Responsive layouts and useful loading/empty/error states.
- Server-render or pre-render public product/category pages when SEO requires it.
- Canonical URLs, structured metadata, sitemap, robots rules, pagination strategy, and duplicate-content controls.
- Do not index private, cart, checkout, seller dashboard, or admin pages.


---

<!-- Source file: 03-domain-model-and-data-design.md -->

# 03 — Domain Model and Data Design

## 1. Data design process

Before implementing each module:
1. List business entities and their lifecycle.
2. Identify which module owns each entity and its writes.
3. Draw an ERD and mark cardinalities.
4. Define primary keys, foreign keys, uniqueness, checks, indexes, and deletion behavior.
5. Define sensitive fields, retention, access rules, and audit needs.
6. Define transaction boundaries and concurrency behavior.
7. Create migrations and test both fresh installation and upgrade from the previous schema.
8. Seed only synthetic test data.
9. Capture query plans for high-volume queries as data grows.

## 2. Core entity inventory

### Identity
- `users`
- `user_credentials` or framework-managed auth data
- `roles`, `permissions`, `role_permissions`, `user_roles`
- `user_sessions` / refresh-token records if applicable
- `addresses`
- `consents` / notification preferences

### Seller
- `sellers`
- `seller_members`
- `seller_verification_documents` (restricted access)
- `seller_store_profiles`
- `seller_status_history`
- `seller_policies`

### Catalogue
- `categories`
- `category_closure` or a supported tree representation if needed
- `brands`
- `products`
- `product_variants` / SKUs
- `product_attributes`
- `product_attribute_values`
- `product_media`
- `product_category_assignments`
- `product_moderation_events`
- `product_status_history`

### Pricing and inventory
- `price_lists` or price records
- `inventory_items` / stock by SKU and location
- `inventory_movements`
- `inventory_reservations`
- `stock_locations`
- `promotion_campaigns`
- `coupons`
- `coupon_redemptions`
- `promotion_rules`

### Commerce
- `carts`
- `cart_items`
- `checkout_sessions`
- `shipping_quotes`
- `orders`
- `order_items`
- `order_addresses_snapshot`
- `order_status_history`
- `payments`
- `payment_attempts`
- `payment_webhook_events`
- `refunds`
- `shipments`
- `shipment_items`
- `shipment_tracking_events`
- `returns`
- `return_items`
- `disputes`
- `reviews`

### Finance
- `commission_rules`
- `commission_calculations`
- `ledger_accounts`
- `ledger_entries`
- `seller_statements`
- `payouts`
- `payout_items`
- `financial_reconciliation_runs`

### Operations
- `notifications`
- `notification_attempts`
- `support_tickets`
- `support_messages`
- `audit_events`
- `outbox_events`
- `inbox_deduplication`
- `feature_flags`
- `idempotency_records`

This list is a starting inventory, not a mandate to create every table at once. Implement only the entities required for the current module.

## 3. Data rules that must be explicit

- Money: use fixed-point decimal or integer minor units consistently; store ISO currency code. Define rounding and conversion rules.
- Product snapshots: order items must preserve SKU/title/variant/price/tax/discount/commission details as purchased, even if the catalogue later changes.
- Address snapshots: preserve the shipping/billing address used for the order, subject to privacy policy.
- Inventory: distinguish on-hand, reserved, available, damaged, and returned stock if operationally relevant.
- State: use explicit enums or reference tables and controlled transitions; do not allow arbitrary status strings.
- Soft delete: use only where it supports a clear business/legal requirement; define uniqueness and retention implications.
- Audit: record actor, action, target, timestamp, correlation/request ID, and a safe before/after summary where appropriate.
- IDs: use stable non-sequential public identifiers if exposing sequential IDs creates a privacy or enumeration risk. Internal IDs may differ.
- Timestamps: UTC storage and explicit timezone at presentation.
- Multi-seller order: decide whether one customer checkout creates a parent order with seller sub-orders or separate orders; document shipment, refund, commission, and payout consequences.

## 4. Indexing principles

Create indexes from actual query patterns and query plans, not guesswork alone. Typical candidates:
- Unique SKU within the agreed scope
- Product status + category + sort key
- Product seller + status
- Inventory SKU + location
- Cart user + active status
- Orders customer + created timestamp
- Orders seller + status + created timestamp
- Payment provider reference unique where guaranteed
- Webhook provider event ID unique
- Ledger account + posted timestamp
- Payout seller + status
- Audit entity + timestamp

Review index write overhead and avoid redundant indexes.

## 5. Transaction boundaries to design carefully

### Checkout/order creation
- Revalidate product status, price, promotion eligibility, address, shipping quote, and stock.
- Reserve stock atomically or use an equivalent concurrency-safe method.
- Create order/order items and persist a checkout idempotency result.
- Ensure retries do not create duplicate orders or duplicate reservations.
- Define what happens if payment authorization fails or times out.

### Payment webhook
- Verify provider signature and timestamp/replay protections.
- Record the provider event with a unique event ID.
- Process idempotently.
- Update payment/order state using a valid transition.
- Publish follow-up work via transactional outbox.
- Return the provider's expected response quickly; perform slow work asynchronously if required.

### Refund and seller finance
- Enforce refundable amount and policy eligibility.
- Record refund request and provider reference.
- Do not mark a refund complete until provider outcome is confirmed.
- Post ledger entries exactly once.
- Reconcile provider reports with internal payments/refunds.

## 6. Migrations

- Never edit an already-applied production migration as the only way to change schema.
- Prefer expand → deploy compatible code → backfill → switch reads/writes → contract.
- Backfills must be resumable, observable, and rate-limited.
- Test rollback strategy; some data migrations are not safely reversible, so document forward-fix procedures.
- Verify constraints/indexes against realistic data volume before large production migrations.


---

<!-- Source file: 04-api-contracts-and-integration-rules.md -->

# 04 — API Contracts and Integration Rules

## 1. API conventions

Choose REST, GraphQL, or a combination intentionally and document it. REST is a practical default for commerce workflows.

- Version public contracts (`/api/v1` or a documented equivalent).
- Use consistent resource naming, pagination, sorting, filtering, and error schemas.
- Validate request bodies, path parameters, and query parameters.
- Return appropriate HTTP status codes.
- Never expose internal stack traces, SQL, secrets, or provider credentials.
- Use a correlation/request ID and include it in logs and error responses.
- Document APIs with OpenAPI and validate generated/client contracts in CI.
- Define rate limits and authentication requirements per route.
- Apply object-level permissions to every record, not only route-level role checks.

## 2. Example error shape

```json
{
  "error": {
    "code": "INVENTORY_UNAVAILABLE",
    "message": "One or more items are no longer available.",
    "requestId": "correlation-id",
    "details": []
  }
}
```

Keep user-facing messages safe and actionable. Do not leak sensitive validation internals.

## 3. Idempotency

Require an idempotency key for operations where a retry must not duplicate effects:
- order/checkout submission
- payment intent/authorization creation
- refund initiation
- payout initiation
- coupon redemption where duplicate redemption is forbidden

Store key, actor/scope, request fingerprint, state, response reference, and expiry. A reused key with a different request body must be rejected. Define retention and cleanup.

## 4. Webhooks

- Verify signatures using provider documentation and constant-time comparison where applicable.
- Validate event timestamp/replay protection where supported.
- Store event ID with a unique constraint.
- Acknowledge quickly; use durable processing for complex workflows.
- Treat webhook delivery as at-least-once and possibly out of order.
- Enforce state transition rules and idempotent side effects.
- Monitor signature failures, retries, processing delay, and dead-letter volume.
- Have a reconciliation path for missing webhooks.
- Never trust a browser redirect as proof that payment succeeded.

## 5. Background jobs and events

Each job must define:
- unique job/business key where duplicate execution matters
- timeout and retry policy
- backoff and jitter
- maximum attempts
- dead-letter/replay procedure
- structured logs and metrics
- idempotent handler behavior
- PII minimization in payloads

For reliable DB-to-queue publishing, use a transactional outbox or a documented equivalent. Do not commit a database change and then rely on an unprotected in-memory event to notify another module.

## 6. External service adapters

Create interfaces for payment, shipping, email, SMS, object storage, and search providers. Keep vendor SDK calls in adapters. Map provider errors into internal error categories. Define timeout, retry, rate limit, and reconciliation behavior for each adapter.

## 7. API security checklist

- Authentication and authorization tests for every sensitive endpoint
- Input validation and size limits
- Rate limiting / abuse detection
- CORS policy restricted to expected origins
- CSRF protection if cookie sessions are used
- No sensitive fields in response DTOs
- Safe upload handling
- Security headers at the edge/app
- No secrets in logs or error messages
- API schema diff reviewed before breaking changes


---

<!-- Source file: 05-testing-and-quality-gates.md -->

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


---

<!-- Source file: 06-devops-observability-and-release.md -->

# 06 — DevOps, Observability, and Release

## 1. Environments

Maintain isolated environments:
- local development
- CI/test
- staging/pre-production
- production

Separate databases, buckets, queues, credentials, domains, and payment provider modes. Production secrets must not be available to untrusted pull requests.

## 2. Deployment approach

- Make builds reproducible and versioned.
- Deploy immutable artifacts where possible.
- Use health/readiness checks.
- Run migrations as a controlled release step.
- Prefer backward-compatible expand/contract migrations.
- Use rolling or blue/green deployment when supported.
- Keep a documented rollback and forward-fix procedure.
- Use feature flags for high-risk changes.
- Require approval for production database and payment changes.

## 3. Observability

### Structured logs
Include timestamp, severity, service/app version, environment, request/correlation ID, actor ID when safe, operation, outcome, duration, and error category. Redact personal/payment data.

### Metrics
Track:
- request rate, error rate, p50/p95/p99 latency
- database connection pool and slow query metrics
- queue depth, age of oldest job, retries, dead letters
- checkout attempts and completion
- payment success/failure/pending rates
- inventory reservation conflicts
- webhook processing lag and signature failures
- refund/payout/reconciliation mismatches
- notification delivery/failure
- CPU, memory, disk, network, cache hit ratio

### Tracing
Trace cross-module and provider calls for checkout, payment, fulfilment, refund, and payout paths where the stack supports distributed tracing.

### Alerting
Alerts should have an owner, severity, runbook, and actionable threshold. Avoid noisy alerts that nobody responds to.

## 4. Backup and recovery

- Define recovery point objective (RPO) and recovery time objective (RTO) with the business.
- Back up database and required object data.
- Encrypt backups and restrict access.
- Keep copies isolated from production credentials.
- Test restoration on a schedule; a backup that has never been restored is unverified.
- Document recovery order: database, object storage, queue/outbox recovery, application, provider reconciliation.
- Define retention and deletion policies.

## 5. Incident response

Document:
- severity levels and escalation contacts
- how to disable a risky feature
- how to pause checkout or payouts safely
- how to rotate secrets
- how to inspect stuck jobs and replay dead letters
- how to reconcile payments/refunds after an outage
- how to communicate customer-impacting incidents
- post-incident review and corrective actions

## 6. Launch checklist

- [ ] Product policies approved (shipping, cancellation, returns, refunds, commissions, seller verification)
- [ ] All MVP requirements mapped to tests
- [ ] CI gates passing
- [ ] Security review completed
- [ ] Privileged accounts protected with MFA
- [ ] Payment sandbox and production configurations verified separately
- [ ] Webhook signature and duplicate-event tests pass
- [ ] Inventory concurrency tests pass
- [ ] Backup restoration tested
- [ ] Monitoring, alerting, and runbooks ready
- [ ] Load test completed against agreed targets
- [ ] Privacy, terms, returns, seller agreements, and legal review complete
- [ ] Customer support process staffed
- [ ] Rollback/forward-fix plan reviewed
- [ ] No known critical/high-risk defects without explicit sign-off


---

<!-- Source file: 07-module-01-foundation-and-identity.md -->

# Module 01 — Engineering Foundation and Identity

## Goal

Create a reproducible development baseline and secure user identity/authorization before building commerce features.

## Prerequisites
- Project charter and technology stack decisions approved.
- Repository inspected; existing code and constraints documented.

## Step-by-step implementation
1. Establish repository structure and branch/PR policy.
2. Configure formatter, linter, static analysis, type checking, and test runner.
3. Create local and CI configuration with environment-variable validation.
4. Add health/readiness endpoints and a minimal application boot path.
5. Configure database connection, migration runner, and synthetic seed mechanism.
6. Implement registration, login, logout, password reset, and email/phone verification as required.
7. Use maintained framework authentication and password-hashing features.
8. Implement role/permission policy primitives, but prefer permissions over scattered hard-coded role-name checks.
9. Add authorization middleware/policies and object-level access checks.
10. Implement session/token rotation, expiration, revocation, and secure cookie behavior as applicable.
11. Add login/OTP rate limiting, audit events, and security logging.
12. Add account status handling: active, suspended, pending verification, deleted/anonymized as policy requires.
13. Add account profile and address book.
14. Add tests for authentication, authorization, lockout/rate limits, and account recovery.
15. Document setup, commands, configuration, migrations, and troubleshooting.

## Acceptance criteria
- A new developer can run the app and tests from documented instructions.
- CI runs the required quality gates.
- Unauthenticated requests cannot access protected resources.
- Users cannot read or modify another user's private records.
- Privileged actions are permission-checked and audited.
- Secrets are not committed or logged.
- Password reset and verification tokens expire and cannot be reused.
- All core identity tests pass.

## Required tests
- Unit: password/verification token policy where custom logic exists; permission decisions.
- Integration: register/login/logout/reset flows; session/token revocation.
- Security: brute-force/rate-limit behavior; object-level authorization; session cookie settings.
- E2E: register, verify, sign in, update profile, sign out.

## Deliverables
- Working app skeleton, CI configuration, migrations, auth and permissions, API docs, tests, local setup guide.


---

<!-- Source file: 08-module-02-catalogue-and-search.md -->

# Module 02 — Catalogue, Media, and Search

## Goal
Enable approved sellers and authorized staff to create structured listings that customers can reliably discover.

## Prerequisites
- Identity/permissions module complete.
- Seller ownership model established.

## Step-by-step implementation
1. Define category hierarchy, category attributes, brands, and product moderation rules.
2. Define product, variant/SKU, attribute, media, and category-assignment schemas.
3. Specify which attributes are variant-defining (e.g., size/color) and which are descriptive.
4. Implement draft, pending-review, approved, rejected, inactive, and archived listing states.
5. Implement seller-owned product CRUD with server-side seller scope.
6. Validate required fields, SKU uniqueness, variant combinations, price/currency, and allowed category attributes.
7. Implement media upload through object storage; validate size, file signature, format, dimensions, and permissions.
8. Generate safe image variants/thumbnails asynchronously where appropriate.
9. Implement moderation queue, rejection reasons, audit history, and resubmission.
10. Implement public product/category pages with SEO metadata and canonical URL rules.
11. Start with database-backed search only if expected scale/relevance allows it; keep a search interface so a dedicated engine can replace it.
12. Implement filters, sorting, pagination, category facets, brand, price range, availability, and seller filters.
13. Prevent unpublished/rejected/private products from appearing in public search or feeds.
14. Add caching only after defining invalidation behavior for product updates and stock/price changes.
15. Add tests for ownership, moderation, media validation, search visibility, and pagination.

## Acceptance criteria
- Seller A cannot edit or see private data for Seller B's listings.
- Only approved, active listings are publicly discoverable.
- Variant/SKU identity and pricing are unambiguous.
- Media is stored outside the relational database and served securely.
- Search filters/sort/pagination are stable and tested.
- Catalogue changes invalidate or refresh cached/search documents correctly.

## Required tests
- Unit: variant validation, slug generation, moderation transitions.
- Integration: product CRUD, media upload, search queries, indexing/update behavior.
- Security: seller isolation, upload spoofing, oversized files, unauthorized media access.
- E2E: seller creates listing, moderator approves, customer searches and opens product.


---

<!-- Source file: 09-module-03-seller-and-admin.md -->

# Module 03 — Seller Onboarding, Storefront, and Admin

## Goal
Create safe seller onboarding and the operational tools required to govern a multi-vendor marketplace.

## Step-by-step implementation
1. Define seller application fields, evidence requirements, approval states, and review SLA.
2. Implement seller application and restricted document upload.
3. Implement admin review, approval, rejection, suspension, and reactivation.
4. Store status history and reason codes; audit every privileged transition.
5. Implement seller profile/storefront settings: name, logo, description, contact/policy details.
6. Implement seller team membership and permission scopes, if multiple staff per seller are supported.
7. Add seller-level access policies for products, orders, inventory, analytics, statements, and documents.
8. Build admin user/seller/product/order lookup with strict permissions and audit.
9. Add safe support impersonation only if necessary; require explicit permission, time limit, banner, reason, and audit trail. Prefer read-only support tools.
10. Add moderation queues, search, filters, pagination, and bulk actions with safeguards.
11. Add suspension behavior: define effects on listings, new orders, active orders, balances, and payouts.
12. Add tests for cross-seller data access and admin permissions.

## Acceptance criteria
- Seller approval is required before selling.
- Seller documents are only accessible to authorized staff and the applicant where appropriate.
- Every privileged admin change is auditable.
- Seller suspension has documented, tested effects.
- Seller staff can access only the seller account and permissions granted to them.


---

<!-- Source file: 10-module-04-inventory-and-pricing.md -->

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


---

<!-- Source file: 11-module-05-cart-checkout-promotions.md -->

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


---

<!-- Source file: 12-module-06-orders-payments-refunds.md -->

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


---

<!-- Source file: 13-module-07-fulfilment-returns-reviews.md -->

# Module 07 — Fulfilment, Returns, Disputes, and Reviews

## Goal
Support seller fulfilment, tracking, delivery confirmation, eligible returns, disputes, and trusted reviews.

## Step-by-step implementation
1. Define fulfilment model: seller ships, marketplace warehouse, or mixed.
2. Define shipment split rules for multi-seller and multi-package orders.
3. Implement shipment creation and item allocation.
4. Add carrier adapter or manual tracking updates for MVP.
5. Record shipment status history and normalize carrier statuses.
6. Define delivered status evidence and who can set it.
7. Define return eligibility windows, exclusions, item condition, and required evidence.
8. Implement return request, review/approval, return label or instructions, receipt, inspection, and outcome.
9. Link return outcomes to refund and inventory restock/damage workflows.
10. Implement dispute cases with reason codes, evidence access controls, deadlines, and audit.
11. Allow reviews only for eligible delivered purchases; enforce one review per defined purchase/item policy.
12. Add review moderation, reporting, and anti-abuse controls.
13. Add notification events for shipment, delivery, return status, and dispute outcomes.
14. Test partial shipment, partial return, lost shipment, failed delivery, and refund coordination.

## Acceptance criteria
- Shipment tracking is auditable and resilient to duplicate/out-of-order carrier updates.
- Returns cannot bypass policy or create duplicate refunds.
- Returned goods are not automatically restocked unless inspection/policy allows it.
- Reviews are tied to eligible purchases and can be moderated.


---

<!-- Source file: 14-module-08-finance-payouts-and-ledger.md -->

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


---

<!-- Source file: 15-module-09-notifications-support-analytics.md -->

# Module 09 — Notifications, Support, and Analytics

## Goal
Provide reliable customer/seller communications, support workflows, and trustworthy operational reporting.

## Step-by-step implementation
1. Define notification event catalog and templates for order, payment, shipment, return, security, and seller events.
2. Store user preferences, consent, channel availability, and locale.
3. Use provider adapters for email/SMS/push/WhatsApp as required.
4. Queue notification delivery asynchronously; retry transient failures and record final outcome.
5. Avoid duplicate messages using event/business keys where needed.
6. Redact sensitive data and avoid placing secrets or unnecessary personal data in message payloads.
7. Implement support tickets with category, priority, ownership, status, messages, and attachments.
8. Define support access controls; agents see only information needed for their work.
9. Audit refunds, seller suspensions, payout changes, and other privileged support actions.
10. Define analytics events and metric definitions before building dashboards.
11. Keep operational dashboards separate from financial source-of-truth tables; use read models or reporting jobs as needed.
12. Add export permissions, row limits, audit, and PII minimization.
13. Test provider failure/retry, preferences, duplicate event handling, and report access controls.

## Acceptance criteria
- Important transactional notifications are queued and observable.
- Failures can be retried or investigated.
- Marketing messages honor consent and opt-out rules.
- Support staff permissions are limited and auditable.
- Reports have documented definitions and reconcile with source records.


---

<!-- Source file: 16-module-10-scale-hardening-and-launch.md -->

# Module 10 — Scale Hardening and Launch Readiness

## Goal
Prove that the system is safe to launch at agreed traffic and business volumes, then scale based on evidence.

## Step-by-step implementation
1. Establish baseline metrics and realistic workload assumptions with the product owner.
2. Profile high-traffic routes and slow database queries.
3. Fix N+1 queries, missing indexes, unbounded queries, and inefficient serialization.
4. Run load, stress, and soak tests on representative catalogue and order data.
5. Test checkout and inventory contention at expected peak concurrency.
6. Validate cache correctness and invalidation; remove caching if correctness cannot be maintained.
7. Verify background queue capacity, retries, dead-letter monitoring, and replay procedures.
8. Conduct threat modeling and security testing, including authorization, upload, abuse, and rate-limit scenarios.
9. Review dependency/container vulnerabilities and secret exposure.
10. Test database backup restore and disaster recovery against agreed RPO/RTO.
11. Validate horizontal scaling and graceful behavior when a provider or queue is unavailable.
12. Run migration tests against production-like data volume and document long-running migration behavior.
13. Verify accessibility and SEO for key public journeys.
14. Complete privacy, consumer, payment, tax, and seller-policy review for launch markets.
15. Conduct a staged release, monitor metrics, and define rollback/feature-disable triggers.
16. Run a post-launch review and prioritize fixes based on actual usage and incidents.

## Scale evolution path
- Stage A: one application deployment, relational DB, background workers, object storage/CDN.
- Stage B: multiple stateless app instances, managed queue/cache, dedicated search, read replicas if justified.
- Stage C: isolate high-load workers and reporting workloads; tune partitioning/archival based on measurements.
- Stage D: extract independently scaling domains into services only when team and operational maturity support it.
- Stage E: consider multi-region architecture only after data consistency, latency, legal, and recovery requirements are defined.

## Acceptance criteria
- Agreed performance targets are met in repeatable tests.
- No critical authorization, payment, stock, or ledger defect remains unresolved.
- Recovery, alerting, rollback, and incident runbooks are tested.
- Product owner approves launch risks and known limitations.


---

<!-- Source file: 17-claude-code-execution-prompt.md -->

# 17 — Master Prompt for Claude Code

You are the senior software engineer and technical lead for this repository. Build a reliable multi-vendor e-commerce marketplace using the existing project and the documentation in `/docs`.

## Mandatory first step
Do not start by generating the entire application. First inspect the repository, stack, existing code, tests, dependencies, deployment setup, and these documents. Summarize:
- what exists today;
- the chosen architecture and module boundaries;
- mismatches between current code and docs;
- unresolved product decisions;
- the first small implementation slice you recommend.

Read these files first:
- `/docs/00-project-charter-and-working-agreement.md`
- `/docs/01-roadmap-and-module-sequence.md`
- `/docs/02-architecture-and-engineering-standards.md`
- `/docs/03-domain-model-and-data-design.md`
- `/docs/04-api-contracts-and-integration-rules.md`
- `/docs/05-testing-and-quality-gates.md`
- the module-specific document for the current task.

## Implementation rules
1. Implement one vertical slice at a time.
2. Before editing, provide a concise plan: requirements, files, schema changes, API changes, tests, risks, and assumptions.
3. Do not invent business rules involving money, seller rights, returns, taxes, privacy, or payment behavior. Ask for clarification when needed.
4. Use the project's established conventions unless they are unsafe or materially inadequate; explain any proposed change.
5. Use transactions, database constraints, idempotency, and state-machine validation for critical commerce workflows.
6. Treat all external providers as unreliable. Verify webhooks, handle duplicate events, timeouts, retries, and reconciliation.
7. Enforce authorization server-side on every endpoint and every object.
8. Never trust client-provided prices, totals, discounts, commissions, permissions, or payment success.
9. Use fixed-point money representation and explicit currency/rounding rules.
10. Add tests for success, invalid input, authorization failures, concurrency, retries, and external failures.
11. Do not skip, delete, weaken, or rewrite tests just to make the suite pass.
12. Do not claim a test passed unless you ran it. Report exact commands and outcomes.
13. Do not add microservices, queues, caches, or complex infrastructure without a clear requirement or measured justification.
14. Keep secrets out of code, logs, fixtures, and commits.
15. Update API docs, schema docs, ADRs, changelog, and traceability CSV when appropriate.

## Required completion report
At the end of each task, report:
- summary of behavior delivered;
- files created/changed;
- migration/seed instructions;
- API/UI changes;
- tests added and exact commands run;
- test results (passed/failed/not run);
- security and performance considerations;
- manual QA steps;
- unresolved questions and known limitations;
- recommended next task.

## Work request template
Use this template for each new task:

> Implement **[MODULE / VERTICAL SLICE]** according to `/docs/[MODULE FILE].md`.
> First inspect the repository and report the implementation plan. Do not edit files until the plan is clear. Then implement only this slice, including migrations, server-side validation/authorization, UI/API, automated tests, logging/audit, and documentation as applicable. Run all relevant checks and report exact results. Stop before starting the next module.

## Stop conditions
Stop and ask before proceeding if:
- the stack or repository architecture is ambiguous;
- a requirement changes payment, financial, tax, privacy, or legal behavior;
- a destructive migration or data loss is possible;
- production credentials or live payment actions would be required;
- an external integration cannot be safely tested in sandbox;
- a security trade-off would materially weaken protections.


---

<!-- Source file: 19-architecture-decision-record-template.md -->

# ADR-XXXX: [Decision title]

- **Status:** Proposed | Accepted | Superseded
- **Date:** YYYY-MM-DD
- **Decision owner:** [Name/role]
- **Related modules:** [Modules]
- **Related requirements:** [Requirement IDs]

## Context
What problem or decision needs to be addressed? Include constraints, scale assumptions, operational needs, and business context.

## Decision
State the selected option clearly.

## Options considered
1. **Option A:** Description, benefits, drawbacks.
2. **Option B:** Description, benefits, drawbacks.
3. **Option C:** Description, benefits, drawbacks.

## Rationale
Explain why the selected option best fits the current requirements and what evidence supports it.

## Consequences
### Positive
- ...

### Negative / trade-offs
- ...

### Operational impact
- Deployment, monitoring, backups, incident response, cost, and staffing impact.

## Security and privacy impact
- ...

## Revisit trigger
What measurable event or changed requirement should cause this decision to be reconsidered?


---

<!-- Source file: MODULE-TEMPLATE.md -->

# Module XX — [Name]

## Goal
[Business outcome]

## Prerequisites
- [Completed modules and decisions]

## Scope
### In scope
- ...

### Out of scope
- ...

## Step-by-step implementation
1. ...
2. ...
3. ...

## Data model
- Entities:
- Ownership:
- Constraints/indexes:
- Transaction boundaries:
- Migration and backfill plan:

## API/UI
- Endpoints/screens:
- Request/response schemas:
- Validation:
- Authorization:
- Error cases:

## Reliability and security
- Idempotency:
- Retries/timeouts:
- Audit events:
- Sensitive data:
- Abuse prevention:

## Testing
- Unit:
- Integration:
- Contract:
- E2E:
- Security/performance:

## Acceptance criteria
- [ ] ...
- [ ] ...

## Operations
- Metrics/logs/alerts:
- Runbook:
- Rollback/forward-fix:

## Open questions
- ...


---

<!-- Source file: README.md -->

# Marketplace Development Pack — Daraz/Temu-style Multi-Vendor E-Commerce

**Purpose:** A step-by-step, module-wise implementation pack for a multi-vendor marketplace. It is designed to be given to Claude Code or a development team as the project's working blueprint.

## Important scope note

This is a development blueprint, not a promise that the first release will match Daraz or Temu in scale. Build a reliable, secure, observable marketplace first; scale using measured bottlenecks. Do not start with dozens of microservices. The recommended starting architecture is a **modular monolith** with clear module boundaries, a relational database, background workers, object storage, and a search abstraction.

## Document map

| File | Purpose |
|---|---|
| `00-project-charter-and-working-agreement.md` | Product scope, principles, roles, and Claude Code rules |
| `01-roadmap-and-module-sequence.md` | Ordered implementation plan, dependencies, exit criteria |
| `02-architecture-and-engineering-standards.md` | Architecture, coding, security, reliability, scalability standards |
| `03-domain-model-and-data-design.md` | Core entities, data ownership, constraints, migrations |
| `04-api-contracts-and-integration-rules.md` | API standards, errors, idempotency, webhooks, events |
| `05-testing-and-quality-gates.md` | Unit, integration, contract, E2E, security, performance testing |
| `06-devops-observability-and-release.md` | Environments, CI/CD, monitoring, backup, deployment, rollback |
| `07-module-01-foundation-and-identity.md` | Repo, app skeleton, auth, users, permissions |
| `08-module-02-catalogue-and-search.md` | Products, variants, categories, media, search |
| `09-module-03-seller-and-admin.md` | Seller onboarding, storefront, moderation, admin |
| `10-module-04-inventory-and-pricing.md` | Stock, reservations, price history, concurrency |
| `11-module-05-cart-checkout-promotions.md` | Cart, shipping quotes, promotions, checkout |
| `12-module-06-orders-payments-refunds.md` | Orders, payment lifecycle, refunds, financial integrity |
| `13-module-07-fulfilment-returns-reviews.md` | Shipment, delivery, returns, disputes, reviews |
| `14-module-08-finance-payouts-and-ledger.md` | Commissions, seller balances, settlement, reconciliation |
| `15-module-09-notifications-support-analytics.md` | Notifications, support, analytics, audit trails |
| `16-module-10-scale-hardening-and-launch.md` | Load tests, security review, launch readiness, scale path |
| `17-claude-code-execution-prompt.md` | Master instructions and iterative prompt for Claude Code |
| `18-requirements-traceability-template.csv` | Requirements-to-tests traceability starter |
| `19-architecture-decision-record-template.md` | Template for decisions and trade-offs |

## How to use this pack

1. Commit these files into the repository under `/docs`.
2. Choose and record the technology stack before implementation. If already decided, update the stack references.
3. Ask Claude Code to read `00`, `01`, `02`, `03`, `04`, `05`, and `17` first.
4. Implement **one module at a time** in the sequence in `01`. Do not ask the agent to build the whole marketplace in one prompt.
5. For each module: inspect the repository, propose a plan, identify migrations/API/UI/tests, implement, run tests, report files changed and commands/results.
6. Do not mark a module complete until its acceptance criteria pass and the traceability CSV is updated.
7. Review every database migration, payment/refund workflow, permission rule, and deployment change before production.

## Stack-neutral defaults

- Backend: a well-supported framework with strong transaction support and validation.
- Primary database: PostgreSQL or MySQL/InnoDB; select one and standardize. Avoid using multiple primary databases without a clear need.
- Cache/queues: Redis or equivalent only where needed; queues must be durable enough for the selected workload.
- Search: begin with database search only for a small MVP; use OpenSearch/Elasticsearch or a managed search service when relevance, faceting, and scale justify it.
- Media: object storage + CDN; never store large uploaded binaries in the relational database.
- Frontend: responsive web storefront, seller portal, and admin portal; share design tokens and API contracts.
- Deployment: containerized or reproducible deployment, separate environments, automated CI, managed database where feasible.
- Payments: integrate a supported payment provider; never store raw card details.

## Definition of done

A module is done only when:
- requirements and acceptance criteria are met;
- authorization and validation are implemented server-side;
- migrations are safe and reversible where practical;
- unit and integration tests cover core logic and failure cases;
- API contracts and operational notes are updated;
- logs/metrics/audit events exist for important actions;
- lint, static analysis, and automated tests pass;
- no secrets or sensitive data are committed;
- the module works with neighboring modules and has a documented manual verification path.
