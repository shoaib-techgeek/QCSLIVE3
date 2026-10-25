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
