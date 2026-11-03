# P1 design — Seller onboarding, catalog, inventory, search, buyer catalog pages

Status: **Approved 2026-11-01.** Decisions: all new products need admin approval; starter category tree seeded (about 10 top-level); price must be > 0 only; max 8 images per product; one store per user; NTN/VAT optional but flagged.
Covers modules 04, 05, 06, 07 (DB search), 21 (catalog pages). Requirement IDs (FR-SELLER-*, FR-CAT-*, FR-INV-*) come from the module guides; the SRS file itself is not in the repo, so acceptance criteria below are derived from the guides and `docs/PRODUCT.md`.

P1 exit check (PRODUCT.md): a seller lists a product with variants and stock; a buyer searches for it and views it.

## 1. Scope cut (what P1 builds, what it defers)
| Module | In P1 | Deferred (and why) |
|---|---|---|
| 04 Seller | Register as seller, store profile, KYC documents (CNIC, business address, photos, registration doc, VAT/NTN + doc), admin review with approve / reject / conditional approve, seller status | Bank accounts and payouts (P3, ledger), warehouses (seller ships; one stock figure per SKU), staff accounts, scorecard, malware scan |
| 05 Catalog | Categories (tree), products, variants/SKUs, images, product state machine, admin moderation queue, price history | Brands/authorization, bulk import, video, automated moderation checks beyond price sanity, SEO sitemap, image resizing |
| 06 Inventory | Stock per SKU, reserve / release / commit with atomic SQL, movements ledger, seller stock update | Warehouses, reservation expiry job (needs checkout, P2), Redis flash-sale mode (P4) |
| 07 Search | MySQL FULLTEXT search + category filter + price sort + cursor pagination | OpenSearch, facets, typo tolerance, relevance tuning |
| 21 Buyer web | Home with categories, search results, category page, product page (variant picker, stock state) | Cart (P2), reviews, deals shelves (P4) |

