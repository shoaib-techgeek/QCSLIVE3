# Changelog

## Unreleased
- Storefront redesign: utility bar with a "Sell on QCS Store" link ("Seller center" for approved sellers), search header with the awning, category strip, hero, trust row, category tiles, product shelves (sample data in `src/lib/sampleCatalog.js` until the catalogue API exists), seller recruitment band and footer. Brand text is now "QCS Store".
- P1.3 Seller verification (KYC): document upload (content-sniffed JPG/PNG/PDF, 5 MB), encrypted CNIC/address/NTN, submit with missing-item report, admin queue, audited detail/download, decisions (start review, approve, approve with conditions, reject, request info). Approval activates the store and grants the `seller` role. New roles/permissions: `seller`, `admin`, `seller:access`, `admin:access`, `kyc:review`. `seed:dev` also creates `admin@example.com`.
- Frontend: seller onboarding page (`/seller/onboarding`), admin verification queue and review pages (`/admin/kyc`), "Sell on QCS Store" link on the account page.
- P1.2 KYC foundations: pure KYC state machine (`transitionKyc`, `canPublish`), `Encryptor` (AES-256-GCM) for PII, `FileStorage` (memory + local disk, unsafe keys rejected), env settings `PII_ENCRYPTION_KEY`, `STORAGE_DRIVER`, `STORAGE_DIR` (required/restricted in production).
- P1.1 Seller profile: `POST/GET/PATCH /api/v1/seller/profile` (one store per user, unique name and slug, audit + `seller.registered` event). Design for P1 approved in `docs/design/P1-seller-and-catalog.md`.
- `docs/openapi.yaml` for health and identity endpoints; architecture tests (shared never imports modules, modules never import each other, routes and spec must match).
- Outbox relay: `EventBus`, `relayOnce` (retry, per-consumer dedupe via `processed_events`), `startRelay` wired into the server.
- P0 foundation: `Money` (minor units, half-even percentage, exact allocate), `Clock`/`FixedClock`, transactional outbox table and helpers, `PaymentGateway` interface with `FakePaymentGateway`, GitHub Actions CI.
- Docs: removed duplicate guides and the stale blueprint README; rewrote CLAUDE.md for the real stack; added ADR-0001/0002 and `modules/README.md` with module status.
- Design system: tokens with light/dark/system theme, UI kit (Button, Badge, Field select/textarea, Tabs, Modal, Toast, Skeleton, EmptyState, DataTable, StatCard, ProductCard), `formatMoney` helper, dev-only gallery at `/design`.
- Seller center (`/seller`) and admin console (`/admin`) shells with a responsive sidebar, gated by `seller:access` / `admin:access` (permissions to be added by the backend).
- Backend foundation: Fastify/TypeScript app, env validation, MySQL migrations, health endpoints, audit table.
- Identity: registration, email verification, login/logout with server-side sessions, password reset/change, lockout, rate limiting, permission guard, profile (`/me`).
- Frontend: React auth pages (sign in, register, verify email, forgot/reset password), protected account page with profile and password change.
