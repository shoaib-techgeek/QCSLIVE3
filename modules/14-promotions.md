# 14 — Promotions and Pricing Engine

## Goal
Vouchers, flash sales, campaigns, bundles and (later) gamified growth, all computed by one deterministic, explainable pricing engine with budget caps.

## SRS requirements covered
FR-PROMO-01 … FR-PROMO-07, FR-PDP-03, NFR-PERF-04.

## Dependencies
08, 09

## Steps
1. **Design** — `Voucher` (code or auto, funder: platform | seller, type: fixed | percent with cap, min spend, eligibility rules, usage limits global/per-user, window, new-user flag, budget), `Campaign`, `FlashSaleSlot` + `FlashSaleItem` (sku, price, allocated qty, per-buyer limit), `Bundle`, `Redemption`. ADR: stacking rules.
2. **Pricing engine (domain)** — input: cart lines, buyer context, time; output: line prices, applied promotions with reasons, rejected promotions with reasons, totals. Order of application documented (e.g. flash-sale price → seller discounts → bundle → seller voucher → platform voucher → shipping voucher). Pure and deterministic.
3. **Eligibility rules** — categories, sellers, SKUs, min spend, payment method, new user, region; implemented as composable specifications.
4. **Redemption** — reserve on order placement, confirm on payment, release on cancel; atomic usage counters (DB conditional update or Redis) to never exceed limits or budget.
5. **Flash sales** — admin schedules slots; sellers nominate SKUs; pre-warm Redis allocations; per-buyer limit; countdown data; see 01 §7.
6. **Campaigns** — seller opt-in, campaign pricing, landing page configuration.
7. **Price integrity** — "was" price must exist in price_history within last 30 days (FR-PROMO-07).
8. **API + UI** — voucher wallet, apply code at checkout, PDP promo badges; seller promo tools; admin campaign and budget dashboards.
9. **Gamified growth (Phase 3)** — referral credits, coins, spin wheel, group-buy price: each funded by a capped budget with fraud checks (18).
10. **Hardening** — load test voucher redemption at campaign peak; abuse tests (many accounts, same device).

## Key tests
- Unit/property: discounts never make a line or total negative; caps respected; engine output identical for same input (determinism); explanation lists every applied/rejected promo.
- Concurrency: voucher with 100 global uses, 500 parallel redemptions → exactly 100 succeed.
- Integration: flash-sale allocation of 50 units, 1,000 buyers → 50 orders, no oversell, per-buyer limit enforced.
- E2E: journey 5 from SRS §9.5.

## Definition of Done
- [ ] Stacking rules ADR approved by business
- [ ] Coverage ≥ 95%/90%; mutation ≥ 80%
- [ ] Budget exhaustion stops redemptions within seconds (tested)

## Prompt for Claude
```
Follow CLAUDE.md. Module 14-promotions. Build the pricing engine as a pure function first,
with property-based tests and a human-readable explanation output.
```
