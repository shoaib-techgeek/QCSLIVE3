# ADR-0003 — API-first, headless backend

Status: Accepted (2026-11-01)

## Context
The marketplace needs a buyer web app, seller center, admin console and later mobile apps. All of them must use the same business rules.

## Decision
- `backend/` is a headless JSON REST API under `/api/v1`. It renders no HTML and holds no UI logic.
- Every client (React app today, mobile later, third-party integrations) uses only this API. Clients never read the database.
- Business rules, validation, pricing, stock and authorization live in the API. Clients are untrusted.
- The contract is `docs/openapi.yaml` and is written before the route (contract first). The frontend API layer (`src/api`) is the only place the web app calls the API.
- Webhooks in (payment gateway, courier) and out (to sellers, later) are also API endpoints with signature verification and idempotency.
- Auth for browsers: HttpOnly session cookie + `X-Requested-With` CSRF guard (ADR-0001). Mobile and integrations get bearer tokens, added by an ADR when the first such client exists.

## Consequences
- No server-side page rendering and no business logic in React components.
- Breaking API changes need a new version (`/api/v2`) or an expand/contract rollout. Additive changes only inside `/v1`.
- OpenAPI drives generated types and contract tests, so frontend and backend cannot drift silently.
