# Marketplace backend

Node 22 + TypeScript + Fastify (modular monolith), MySQL/MariaDB via Knex, Vitest.

## Setup
1. Start MySQL (XAMPP). Create databases: `marketplace_dev`, `marketplace_test` (utf8mb4).
2. `cp .env.example .env` and adjust DB credentials.
3. `npm install && npm run migrate`
4. `npm run dev` -> http://localhost:4000/health/ready

## Commands
- `npm test` all tests (integration tests use `marketplace_test` only, never the dev DB)
- `npm run test:unit` / `npm run test:integration`
- `npm run typecheck`, `npm run build`
- `npm run migrate` / `npm run migrate:rollback`

## Layout
`src/config` env validation, `src/db` knex + migrations, `src/modules/<domain>` routes/services per business capability, `src/shared` cross-cutting code.

## Identity API (`/api/v1`)
| Method & path | Auth | Notes |
|---|---|---|
| POST `/auth/register` | none | Verification on: always 202, sends mail (no enumeration). Off (`REQUIRE_EMAIL_VERIFICATION=false`): 201, account active at once, duplicate email -> 409 |
| POST `/auth/verify-email` | none | Single-use token, 24h |
| POST `/auth/login` | none | HttpOnly `sid` cookie, 7-day server-side session; 5 failures lock the account 15 min |
| POST `/auth/logout` | cookie | Revokes the session server-side |
| POST `/auth/forgot-password` | none | Always 202; token valid 1h, newest link wins |
| POST `/auth/reset-password` | none | Single-use; signs out all devices |
| POST `/auth/change-password` | cookie | Signs out other devices |
| GET/PATCH `/me` | cookie + `account:read/update` | Profile (name, phone) |

Mutating requests must send `X-Requested-With: XMLHttpRequest` (CSRF guard). Errors use `{error:{code,message,requestId,details}}`.
In development the `log` mail driver prints verification/reset links to the server log; it is refused in production.
