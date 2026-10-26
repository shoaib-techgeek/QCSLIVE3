# 00 — Project Setup

## Goal
A repository where an empty "hello" module passes the full CI pipeline and deploys to staging. Every later module plugs into this.

## Steps

### Step 1 — Decide and record the stack (ADR-001)
1. Choose Option A (Laravel + PostgreSQL + Redis + Next.js) or Option B (NestJS + PostgreSQL + Redis + Next.js) from SRS §3.1.
2. Write `docs/adr/0001-tech-stack.md`: context, decision, consequences.
3. Record ADR-002 "Modular monolith first, extract services later".

### Step 2 — Repository layout
```
/apps
  /api            # backend (modular monolith)
  /web            # buyer web (Next.js)
  /seller         # seller center
  /admin          # admin console
  /mobile         # React Native / Flutter
/modules          # backend modules (inside apps/api if framework requires)
/packages         # shared UI kit, API client (generated), config
/infra            # Terraform/Pulumi, Kubernetes manifests, Helm charts
/docs             # adr/, runbooks/, c4/, openapi/
/tests/e2e        # Playwright journeys
docker-compose.yml
CLAUDE.md
```

### Step 3 — Local environment
1. `docker-compose.yml` with Postgres 16, Redis 7, RabbitMQ/Kafka, OpenSearch/Meilisearch, MinIO (S3), Mailpit, WireMock.
2. One command to boot: `make up` → migrations + seed fixtures.
3. `.env.example` with every variable documented; real `.env` git-ignored.

### Step 4 — Code quality tooling
1. Formatter + linter + static analysis (PHP-CS-Fixer + PHPStan L8 + Rector, or ESLint + Prettier + `tsc --strict`).
2. Pre-commit hooks (lint-staged / GrumPHP / Husky).
3. Architecture tests that fail if a Domain class imports framework code or a module imports another module's internals (Pest arch tests / deptrac / dependency-cruiser).

### Step 5 — Test harness
1. Unit test runner with coverage (Pest/PHPUnit or Vitest/Jest).
2. Testcontainers setup for integration tests.
3. Playwright project in `/tests/e2e` with one smoke test.
4. Mutation testing configured (Infection / Stryker) for later critical modules.

### Step 6 — CI pipeline (GitHub Actions / GitLab CI)
Jobs in order: install (locked) → lint/types → unit + coverage gate → integration → contract (OpenAPI) → SAST (Semgrep) → SCA (Snyk/Trivy) → secret scan (gitleaks) → build Docker image (tag = git SHA) + SBOM → deploy preview → E2E smoke.

### Step 7 — Environments and deploy
1. Infrastructure as code for staging and production.
2. Managed Postgres with PITR backups, managed Redis, object storage + CDN.
3. Canary/rolling deploy with automatic rollback on error-rate SLO breach.
4. Secrets in a secret manager (AWS Secrets Manager / Vault / Doppler).

### Step 8 — Observability baseline
1. OpenTelemetry SDK; traces to Tempo/Jaeger, metrics to Prometheus, logs to Loki/ELK, errors to Sentry.
2. `/health/live` and `/health/ready` endpoints.
3. Grafana dashboard template: RED metrics per endpoint.

## Definition of Done
- [ ] ADR-001 and ADR-002 merged
- [ ] `make up` boots full stack locally in < 15 minutes on a fresh machine
- [ ] CI runs all jobs and blocks merge on failure
- [ ] Architecture tests enforce module boundaries
- [ ] Hello endpoint deployed to staging with traces and logs visible
- [ ] Branch protection on `main`

## Prompt for Claude
```
Follow CLAUDE.md. Task: 00-project-setup Step <n>. Stack: <chosen stack>.
Produce the files for this step only, explain each, and give me commands to verify it works.
```
