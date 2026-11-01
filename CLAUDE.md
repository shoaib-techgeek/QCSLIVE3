# CLAUDE.md — Rules for building this marketplace

You are a senior engineer on a multi-vendor e-commerce marketplace (Temu-style). Business behaviour comes from `modules/*.md` (the SRS requirement IDs they cite) and `docs/adr/`. Code and ADRs win over stack-neutral wording in module guides. These rules apply to every task.

## Source of truth, in order
1. The user's current instruction.
2. `docs/PRODUCT.md` (scope, phases, MVP, open decisions) and `docs/adr/` (stack and architecture decisions; ADR-0001 fixes the stack).
3. `modules/<NN>-<name>.md` (scope, steps, tests, Definition of Done for that module).
4. This file.

If a business rule is missing or ambiguous, STOP and ask. Never invent business rules, prices, fees, limits or policies.

## Stack (ADR-0001)
Node 22 + TypeScript strict + Fastify + Knex + MySQL/MariaDB (backend); React 19 + Vite + React Router, JavaScript (frontend); Vitest everywhere. Do not add Redis, a broker, a search engine, Docker or another framework without an ADR.

## Before writing code
- Restate the requirement IDs and acceptance criteria you are implementing.
- List assumptions and open questions.
- When the task says "design first": propose files, entities, endpoints, migrations and events, then wait for approval.
- Work on one module at a time, in the order of `modules/README.md`. Do not start a module whose dependencies are not Done, or a phase before the previous phase's exit check in `docs/PRODUCT.md` passes. Never hard-code an item listed under "Open decisions" there; make it config and ask.

## Architecture
- Backend modules live in `backend/src/modules/<name>/`; cross-cutting code in `backend/src/shared/`. Business rules go in pure functions/services with no HTTP or Knex imports; routes only parse, authorize, call, respond.
- A module never queries another module's tables. Use its exported service or a domain event.
- Every external dependency (payment gateway, courier, SMS, email, storage) sits behind an interface with a Fake/Log implementation for tests (pattern: `Mailer` / `LogMailer`).
- Cross-module side effects use a transactional outbox written in the same DB transaction (introduce with the first cross-module event).
- Frontend: pages in `src/pages`, API calls only in `src/api`, shared UI only from `src/ui` and `src/components`. Reuse before creating.

## Data rules
- Money: integer minor units + ISO 4217 currency. Never floats. Format only via `src/lib/formatMoney`.
- Time: UTC in storage; inject a clock into business logic, no bare `Date.now()` in rules that tests must control.
- IDs: bigint internally; any id exposed for orders, payments, refunds or payouts also has an opaque public id (ULID).
- Optimistic locking (`version` column) on mutable aggregates.
- Append-only tables (ledger, stock movements, status history, audit): no UPDATE/DELETE, ever.
- Order items snapshot product title, price and image.
- Every schema change is a Knex migration with a working `down`, backward compatible (expand → migrate → contract). Never edit a migration that has been merged.

## API rules
- `/api/v1` prefix, plural nouns, camelCase JSON, cursor pagination.
- Errors use the existing shape `{error:{code,message,requestId,details}}` with a machine `code`.
- The backend is headless and API-only (ADR-0003): no HTML, no UI logic; every client uses `/api/v1` and nothing else.
- Contract first: describe every new or changed endpoint in `docs/openapi.yaml` before writing the route. Only additive changes inside `/v1`.
- Webhooks (payment, courier) are API endpoints: verify signature, be idempotent, respond fast, process via queue/outbox.
- `Idempotency-Key` required on POSTs that create orders, payments, refunds, payouts.
- Mutating requests keep the `X-Requested-With` CSRF guard.
- Authorization on every endpoint and every resource (permission check + ownership check). Every resource endpoint needs an IDOR negative test.
- Validate every input with a schema (zod, as in `schemas.ts`). Never trust client prices, totals, stock or roles.

## Security
- Passwords hashed (existing `password.ts`); tokens stored hashed; sessions revocable server-side.
- No secrets, URLs or business constants in code: `.env` / admin settings. `.env` is never committed; keep `.env.example` complete.
- Never log PII, tokens or card data. Never store raw card data.
- Dev-only helpers (`seed:dev`, `log` mail driver, `/design`) must refuse or be absent in production.

## Testing (TDD)
- Write the failing test from the acceptance criteria first, then implement, then refactor. Every bug fix starts with a failing test.
- Unit tests: arrange/act/assert, one behaviour each, names that read as behaviour (`rejects voucher below min spend`).
- Integration tests run against `marketplace_test` only, never the dev DB. External APIs use fakes.
- Concurrency tests for stock, vouchers, wallet, payments.
- Coverage targets: money/stock/order/promotion code ≥ 95% line, ≥ 90% branch; everything else ≥ 85%. Gates become CI-enforced once CI exists (module 00).
- Before saying "done", run and report: backend `npm run typecheck && npm test`; frontend `npm run lint && npm test && npm run build`.

## Quality
- Strict types, lint clean. Functions small (complexity ≤ 10). No commented-out code, no debug prints, no TODO without a ticket id.
- Structured logs with request id. Add metrics/trace spans to new endpoints once observability (module 23) exists.
- Accessibility floor for UI: labelled inputs, visible focus, keyboard reachable, AA contrast, `role="alert"` for errors. Use CSS variables from `src/index.css`, never raw hex.

## Delivery
- Small PRs (≤ 400 lines preferred), one requirement group each. Never commit to `main` directly once branch protection exists.
- Conventional Commits citing IDs: `feat(cart): merge guest cart on login [FR-CART-01]`.
- Update in the same change: `CHANGELOG.md`, the module's Definition of Done checkboxes, README/ADR if behaviour or stack changed.
- End every task with: what was built, IDs covered, tests added, how to run them, risks, open questions.

## Do not
- Do not edit `dist/`, `node_modules/`, or applied migrations.
- Do not build more than the asked module/step.
- Do not weaken or delete a test to make it pass.
- Do not run destructive DB commands (drop, truncate, rollback) against anything but `marketplace_test` without asking.
