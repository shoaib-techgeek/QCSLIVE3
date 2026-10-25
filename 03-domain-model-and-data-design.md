# 03 — Domain Model and Data Design

## 1. Data design process

Before implementing each module:
1. List business entities and their lifecycle.
2. Identify which module owns each entity and its writes.
3. Draw an ERD and mark cardinalities.
4. Define primary keys, foreign keys, uniqueness, checks, indexes, and deletion behavior.
5. Define sensitive fields, retention, access rules, and audit needs.
6. Define transaction boundaries and concurrency behavior.
7. Create migrations and test both fresh installation and upgrade from the previous schema.
8. Seed only synthetic test data.
9. Capture query plans for high-volume queries as data grows.

## 2. Core entity inventory

### Identity
- `users`
- `user_credentials` or framework-managed auth data
- `roles`, `permissions`, `role_permissions`, `user_roles`
- `user_sessions` / refresh-token records if applicable
- `addresses`
- `consents` / notification preferences

### Seller
- `sellers`
- `seller_members`
- `seller_verification_documents` (restricted access)
- `seller_store_profiles`
- `seller_status_history`
- `seller_policies`

### Catalogue
- `categories`
- `category_closure` or a supported tree representation if needed
- `brands`
- `products`
- `product_variants` / SKUs
- `product_attributes`
- `product_attribute_values`
- `product_media`
- `product_category_assignments`
- `product_moderation_events`
- `product_status_history`

### Pricing and inventory
- `price_lists` or price records
- `inventory_items` / stock by SKU and location
- `inventory_movements`
- `inventory_reservations`
- `stock_locations`
- `promotion_campaigns`
- `coupons`
- `coupon_redemptions`
- `promotion_rules`

### Commerce
- `carts`
- `cart_items`
- `checkout_sessions`
- `shipping_quotes`
- `orders`
- `order_items`
- `order_addresses_snapshot`
- `order_status_history`
- `payments`
- `payment_attempts`
- `payment_webhook_events`
- `refunds`
- `shipments`
- `shipment_items`
- `shipment_tracking_events`
- `returns`
- `return_items`
- `disputes`
- `reviews`

### Finance
- `commission_rules`
- `commission_calculations`
- `ledger_accounts`
- `ledger_entries`
- `seller_statements`
- `payouts`
- `payout_items`
- `financial_reconciliation_runs`

### Operations
- `notifications`
- `notification_attempts`
- `support_tickets`
- `support_messages`
- `audit_events`
- `outbox_events`
- `inbox_deduplication`
- `feature_flags`
- `idempotency_records`

This list is a starting inventory, not a mandate to create every table at once. Implement only the entities required for the current module.

## 3. Data rules that must be explicit

- Money: use fixed-point decimal or integer minor units consistently; store ISO currency code. Define rounding and conversion rules.
- Product snapshots: order items must preserve SKU/title/variant/price/tax/discount/commission details as purchased, even if the catalogue later changes.
- Address snapshots: preserve the shipping/billing address used for the order, subject to privacy policy.
- Inventory: distinguish on-hand, reserved, available, damaged, and returned stock if operationally relevant.
- State: use explicit enums or reference tables and controlled transitions; do not allow arbitrary status strings.
- Soft delete: use only where it supports a clear business/legal requirement; define uniqueness and retention implications.
- Audit: record actor, action, target, timestamp, correlation/request ID, and a safe before/after summary where appropriate.
- IDs: use stable non-sequential public identifiers if exposing sequential IDs creates a privacy or enumeration risk. Internal IDs may differ.
- Timestamps: UTC storage and explicit timezone at presentation.
- Multi-seller order: decide whether one customer checkout creates a parent order with seller sub-orders or separate orders; document shipment, refund, commission, and payout consequences.

## 4. Indexing principles

Create indexes from actual query patterns and query plans, not guesswork alone. Typical candidates:
- Unique SKU within the agreed scope
- Product status + category + sort key
- Product seller + status
- Inventory SKU + location
- Cart user + active status
- Orders customer + created timestamp
- Orders seller + status + created timestamp
- Payment provider reference unique where guaranteed
- Webhook provider event ID unique
- Ledger account + posted timestamp
- Payout seller + status
- Audit entity + timestamp

Review index write overhead and avoid redundant indexes.

## 5. Transaction boundaries to design carefully

### Checkout/order creation
- Revalidate product status, price, promotion eligibility, address, shipping quote, and stock.
- Reserve stock atomically or use an equivalent concurrency-safe method.
- Create order/order items and persist a checkout idempotency result.
- Ensure retries do not create duplicate orders or duplicate reservations.
- Define what happens if payment authorization fails or times out.

### Payment webhook
- Verify provider signature and timestamp/replay protections.
- Record the provider event with a unique event ID.
- Process idempotently.
- Update payment/order state using a valid transition.
- Publish follow-up work via transactional outbox.
- Return the provider's expected response quickly; perform slow work asynchronously if required.

### Refund and seller finance
- Enforce refundable amount and policy eligibility.
- Record refund request and provider reference.
- Do not mark a refund complete until provider outcome is confirmed.
- Post ledger entries exactly once.
- Reconcile provider reports with internal payments/refunds.

## 6. Migrations

- Never edit an already-applied production migration as the only way to change schema.
- Prefer expand → deploy compatible code → backfill → switch reads/writes → contract.
- Backfills must be resumable, observable, and rate-limited.
- Test rollback strategy; some data migrations are not safely reversible, so document forward-fix procedures.
- Verify constraints/indexes against realistic data volume before large production migrations.
