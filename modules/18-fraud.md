# 18 — Fraud and Trust

## Goal
Risk scoring and a rules engine that protect checkout, COD, vouchers, reviews and seller payouts.

## SRS requirements covered
FR-FRAUD-01 … FR-FRAUD-03, FR-PAY-05, FR-RET-04.

## Dependencies
09, 10

## Steps
1. **Design** — signals (device fingerprint, IP, velocity, address/phone reuse, failed COD history, account age, voucher usage pattern), `RiskScore`, `Rule` (condition → action: allow, require OTP, block COD, manual review, block), `Case` for manual review.
2. **Signal collection** — client SDK for device ID; server-side velocity counters in Redis.
3. **Rules engine** — admin-editable rules, versioned, with dry-run (shadow) mode before enforcement.
4. **Integration points** — signup, login, checkout, voucher redemption, return request, payout.
5. **Manual review queue** — case management with decision reasons; feedback labels for future ML.
6. **ML scoring (Scale)** — model served behind the same interface; rules remain as guardrails.

## Key tests
- Unit: rule evaluation (table-driven); shadow mode never blocks.
- Integration: 5 orders from same device on new accounts in 10 minutes → COD blocked.
- Performance: scoring adds < 30 ms p95 to checkout.

## Definition of Done
- [ ] Rules in shadow mode for 2 weeks before enforcement, with false-positive report

## Prompt for Claude
```
Follow CLAUDE.md. Module 18-fraud Step <n>.
```
