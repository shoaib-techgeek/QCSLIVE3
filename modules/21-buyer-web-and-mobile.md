# 21 — Buyer Web and Mobile Apps (built alongside each module)

## Goal
Fast, accessible, localized storefront on web and native apps sharing one API and design system.

## SRS requirements covered
NFR-PERF-03, NFR-PERF-07, NFR-UX-01 … NFR-UX-03, FR-SEARCH-04, FR-PDP-*, FR-CART-*, FR-ORDER-01/06, FR-ENG-*.

## Steps
1. **Design system** — tokens, components (Storybook), RTL support, accessibility built in; shared with Seller Center and Admin.
2. **API client** — generated from OpenAPI (typed), with retry for idempotent calls and Idempotency-Key for order/payment POSTs.
3. **Web (Next.js)** — SSR/ISR for home, category, PDP (SEO); client-side for cart/checkout; image optimization; CDN caching rules; Core Web Vitals budget in CI (Lighthouse CI).
4. **Mobile** — React Native / Flutter app with deep links, push notifications (FCM/APNs), secure token storage (Keychain/Keystore), offline-tolerant cart, crash reporting.
5. **Screens per module** — auth and profile (03) · home, category, search (07) · PDP (05, 14, 15) · cart (08) · checkout and payment (09, 10) · orders and tracking (09, 12) · returns (13) · chat (16) · wishlist, follow store, wallet, coins (ENG).
6. **i18n** — English + Urdu (RTL), currency/date formatting, all strings externalised.
7. **Analytics events** — client events from 22 with consent handling.
8. **Low-bandwidth mode** — compressed images, skeleton screens, lazy loading; test on throttled 3G.

## Key tests
- Component tests with Testing Library; accessibility tests with axe in CI.
- Visual regression on key screens.
- E2E: Playwright (web) and Maestro/Detox (mobile) for journeys 1, 2, 4, 7.
- Performance budget: LCP < 2.5 s on mobile 4G, JS bundle budget enforced.

## Definition of Done
- [ ] Lighthouse CI budgets enforced
- [ ] WCAG 2.2 AA automated checks pass; manual screen-reader pass on checkout

## Prompt for Claude
```
Follow CLAUDE.md. Build the <screen> for buyer web using the design system and generated API client.
Include component tests, accessibility test and a Playwright test.
```
