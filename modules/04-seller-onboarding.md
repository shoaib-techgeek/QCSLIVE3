# 04 — Seller Onboarding and Store Management

## Goal
Sellers register, pass KYC, add bank accounts and warehouses, and get a public store page; admins review KYC.

## SRS requirements covered
FR-SELLER-01 … FR-SELLER-06, NFR-SEC-02 (encrypted PII), NFR-SEC-07 (uploads).

## Dependencies
03

## Steps
1. **Design** — `Seller`, `SellerUser` (staff with scoped permissions), `KycApplication` + `KycDocument`, `BankAccount`, `Warehouse`, `StorePage`; KYC state machine: Draft → Submitted → UnderReview → Approved | Rejected | MoreInfoRequired; events `seller.registered`, `seller.kyc_approved`, `seller.kyc_rejected`, `seller.suspended`.
2. **Migrations** — sellers (unique slug/store_name), seller_users, kyc tables (document refs only), bank_accounts (IBAN encrypted), warehouses (address + geo).
3. **Domain** — KYC transitions with reasons; store name rules; seller status (Active, Suspended, Closed) gating listings and payouts.
4. **Application** — RegisterSeller, SubmitKyc, ReviewKyc (admin), AddBankAccount + VerifyBankAccount (name match), InviteStaff, ManageWarehouses, UpdateStorePage.
5. **Infrastructure** — signed-URL uploads to private bucket, malware scan job, field-level encryption for CNIC/NTN/IBAN using KMS.
6. **API** — seller endpoints `/v1/seller/...`, admin endpoints `/v1/admin/sellers/...`, public `/v1/stores/{slug}`.
7. **Admin UI** — KYC review queue with document viewer, approve/reject with reason, maker-checker for reactivation.
8. **Seller UI** — onboarding wizard (business info → KYC → bank → warehouse → done), staff management.
9. **Scorecard (Growth)** — nightly job computing cancellation rate, late-ship rate, response rate, rating → tier; violation points and auto-restrictions.
10. **Hardening** — PII access audited; KYC documents never public; retention policy.

## Key tests
- Unit: illegal KYC transitions rejected; unapproved seller cannot publish listings or receive payouts.
- Integration: uploaded file with wrong MIME is rejected; encrypted columns unreadable without key.
- Security: seller staff with "orders only" permission cannot edit listings (403).
- E2E: seller signs up → submits KYC → admin approves → seller can create a product.

## Definition of Done
- [ ] KYC flow end to end in staging
- [ ] PII encrypted at rest, masked in logs and admin lists
- [ ] Audit log entries for every KYC decision

## Prompt for Claude
```
Follow CLAUDE.md. Module 04-seller-onboarding Step <n>. Implement the KYC state machine
as a pure domain class with exhaustive transition tests first.
```
