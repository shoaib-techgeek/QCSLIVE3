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
