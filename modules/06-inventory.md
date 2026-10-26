# 06 — Inventory

## Goal
Accurate stock per SKU per warehouse with reservations and zero overselling, including under flash-sale concurrency.

## SRS requirements covered
FR-INV-01 … FR-INV-05, NFR-PERF-04.

## Dependencies
05

## Steps
1. **Design** — `InventoryItem` (sku, warehouse, on_hand, reserved, version), `Reservation` (order ref, qty, expires_at, status), `StockMovement` (append-only). Events `inventory.reserved`, `inventory.released`, `inventory.committed`, `inventory.low_stock`, `inventory.out_of_stock`.
2. **Migrations** — check constraints `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`; unique (sku, warehouse).
3. **Domain** — available = on_hand − reserved; reserve, release, commit (on shipment), adjust (with reason).
4. **Concurrency strategy** — conditional atomic update `UPDATE ... SET reserved = reserved + :q WHERE id = :id AND on_hand - reserved >= :q` (row count = 0 → OUT_OF_STOCK). Document in ADR.
5. **Application** — ReserveForOrder (all-or-nothing across lines, one transaction, ordered by SKU id to avoid deadlocks), ReleaseReservation, CommitReservation, AdjustStock, BulkStockUpdate.
6. **Expiry job** — releases reservations past `expires_at` (unpaid online orders, default 30 min).
7. **API** — seller `/v1/seller/inventory`, internal interface for Order module.
8. **Events** — consume `order.cancelled`, `payment.failed` → release; `shipment.created` → commit.
9. **UI** — seller stock grid with inline edit, low-stock alerts, movement history.
10. **Flash-sale mode** — Redis Lua atomic decrement for sale allocations (see 01 §7), reconciliation job DB ↔ Redis with alert on drift.

## Key tests
- Concurrency (integration, required): stock = 1, 50 parallel reservations → exactly 1 success.
- Multi-line all-or-nothing: if line 2 is out of stock, line 1 reservation is rolled back.
- Expiry job releases only expired, unpaid reservations; idempotent when run twice.
- Ledger: sum of movements equals on_hand for every item (property test over random operations).
- Load: 5,000 reservations/min on hot SKUs with zero oversell (k6).

## Definition of Done
- [ ] Concurrency tests in CI and green
- [ ] Mutation score ≥ 80% on domain
- [ ] Reconciliation job and drift alert live in staging

## Prompt for Claude
```
Follow CLAUDE.md. Module 06-inventory. First write the concurrency integration test
(50 parallel reservations on stock 1) and show it failing, then implement.
```
