# 06 — DevOps, Observability, and Release

## 1. Environments

Maintain isolated environments:
- local development
- CI/test
- staging/pre-production
- production

Separate databases, buckets, queues, credentials, domains, and payment provider modes. Production secrets must not be available to untrusted pull requests.

## 2. Deployment approach

- Make builds reproducible and versioned.
- Deploy immutable artifacts where possible.
- Use health/readiness checks.
- Run migrations as a controlled release step.
- Prefer backward-compatible expand/contract migrations.
- Use rolling or blue/green deployment when supported.
- Keep a documented rollback and forward-fix procedure.
- Use feature flags for high-risk changes.
- Require approval for production database and payment changes.

## 3. Observability

### Structured logs
Include timestamp, severity, service/app version, environment, request/correlation ID, actor ID when safe, operation, outcome, duration, and error category. Redact personal/payment data.

### Metrics
Track:
- request rate, error rate, p50/p95/p99 latency
- database connection pool and slow query metrics
- queue depth, age of oldest job, retries, dead letters
- checkout attempts and completion
- payment success/failure/pending rates
- inventory reservation conflicts
- webhook processing lag and signature failures
- refund/payout/reconciliation mismatches
- notification delivery/failure
- CPU, memory, disk, network, cache hit ratio

### Tracing
Trace cross-module and provider calls for checkout, payment, fulfilment, refund, and payout paths where the stack supports distributed tracing.

### Alerting
Alerts should have an owner, severity, runbook, and actionable threshold. Avoid noisy alerts that nobody responds to.

## 4. Backup and recovery

- Define recovery point objective (RPO) and recovery time objective (RTO) with the business.
- Back up database and required object data.
- Encrypt backups and restrict access.
- Keep copies isolated from production credentials.
- Test restoration on a schedule; a backup that has never been restored is unverified.
- Document recovery order: database, object storage, queue/outbox recovery, application, provider reconciliation.
- Define retention and deletion policies.

## 5. Incident response

Document:
- severity levels and escalation contacts
- how to disable a risky feature
- how to pause checkout or payouts safely
- how to rotate secrets
- how to inspect stuck jobs and replay dead letters
- how to reconcile payments/refunds after an outage
- how to communicate customer-impacting incidents
- post-incident review and corrective actions

## 6. Launch checklist

- [ ] Product policies approved (shipping, cancellation, returns, refunds, commissions, seller verification)
- [ ] All MVP requirements mapped to tests
- [ ] CI gates passing
- [ ] Security review completed
- [ ] Privileged accounts protected with MFA
- [ ] Payment sandbox and production configurations verified separately
- [ ] Webhook signature and duplicate-event tests pass
- [ ] Inventory concurrency tests pass
- [ ] Backup restoration tested
- [ ] Monitoring, alerting, and runbooks ready
- [ ] Load test completed against agreed targets
- [ ] Privacy, terms, returns, seller agreements, and legal review complete
- [ ] Customer support process staffed
- [ ] Rollback/forward-fix plan reviewed
- [ ] No known critical/high-risk defects without explicit sign-off
