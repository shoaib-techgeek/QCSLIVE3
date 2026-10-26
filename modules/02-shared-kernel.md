# 02 — Shared Kernel (cross-cutting building blocks)

## Goal
Reusable, tested primitives every module uses, so money, IDs, errors, events and auditing behave the same everywhere.

## SRS requirements covered
§2.3 constraints, §6 data rules, §7.1 API conventions, §7.2 events, FR-ADMIN-03 (audit), FR-ADMIN-05 (feature flags), NFR-SEC-04.

## Dependencies
00, 01

## Steps
1. **Design** — list the primitives below; write ADR-003 "Money and rounding", ADR-004 "Outbox and events".
2. **Value objects** — `Money` (minor units, currency, add/subtract/multiply/allocate with half-even rounding, currency mismatch throws), `Percentage`, `Email`, `Phone` (E.164), `Address`, `Slug`, `LocalizedText`.
3. **IDs and clock** — `IdGenerator` (UUIDv7/ULID) and `Clock` interfaces with fixed fakes for tests.
4. **Error model** — `DomainException` hierarchy with machine codes; global HTTP handler mapping to RFC 9457 problem details with `traceId`.
5. **Validation** — request schema validation middleware; shared rules (phone, money, pagination).
6. **Pagination** — cursor encoder/decoder (opaque, signed), `limit` max 100.
7. **Idempotency** — middleware: stores `(key, user, route, request hash) → response` in Redis/DB for 24 h; same key + different body → 422.
8. **Transactional outbox** — `outbox_events` table, `EventPublisher` that writes in the same transaction, relay worker publishing to broker, `ProcessedEvents` table for consumer dedupe.
9. **Audit log** — `AuditLogger` writing append-only `audit_logs` (actor, action, entity, before/after JSON, IP, userAgent).
10. **Feature flags** — `FeatureFlags` interface (DB/Unleash/LaunchDarkly backend) with per-country/segment targeting.
11. **Config/settings** — typed settings service for business constants (OTP limits, SLA hours, commission defaults) editable by admin, cached.
12. **Authorization base** — `Policy` pattern + permission registry; helper for ownership checks.
13. **Observability helpers** — logger with PII redaction, trace context propagation into jobs and events, metrics helper.
14. **Test kit** — builders/factories, fake clock, fake ID generator, in-memory event bus, Testcontainers base class.

## Key tests
- Property tests: `Money.allocate` sums exactly to original for any ratios; add/subtract associativity; rounding half-even.
- Idempotency: concurrent identical requests produce one execution (integration, parallel).
- Outbox: event rows committed only when business transaction commits; relay retries on broker failure; consumer processes duplicate event once.
- Audit: no UPDATE/DELETE permitted on `audit_logs` (DB grant test).
- Error handler: every exception type maps to correct status and code.

## Definition of Done
- [ ] 100% line coverage on value objects; mutation score ≥ 80%
- [ ] Outbox relay running in staging with metrics (lag, failures)
- [ ] Docs page "How to use the shared kernel" with examples

## Prompt for Claude
```
Follow CLAUDE.md. Implement 02-shared-kernel Step <n>. Write tests first.
For Money include property-based tests. Show the public API of each class.
```
