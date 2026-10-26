# 19 — Admin Console (built alongside each module)

## Goal
One secure console for operations, catalog, finance, marketing and support, with RBAC, audit and maker-checker.

## SRS requirements covered
FR-ADMIN-01 … FR-ADMIN-05, NFR-SEC-01 (L3), FR-AUTH-06.

## Steps
1. **Shell** — layout, navigation by permission, 2FA login, session timeout, global search (order no, phone, SKU).
2. **Shared components** — data table (server pagination, filters, CSV export), detail drawer, audit trail panel, approval (maker-checker) component.
3. **Screens per module** (ship each with its module):
   - Users and roles (03) · Seller KYC queue, sellers, scorecards (04)
   - Categories, attributes, brands, moderation queue (05)
   - Orders, sub-orders, cancellations (09) · Payments, refunds, reconciliation (10)
   - Commission rules, settlements, payouts (11) · Couriers, rate cards, zones (12)
   - Returns, disputes (13) · Vouchers, campaigns, flash sales, budgets (14)
   - Review moderation (15) · Notification templates (16) · Tickets (17) · Fraud rules and cases (18)
   - CMS: banners, home sections, help articles · Feature flags and settings
4. **Dashboards** — GMV, orders, AOV, conversion, cancellation rate, top sellers/categories from read models (22).
5. **Audit** — every mutating action writes audit log; viewer with filters.

## Key tests
- Authorization matrix test: each admin role × each endpoint → expected allow/deny (generated, table-driven).
- E2E: journey 6 from SRS §9.5.

## Definition of Done
- [ ] Permission matrix test in CI
- [ ] Every mutation audited (test asserts audit row)

## Prompt for Claude
```
Follow CLAUDE.md. Build admin screens for module <n> using the shared admin components.
```
