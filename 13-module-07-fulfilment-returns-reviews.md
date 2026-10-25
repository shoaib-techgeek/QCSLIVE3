# Module 07 — Fulfilment, Returns, Disputes, and Reviews

## Goal
Support seller fulfilment, tracking, delivery confirmation, eligible returns, disputes, and trusted reviews.

## Step-by-step implementation
1. Define fulfilment model: seller ships, marketplace warehouse, or mixed.
2. Define shipment split rules for multi-seller and multi-package orders.
3. Implement shipment creation and item allocation.
4. Add carrier adapter or manual tracking updates for MVP.
5. Record shipment status history and normalize carrier statuses.
6. Define delivered status evidence and who can set it.
7. Define return eligibility windows, exclusions, item condition, and required evidence.
8. Implement return request, review/approval, return label or instructions, receipt, inspection, and outcome.
9. Link return outcomes to refund and inventory restock/damage workflows.
10. Implement dispute cases with reason codes, evidence access controls, deadlines, and audit.
11. Allow reviews only for eligible delivered purchases; enforce one review per defined purchase/item policy.
12. Add review moderation, reporting, and anti-abuse controls.
13. Add notification events for shipment, delivery, return status, and dispute outcomes.
14. Test partial shipment, partial return, lost shipment, failed delivery, and refund coordination.

## Acceptance criteria
- Shipment tracking is auditable and resilient to duplicate/out-of-order carrier updates.
- Returns cannot bypass policy or create duplicate refunds.
- Returned goods are not automatically restocked unless inspection/policy allows it.
- Reviews are tied to eligible purchases and can be moderated.
