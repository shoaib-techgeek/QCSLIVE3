# 20 — Seller Center (built alongside each module)

## Goal
Everything a seller needs to run a store: onboarding, listings, inventory, orders, promotions, finance, chat and analytics.

## SRS requirements covered
FR-SC-01 … FR-SC-05.

## Steps
1. **Shell** — seller login (2FA for owners), store switcher for multi-store, staff permission-aware navigation.
2. **Dashboard** — today's orders, to-ship count with SLA countdown, revenue, rating, policy warnings.
3. **Screens per module** — onboarding wizard (04) · products, variants, bulk upload (05) · stock grid (06) · order processing with bulk pack/print/ready-to-ship (09, 12) · returns queue (13) · promotions and campaign opt-in (14) · reviews and replies (15) · chat inbox (16) · finance: balance, statements, payouts (11).
4. **Analytics (Growth)** — traffic, conversion per product, search keywords.
5. **Seller API (Growth)** — OAuth2 client credentials, scopes (products, inventory, orders), rate limits, webhooks for order events, sandbox, docs portal.
6. **Ads (Phase 3)** — sponsored products with CPC bidding, budget, reporting.

## Key tests
- E2E: seller processes 20 orders in bulk and prints labels.
- API: OAuth scopes enforced; webhook signatures verifiable.

## Definition of Done
- [ ] A new seller can go from signup to first shipped order without support

## Prompt for Claude
```
Follow CLAUDE.md. Build Seller Center screens for module <n>.
```
