# 23 — Release and Operations Checklist

## Before every production release
- [ ] All PRs linked to requirement IDs; changelog generated
- [ ] CI green: unit, integration, contract, security scans, E2E smoke
- [ ] 7 mandatory E2E journeys (SRS §9.5) green on staging
- [ ] Migrations backward compatible; rollback tested
- [ ] Feature flags in place for new customer-visible features (default off)
- [ ] Dashboards and alerts exist for new endpoints/consumers
- [ ] Runbook updated

## Before MVP launch (Gate G1)
- [ ] Load test at 2× forecast launch traffic passed (browse, search, cart, checkout)
- [ ] Third-party penetration test done; high/critical findings fixed
- [ ] Backup restore drill completed (RTO ≤ 1 h verified)
- [ ] Payment and courier sandbox → production cutover checklist done
- [ ] On-call rotation, incident process and status page ready
- [ ] Legal: terms, privacy policy, return policy, seller agreement published

## Before every big campaign (11.11, Ramadan, etc.)
- [ ] Capacity forecast from business; load test at 1.5× forecast peak one week before
- [ ] Flash-sale pre-warm job rehearsed; waiting room tested
- [ ] Non-critical features mapped to kill-switch flags
- [ ] Code freeze 48 h before; war room and escalation contacts set
- [ ] Payment gateway and couriers informed of expected volume

## Incident runbooks (in docs/runbooks)
- Payment gateway down or slow · Webhook backlog · Courier API outage
- DB primary failover · Redis failure · Broker lag / DLQ growth
- Flash-sale overload · Search cluster red · Suspicious fraud spike

## After every incident
- [ ] Blameless postmortem within 5 working days
- [ ] Action items ticketed with owners and dates
