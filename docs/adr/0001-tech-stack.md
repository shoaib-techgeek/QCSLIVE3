# ADR-0001 — Technology stack

Status: Accepted (2026-11-01)

## Context
The module guides in `modules/` were written stack-neutral (Laravel/NestJS, PostgreSQL, Redis, Next.js). The code that exists today uses a different stack. Docs and code must agree, so the code wins.

## Decision
| Concern | Choice |
|---|---|
| Backend | Node 22, TypeScript (strict), Fastify, modular monolith |
| Database | MySQL/MariaDB (utf8mb4, InnoDB) via Knex migrations |
| Auth | Email + password, server-side sessions in the DB, HttpOnly `sid` cookie, CSRF header guard |
| Frontend | React 19 + Vite + React Router (JavaScript), buyer, seller (`/seller`) and admin (`/admin`) shells in one app |
| Tests | Vitest (backend unit + integration against `marketplace_test`; frontend with Testing Library) |
| Lint | oxlint (frontend), `tsc --noEmit` (backend) |
| Local dev | XAMPP MySQL, no Docker yet |

## Consequences
- Module guides that mention PostgreSQL, Redis, Testcontainers, UUIDv7, OTP/JWT, Next.js or Laravel are **target options, not current facts**. Where they conflict with this ADR, this ADR wins until a new ADR supersedes it.
- IDs are `bigint` auto-increment today. Public-facing IDs for orders, payments and payouts must not be guessable; add an opaque public id (ULID) column when those modules are built.
- Redis, queue broker, search engine and object storage are introduced by their own ADR when the first module needs them (cart, search, media).
- Moving to PostgreSQL later needs its own ADR and a data-migration plan; do it before the catalog/orders data grows.
