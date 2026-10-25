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
