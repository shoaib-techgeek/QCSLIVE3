# P2 design — Cart, checkout, orders, payments (MVP "Buy")

Status: **Approved 2026-11-09** (questions answered in chat). Covers modules 08, 09, 10 (Fake provider + COD) and the seller-ships part of 12.
P2 exit check (PRODUCT.md): a signed-in buyer goes from product page to a placed order and follows it; no oversell under the concurrency test.

## Decisions (from the owner)
| Topic | Decision |
|---|---|
| Who | Signed-in buyers only. No guest cart, no merge. |
| Delivery area | Pakistan only. Address: full name, phone, province, city, street address. Postal code optional. |
| COD | Allowed in Pakistan. **Minimum order value Rs. 500** (config `COD_MIN_ORDER_MINOR=50000`). No COD fee. |
| Shipping fee | Each seller sets one flat fee for their store (can be 0). Buyers pay one fee per seller in the order. Free-shipping thresholds are not part of P2. |
| Tax | None in P2 (open question in PRODUCT.md). Prices are what the buyer pays. |
| Online payment | `PaymentGateway` interface with the **Fake** provider ("Pay online (test)"). Stripe and PayFast adapters wait for accounts. |

## Assumptions (config, easy to change)
- Max quantity per SKU per cart: `CART_MAX_QTY=10` (guide default; confirm).
- A quote is valid for 10 minutes; an unpaid online order's stock reservation lasts 30 minutes (guide defaults; `QUOTE_TTL_SECONDS`, `RESERVATION_TTL_SECONDS`).
- One order per checkout, split into one sub-order per seller. A buyer can cancel a sub-order until the seller marks it packed.
- The seller ships and enters courier name and tracking number. Delivery is confirmed by the seller in P2 (courier integrations come later).

## Slices (each: tests first, OpenAPI first, backend + frontend, CHANGELOG)
| Slice | Content |
|---|---|
| P2.1 Cart | `/api/v1/cart` (grouped by seller, revalidated on every read with change flags), header cart count, product-page "Add to cart", cart page |
| P2.2 Addresses and quote | buyer address book (Pakistan), seller shipping fee setting, `POST /checkout/quote` (server-side totals, valid 10 min) |
| P2.3 Place order | `POST /orders` (Idempotency-Key + quote id): order + sub-orders + order items (snapshots) + stock reservation in one transaction; state machine; events |
| P2.4 Payments | `PaymentGateway` + Fake provider, COD rule, pay-online flow, payment webhook-style confirmation, reservation expiry job wiring |
| P2.5 Order screens | buyer order list/detail with timeline and cancel; seller orders (pack, ship with tracking, deliver); admin order list |

## P2.1 detail — Cart
Tables: `carts(user_id unique)`, `cart_items(cart_id, sku_id, qty, selected, added_price_minor)` unique per (cart, sku).
Module `cart` never reads catalogue tables: it receives `skuInfoByIds` (catalogue) and `storeNames` (sellers) as functions wired in `app.ts`.

Endpoints (signed-in; every item is scoped to the caller's cart, so another user's item id is 404):
- `GET /cart` → groups by store, each item with current price, availability, `changes[]`; summary of selected, purchasable items.
- `POST /cart/items {skuId, qty}` adds (sums with an existing line). Errors: 404 NOT_FOUND (not on sale), 409 QTY_LIMIT, 409 OUT_OF_STOCK.
- `PATCH /cart/items/{itemId} {qty?, selected?, acceptPrice?}`; `DELETE /cart/items/{itemId}`.

Change codes returned per item: `PRICE_CHANGED {oldMinor,newMinor}`, `UNAVAILABLE` (product hidden/removed/seller suspended), `OUT_OF_STOCK`, `QTY_EXCEEDS_STOCK {available}`. Unavailable or sold-out items never count towards the summary.
The cart never trusts stored prices: every read recomputes from the catalogue.

## Risks
- Reservation-at-order-time means a buyer can lose the last unit between cart and checkout (expected; the quote and place-order steps re-check).
- Seller-confirmed delivery is trust-based until courier tracking exists; COD cash is not reconciled until P3.
- Stripe/PayFast are not available: online payment is test-only in P2.
