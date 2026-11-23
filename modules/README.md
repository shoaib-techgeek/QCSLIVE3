# Module guides

Step-by-step build guides, one per module. Build **one module at a time, in order**; a module starts only when the modules it depends on are Done (each guide lists its `Dependencies`).

> **Stack note.** These guides are stack-neutral and mention Postgres, Redis, Testcontainers, UUIDv7, OTP/JWT, Next.js and Laravel/NestJS. The real stack is fixed in [ADR-0001](../docs/adr/0001-tech-stack.md) (Node/Fastify/Knex/MySQL, React+Vite, session cookies). Where a guide conflicts with an ADR or with [CLAUDE.md](../CLAUDE.md), the ADR/CLAUDE.md wins. Translate, do not copy: e.g. "Postgres partial index" means the nearest MySQL equivalent, decided in that module's design step.

Phases and exit checks are in [docs/PRODUCT.md](../docs/PRODUCT.md).

## Order and status

| # | Module | Status | Notes |
|---|---|---|---|
| 00 | [Project setup](00-project-setup.md) | Partial | App skeleton, migrations, health endpoints, tests exist. CI workflow added (`.github/workflows/ci.yml`, unverified until first run). Architecture tests added. Missing: pre-commit hooks, deploy, observability |
| 01 | [Architecture and scalability](01-architecture-and-scalability.md) | Reference | Playbook, not built. Use when a metric demands it |
| 02 | [Shared kernel](02-shared-kernel.md) | Partial | `AppError`, audit, `Mailer`/`LogMailer` exist. `Money`, `Clock`, outbox table, helpers and relay worker added. Missing: pagination, idempotency middleware, settings service |
| 03 | [Identity and auth](03-identity-auth.md) | Partial | Email+password, sessions, reset, lockout, `/me`, RBAC guard, Google sign-in done. **Diverges from guide**: no OTP, Apple login, 2FA, addresses |
| 04 | [Seller onboarding](04-seller-onboarding.md) | In progress | Seller profile, KYC documents/details, submit, admin review and decisions done (P1.1-P1.3, backend + UI). Missing: bank accounts, staff, public store page, production file storage |
| 05 | [Catalog](05-catalog.md) | In progress | P1.4-P1.6 done: schema, state machine, variants, prices, seller product API, images, admin moderation API. Public catalogue/search API and seller + admin screens done (P1.8-P1.10). Missing: bulk import, SEO/sitemap, rich media, brands |
| 06 | [Inventory](06-inventory.md) | In progress | P1.7 done: stock, reserve/release/commit, expiry, ledger, seller stock endpoint. Missing: order/payment event consumers (P2), bulk update, low-stock alerts, seller stock screen, flash-sale mode |
| 07 | [Search](07-search.md) | Partial | MySQL fulltext + substring search with filters and sort via `/api/v1/products`. Missing: facets, typo tolerance, search engine |
| 08 | [Cart](08-cart.md) | Partial | P2.1 done: signed-in cart with revalidation, API + pages. Missing: guest cart and merge (not planned), save for later, promotions and shipping previews, abandonment event |
| 09 | [Checkout and orders](09-checkout-orders.md) | Not started | |
| 10 | [Payments](10-payments.md) | Not started | |
| 11 | [Ledger and finance](11-ledger-finance.md) | Not started | |
| 12 | [Shipping](12-shipping.md) | Not started | |
| 13 | [Returns and refunds](13-returns-refunds.md) | Not started | |
| 14 | [Promotions](14-promotions.md) | Not started | |
| 15 | [Reviews](15-reviews.md) | Not started | |
| 16 | [Messaging and notifications](16-messaging-notifications.md) | Not started | |
| 17 | [Customer support](17-customer-support.md) | Not started | |
| 18 | [Fraud](18-fraud.md) | Not started | |
| 19 | [Admin console](19-admin-console.md) | Partial | UI shell only |
| 20 | [Seller center](20-seller-center.md) | Partial | UI shell only |
| 21 | [Buyer web and mobile](21-buyer-web-and-mobile.md) | Partial | Auth pages, design system, home, search, category and product pages on the live catalogue. No cart yet |
| 22 | [Analytics](22-analytics.md) | Not started | |
| 23 | [Release and operations](23-release-and-operations.md) | Not started | |

Update the Status column in the same PR that changes it.

## Definition of done (every module)
- Requirement IDs and acceptance criteria met and automated.
- Authorization and validation enforced server-side; IDOR negative tests present.
- Migrations reversible and backward compatible.
- Unit + integration tests cover logic and failure paths; coverage targets in CLAUDE.md met.
- API contract, CHANGELOG, README/ADR updated.
- Logs and audit events for important actions; no secrets or PII in logs.
- Lint, typecheck and all tests pass; a manual verification path is written down.

## Prompt template
```
Follow CLAUDE.md. Module <NN>-<name>, Step <n> only. Restate requirement IDs and acceptance
criteria, list assumptions and open questions, then produce the design (or code if approved).
Give the commands to verify it.
```
