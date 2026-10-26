# 08 — Cart

## Goal
Persistent, seller-grouped cart with live price/stock validation and guest-to-user merge.

## SRS requirements covered
FR-CART-01 … FR-CART-05.

## Dependencies
05, 06

## Steps
1. **Design** — `Cart` (user_id or guest session_id), `CartItem` (sku, qty, selected, added_price snapshot for change detection). Endpoints `/v1/cart`, `/v1/cart/items`, `/v1/cart/items/{id}`, `/v1/cart/select`, `/v1/cart/merge`.
2. **Storage** — Redis for active carts (fast) with async persistence to Postgres (durability), or Postgres only at Launch — record in ADR.
3. **Domain** — max qty per SKU (config, default 10; flash-sale limits), merge rules (sum quantities capped by max), group by seller.
4. **Application** — AddItem, UpdateQty, RemoveItem, SelectItems, MergeGuestCart, GetCart (revalidates prices, stock, product status; returns `changes[]` like PRICE_CHANGED, OUT_OF_STOCK, UNAVAILABLE).
5. **Pricing preview** — calls Promotions (14) for applicable discounts and Shipping (12) for fee estimates; degrades gracefully if they are slow (timeout → show without).
6. **API + UI** — cart page grouped by seller, select-all per seller, change banners, save for later.
7. **Abandonment (Growth)** — event `cart.abandoned` after 24 h for opted-in users.

## Key tests
- Unit: merge sums quantities and caps; selection by seller; max qty enforcement.
- Integration: product deactivated after adding → GetCart returns UNAVAILABLE change; price changed → PRICE_CHANGED with old/new.
- E2E: guest adds 2 items, logs in with existing cart of 1 → merged cart of 3 items.

## Definition of Done
- [ ] Revalidation on every read verified
- [ ] p95 GetCart < 200 ms with 50 items

## Prompt for Claude
```
Follow CLAUDE.md. Module 08-cart Step <n>. Cart must never trust stored prices: every read revalidates.
```
