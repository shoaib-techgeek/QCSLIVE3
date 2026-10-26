# 22 — Analytics and Events

## Goal
Trustworthy business metrics and a data pipeline for dashboards, recommendations, fraud and A/B tests, kept separate from transactional databases.

## SRS requirements covered
FR-ANL-01 … FR-ANL-03, FR-ADMIN-01, NFR-PRIV-03.

## Dependencies
09

## Steps
1. **Tracking plan** — versioned event schema (view_item, search, add_to_cart, begin_checkout, add_payment_info, purchase, refund, etc.) with required properties; documented in repo.
2. **Collection** — client SDK (web/mobile) with consent gating; server-side events from the outbox for money-related truth.
3. **Pipeline** — events → broker → warehouse (BigQuery/ClickHouse/Redshift); CDC from OLTP for dimensions; PII pseudonymised.
4. **Modeling** — dbt models: orders fact, GMV, AOV, conversion funnel, cohort retention, seller performance.
5. **Dashboards** — admin real-time dashboard (from read models) and BI dashboards (from warehouse).
6. **Experimentation (Growth)** — A/B framework on top of feature flags, assignment logging, metric guardrails.

## Key tests
- Schema validation tests for every event; data quality tests in dbt (not null, unique, accepted values).
- Reconciliation: warehouse GMV vs ledger within 0.1% daily.

## Definition of Done
- [ ] Tracking plan reviewed by business; GMV reconciles with ledger

## Prompt for Claude
```
Follow CLAUDE.md. Module 22-analytics Step <n>.
```