## 2. Assumptions (change any of these before approving)
1. One currency, PKR (config `PLATFORM_CURRENCY`); prices are `price_minor` bigint + `currency`.
2. Buyers pay the seller's price. The 10% commission is taken from the seller at settlement (P3), not added to the price. Platform markup is a config value, default 0, not used in P1.
3. No warehouses: one `on_hand` per SKU.
4. Uploaded files go through a `FileStorage` interface. P1 ships a local-disk adapter (dev/test) so no cloud account is needed; an S3-compatible adapter comes later. KYC files are never publicly served; product images are.
5. CNIC and NTN numbers are encrypted at rest with AES-256-GCM, key from env `PII_ENCRYPTION_KEY`, behind an `Encryptor` interface (KMS later).
6. A user becomes a seller by creating a seller profile; role `seller` is granted on KYC approval (permission `seller:access` already exists in the frontend gating).
7. New products need admin approval (Draft → Pending → Active). Whether trusted sellers skip this is an open question (Q1).
8. Soft KYC policy (PRODUCT.md #7): a seller can create draft products before approval; they cannot submit/publish until KYC is Approved or ApprovedWithConditions. Payout gating arrives in P3.

## 3. Domain model (MySQL, Knex migrations, all reversible)
Append-only tables are marked (AO): no UPDATE/DELETE.

**Seller (04)**
- `sellers`: id, public_id (ULID), user_id (unique), store_name (unique), slug (unique), description, status (`pending`, `active`, `suspended`, `closed`), kyc_status, version, timestamps.
- `kyc_applications`: id, seller_id, status, submitted_at, reviewed_by, reviewed_at, decision_note, conditions (text), version.
- `kyc_documents`: id, application_id, kind (`cnic_front`, `cnic_back`, `business_registration`, `tax_certificate`, `address_proof`, `business_photo`), storage_key, mime, size_bytes, sha256.
- `kyc_pii`: application_id, cnic_enc, ntn_enc, business_address_enc (ciphertext + iv + tag), cnic_last4 (for masked display).
- `kyc_status_history` (AO): application_id, from, to, actor_id, note, at.

KYC state machine (pure domain class): `draft → submitted → under_review → approved | approved_with_conditions | rejected | more_info_required`; `more_info_required → submitted`; `rejected` and approvals are terminal for an application (a rejected seller starts a new application). Every transition needs an actor, and a note for anything but submit/approve.

**Catalog (05)**
- `categories`: id, parent_id, name, slug (unique), path (materialized, e.g. `/1/4/`), position, active.
- `products`: id, seller_id, category_id, title, slug (unique), description (sanitized text), status (`draft`, `pending`, `active`, `inactive`, `rejected`, `banned`), rejection_reason, version, timestamps.
- `product_options` (e.g. Color) and `product_option_values` (Red, Blue): define variant axes.
- `skus`: id, product_id, seller_sku (unique per seller), option_value_ids (JSON), price_minor, compare_at_minor (nullable), currency, active, version.
- `product_images`: id, product_id, storage_key, position, alt_text, width, height.
- `price_history` (AO): sku_id, old_minor, new_minor, currency, changed_by, at.
- `product_status_history` (AO).
- Fulltext index on `products(title, description)`.

**Inventory (06)**
- `inventory_items`: sku_id (unique), on_hand, reserved, version. CHECK `on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand`.
- `reservations`: id, order_ref, sku_id, qty, status (`reserved`, `released`, `committed`), expires_at (nullable in P1).
- `stock_movements` (AO): sku_id, delta_on_hand, delta_reserved, reason, ref, actor_id, at. Property to test: sums reproduce `on_hand`/`reserved`.

Reserve = one atomic `UPDATE inventory_items SET reserved = reserved + :q WHERE sku_id = :id AND on_hand - reserved >= :q`; 0 rows → `OUT_OF_STOCK`. Multi-line reserves run in one transaction ordered by sku_id. A real concurrency test (50 parallel reserves on stock 1 → exactly 1 success) is written first and must fail before the implementation exists.

## 4. API (all `/api/v1`, written into `docs/openapi.yaml` first)
Seller
- `POST /seller/profile` create seller profile · `GET|PATCH /seller/profile`
- `POST /seller/kyc/documents` (multipart, mime allow-list jpg/png/pdf, max 5 MB) · `PUT /seller/kyc/pii` · `POST /seller/kyc/submit` · `GET /seller/kyc`
- `GET|POST /seller/products` · `GET|PATCH /seller/products/{id}` · `POST /seller/products/{id}/submit` · `POST /seller/products/{id}/deactivate|activate`
- `POST /seller/products/{id}/images` · `DELETE /seller/products/{id}/images/{imageId}`
- `PUT /seller/skus/{id}/stock` (set on_hand, with reason)

Admin (permission `admin:access` + specific permissions)
- `GET /admin/kyc` queue · `GET /admin/kyc/{id}` (documents via authorized download, PII masked) · `POST /admin/kyc/{id}/decision` (approve | approve_with_conditions | reject | request_info + note)
- `GET /admin/products?status=pending` · `POST /admin/products/{id}/moderate` (approve | reject + reason)
- `POST|PATCH /admin/categories`

Public (no auth, cacheable)
- `GET /categories` · `GET /products?q=&category=&minPrice=&maxPrice=&sort=&cursor=&limit=` · `GET /products/{slug}` · `GET /stores/{slug}`
- Public responses never include seller private data, internal ids beyond public ids, or inactive/pending products.

Errors use the existing envelope; new machine codes: `KYC_INVALID_TRANSITION`, `SELLER_NOT_APPROVED`, `PRODUCT_INVALID_TRANSITION`, `OUT_OF_STOCK`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`.

## 5. Events (outbox)
`seller.registered`, `seller.kyc_submitted`, `seller.kyc_approved`, `seller.kyc_rejected`, `product.submitted`, `product.status_changed`, `price.changed`, `inventory.low_stock`, `inventory.out_of_stock`. P1 consumer: when a seller is approved, grant the `seller` role (via identity's exported service, not its tables).

## 6. Authorization and security
- Every seller endpoint checks the caller owns the seller/product/SKU (ownership check inside the query, 404 not 403 on foreign resources). **IDOR negative test per resource** (product, sku, image, kyc doc).
- KYC documents: private storage keys, downloaded only through an admin endpoint that audits each access; never in public URLs; PII masked in lists and logs.
- Uploads: MIME sniffed from content (not just header), size limit, random storage keys, sha256 stored.
- Description is stored as plain text in P1 (no rich text), removing the XSS surface; React escapes on render.
- Validate everything with zod; never trust client prices or stock.
- Audit events for every KYC decision, product moderation and stock adjustment.

## 7. Frontend (React, existing design system and `src/api`)
- Seller center: onboarding wizard (store profile → documents → submit → status), product list, product form with variant editor, stock editor.
- Admin: KYC queue and review page; product moderation queue.
- Buyer: home (category tiles + latest products), search results, category page, product page with variant picker and "only N left" / out-of-stock states.
- New pages reuse `ProductCard`, `DataTable`, `Tabs`, `Modal`, `EmptyState`, `Skeleton`.

## 8. Delivery plan (small PRs, each: tests first → implement → CHANGELOG/OpenAPI/status)
| PR | Content | Main tests |
|---|---|---|
| P1.1 ✅ | Seller profile + permissions + openapi | create once per user, unique store name, IDOR |
| P1.2 ✅ | `FileStorage` + `Encryptor` + KYC domain state machine (pure) | exhaustive transition table, encryption round-trip |
| P1.3 ✅ | KYC endpoints + admin decision + role grant via event | upload validation, PII masked, audit rows, e2e approve |
| P1.4 | Categories + product/SKU domain (variant matrix, price rules, state machine) | 3×4 = 12 SKUs, illegal transitions, price rules |
| P1.5 | Seller product API + images + price history + events | IDOR, `price.changed` emitted, seller-not-approved blocked |
| P1.6 | Admin moderation API | transitions, reasons required |
| P1.7 | Inventory domain + concurrency test | 50 parallel reserves on stock 1 → 1 success; movement sums |
| P1.8 | Public catalog + search API | only active products, cursor paging, fulltext, no private fields (contract test) |
| P1.9 | Frontend: seller center + admin queues | component tests, a11y basics |
| P1.10 | Frontend: buyer catalog pages + E2E journey | seller creates → admin approves → buyer finds and views |

Coverage: catalog/inventory/KYC domain code ≥ 95% line, others ≥ 85%.

## 9. Risks
- Fulltext in MySQL/MariaDB is basic (no typo tolerance, language limits); fine for launch, replace behind a `SearchIndex` interface later.
- Local-disk storage must not be used in production; the production adapter is a blocker for go-live (tracked, not hidden).
- KYC document types vary by seller country; the kind list is a starting point.
- Without Redis, hot-SKU reservations all hit one MySQL row; acceptable until flash deals (P4).

## 10. Decisions on open questions
1. Every new product needs admin approval. 2. Starter category tree seeded, admin editable. 3. Price > 0 only. 4. Max 8 images per product. 5. One store per user. 6. NTN/VAT optional; flagged for admin when missing.
