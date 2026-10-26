# Changelog

## Unreleased
- Design system: tokens with light/dark/system theme, UI kit (Button, Badge, Field select/textarea, Tabs, Modal, Toast, Skeleton, EmptyState, DataTable, StatCard, ProductCard), `formatMoney` helper, dev-only gallery at `/design`.
- Seller center (`/seller`) and admin console (`/admin`) shells with a responsive sidebar, gated by `seller:access` / `admin:access` (permissions to be added by the backend).
- Backend foundation: Fastify/TypeScript app, env validation, MySQL migrations, health endpoints, audit table.
- Identity: registration, email verification, login/logout with server-side sessions, password reset/change, lockout, rate limiting, permission guard, profile (`/me`).
- Frontend: React auth pages (sign in, register, verify email, forgot/reset password), protected account page with profile and password change.
