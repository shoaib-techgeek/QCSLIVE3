# 12 — Shipping and Logistics

## Goal
Shipping fees, courier integrations, labels, tracking and COD remittance through a pluggable courier adapter layer.

## SRS requirements covered
FR-SHIP-01 … FR-SHIP-06.

## Dependencies
09

## Steps
1. **Design** — `ShippingZone`, `RateCard` (weight slabs, volumetric divisor), `Shipment` (sub-order, courier, tracking_no, status, cod_amount), `TrackingEvent`, `CodRemittance`. `CourierProvider` interface: `quote`, `createShipment`, `getLabel`, `cancel`, `track`, `parseWebhook`. Events `shipment.created`, `shipment.updated`, `shipment.delivered`, `shipment.failed`, `cod.remitted`.
2. **Fee calculation (domain)** — chargeable weight = max(actual, volumetric); zone lookup; free-shipping rules (seller- or platform-funded) from Promotions.
3. **Courier adapters** — first 1–2 couriers (e.g. TCS, Leopards/PostEx) + `FakeCourier`; status mapping table courier status → internal status.
4. **Shipment creation** — on Ready to Ship: create shipment, store label PDF in object storage, AWB number on sub-order.
5. **Tracking ingestion** — webhook endpoint + polling job for couriers without webhooks; dedupe events; update order state machine (09).
6. **Failed delivery flow** — reattempt rules, return-to-origin, buyer notification.
7. **COD remittance** — import courier remittance reports; match to shipments; post ledger entries (11); flag mismatches.
8. **Delivery estimate** — lane (origin city → destination city) average transit days, shown on PDP and checkout.
9. **UI** — seller: print labels/invoices in bulk, pickup scheduling; buyer: tracking timeline; admin: courier performance, rate cards.
10. **Hardening** — courier outage fallback (switch default courier via flag), timeouts and circuit breakers.

## Key tests
- Unit: chargeable weight; zone resolution; status mapping per courier (table-driven).
- Integration (WireMock courier): create shipment, duplicate tracking webhook ignored, out-of-order events handled.
- Contract tests per adapter from recorded sandbox responses.

## Definition of Done
- [ ] Two couriers live in staging sandbox
- [ ] COD reconciliation report with mismatch alert

## Prompt for Claude
```
Follow CLAUDE.md. Module 12-shipping Step <n>. Implement CourierProvider interface, FakeCourier,
and one real adapter with contract tests.
```
