# Module 03 — Seller Onboarding, Storefront, and Admin

## Goal
Create safe seller onboarding and the operational tools required to govern a multi-vendor marketplace.

## Step-by-step implementation
1. Define seller application fields, evidence requirements, approval states, and review SLA.
2. Implement seller application and restricted document upload.
3. Implement admin review, approval, rejection, suspension, and reactivation.
4. Store status history and reason codes; audit every privileged transition.
5. Implement seller profile/storefront settings: name, logo, description, contact/policy details.
6. Implement seller team membership and permission scopes, if multiple staff per seller are supported.
7. Add seller-level access policies for products, orders, inventory, analytics, statements, and documents.
8. Build admin user/seller/product/order lookup with strict permissions and audit.
9. Add safe support impersonation only if necessary; require explicit permission, time limit, banner, reason, and audit trail. Prefer read-only support tools.
10. Add moderation queues, search, filters, pagination, and bulk actions with safeguards.
11. Add suspension behavior: define effects on listings, new orders, active orders, balances, and payouts.
12. Add tests for cross-seller data access and admin permissions.

## Acceptance criteria
- Seller approval is required before selling.
- Seller documents are only accessible to authorized staff and the applicant where appropriate.
- Every privileged admin change is auditable.
- Seller suspension has documented, tested effects.
- Seller staff can access only the seller account and permissions granted to them.
