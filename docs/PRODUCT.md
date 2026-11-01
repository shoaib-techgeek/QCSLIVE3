# Product brief — QCS Store (Temu-style marketplace)

Own brand, own assets. Copy the *model*, never Temu's name, logo, copy or imagery.

## What "Temu-style" means here
Temu differs from a Daraz-style open marketplace in these ways. Each row maps to the module that owns it.

| Temu trait | Meaning for us | Module |
|---|---|---|
| Very low prices, deal-first home page | Home feed leads with deals, price drops, "under X" shelves | 05 Catalog, 14 Promotions, 21 Buyer web |
| Flash / lightning deals with countdown | Time-boxed price + capped stock per deal | 14, 06 Inventory |
| Free-shipping threshold, shipping bundled in price | Cart shows progress to threshold; shipping rule is config | 08 Cart, 12 Shipping |
| First-order and new-user coupons | Voucher rules incl. new-user, min spend, stacking limits | 14 |
| Gamified growth (spin, check-in, invite, credits) | Reward credits ledger, referral tracking | new: 24 Growth (design only after MVP) |
| Price-adjustment / easy returns promise | Refund-to-credit option, generous return window | 13 Returns |
| Sellers supply, platform controls price, listing quality and logistics | Seller center with platform-set pricing rules and moderation | 04, 20, 19 |
| Mobile-first, image-heavy, infinite scroll | Responsive web first, then app | 21 |
| Cross-border, multi-currency | One currency at launch; money model already currency-aware | 02 Shared kernel |

## Release phases
Build in this order. Do not start a phase before the previous one passes its exit check.

| Phase | Goal | Modules | Exit check |
|---|---|---|---|
| P0 Foundation | Safe base | 00, 02, 03 | CI green, auth done, Money/Clock/outbox exist |
| P1 Browse | Buyer can find products | 04, 05, 06, 07 (DB search), 21 (catalog pages) | Seller lists product with variants and stock; buyer searches and views it |
| P2 Buy | Real order, test payments | 08, 09, 10 (sandbox gateway), 12 | Guest-to-order journey passes E2E; no oversell under concurrency test |
| P3 Money & trust | Sellers get paid, buyers protected | 11, 13, 19, 20 | Ledger balances to zero in reconciliation test; refund path works |
| P4 Growth | The Temu feel | 14, 15, 16, then 24 | Flash deal survives load test without oversell |
| P5 Harden & launch | Go live | 17, 18, 22, 23 | Security review, load test, runbooks, backups restored once |

## MVP (end of P2) — in scope
Email+password accounts, seller listing with variants, category browse, DB search, cart, checkout with address, one payment gateway (sandbox first), order tracking, seller order handling, admin product moderation.

## Out of scope until P4+
Gamification, mobile apps, multi-currency, multi-warehouse, AI recommendations, live commerce.

## Decisions (answered 2026-11-01)
| # | Topic | Decision |
|---|---|---|
| 1 | Market | Worldwide, web only (no mobile app). Brand: **QCS Store** |
| 2 | Currency | Money is always `(minor units, ISO 4217)`. Platform base currency = PKR (legal entity is in Pakistan; config, proposed — confirm). Seller sets price in base currency; buyer-facing display currency conversion is a later feature |
| 3 | Payments | Behind a `PaymentGateway` interface. Adapters: **Fake** (default for dev/tests, no account needed), **Stripe** (test mode), **PayFast Pakistan** (local methods), **COD** |
| 4 | Shipping | Seller ships. Seller enters courier + tracking; platform tracks status. Platform may add courier integrations later |
| 5 | COD | Allowed in **Pakistan only** (country allow-list in config). Rs. 500 is recorded but unclear whether it is the COD fee or the minimum/maximum order value — see open question 2. Fraud rules apply (module 18) |
| 6 | Pricing | Seller sets price. Platform commission is **10%** of the item price (deducted from the seller on settlement; config, can be overridden per category later). Optional markup/floor is config and off by default |
| 7 | Seller vetting | Required documents: CNIC, business address, pictures, business registration document, VAT/tax number and its document. Reviewed by admin. Soft policy: an unverified seller can list in draft; publishing and payouts unlock on approval; admin can approve with conditions |
| 8 | Payout | Seller earnings release **15 days after delivery** (covers the 14-day return window). Config value |
| 9 | Returns | 14 days from delivery. Buyer pays return shipping for change-of-mind; **seller** pays for wrong/defective/not-as-described (confirmed) |
| 10 | Promotions | Free-shipping threshold and new-user coupon values: undecided, config with no default until P4 |

## Payment gateway findings
- **PayFast (premierpayfast.com)** is Pakistan-focused (PKR methods: Raast, Easypaisa, JazzCash, cards). Its docs say a sandbox exists, but base URL and test credentials are given only after merchant signup; no public test keys. It has **no webhooks** (poll `GET /transaction/{id}`), token auth + HMAC `secured_hash`, and no hosted checkout. Build against the interface; implement the adapter once credentials exist.
- **Stripe** test mode needs a free account (test keys) but no business verification. **Live Stripe requires a business in a Stripe-supported country; Pakistan is not one.** Decide the legal entity/country before go-live.
- Until accounts exist, everything is built and tested with the Fake gateway; no external call is required for P2.

## Still open
1. Rs. 500 for COD: fee, minimum order, or maximum order? (blocks 09/10 COD rules)
2. Confirm PKR as base currency, and what international (non-Pakistan) buyers pay with: Stripe live is not available to a Pakistan entity, so options are PayFast cards only, or a Stripe-supported entity abroad.
3. Does the seller need to be Pakistan-based, or can foreign sellers join? (changes KYC documents and payouts)
4. Tax: is VAT/sales tax charged to buyers, and who collects it?
5. Free-shipping threshold and coupon values (P4).

Until answered, these are config values or open questions, never hard-coded guesses.
