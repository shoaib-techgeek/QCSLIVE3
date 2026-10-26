# 05 — Catalog and Product Management

## Goal
Category tree with attribute schemas, products (SPU) with variants (SKU), media, moderation and bulk upload.

## SRS requirements covered
FR-CAT-01 … FR-CAT-09, FR-PDP-01/02 (data side).

## Dependencies
04

## Steps
1. **Design** — `Category` (tree, `attribute_schema` JSON Schema per category), `Brand`, `Product`, `Sku`, `ProductMedia`, `PriceHistory`; product state machine Draft → Pending → Active | Rejected; Active ↔ Inactive; Banned; soft Deleted. Events `product.created`, `product.updated`, `product.status_changed`, `price.changed`.
2. **Migrations** — categories (materialized `path`), products, skus (unique seller_sku per seller), media, price_history (append-only), brands, brand_authorizations.
3. **Domain** — variant matrix generation from option axes; attribute validation against category schema; price rules (sale price < price, > 0, within sanity range); SEO slug generation.
4. **Application** — CreateProduct, UpdateProduct (re-moderation on material change), SubmitForReview, Moderate (approve/reject with reasons), Activate/Deactivate, BulkImport (async job with row-level report), ManageCategories/Brands (admin).
5. **Automated moderation** — banned keyword list, prohibited category rules, image checks (min resolution, duplicate hash), price anomaly vs category median → flag.
6. **Media pipeline** — signed upload, async resize to WebP/AVIF sizes, CDN URLs, max 9 images + 1 video.
7. **API** — seller CRUD `/v1/seller/products`, public `/v1/products/{slug}`, `/v1/categories`, admin moderation queue.
8. **UI** — seller product form with dynamic attribute fields per category, variant matrix editor, bulk upload page with error report download; admin moderation queue; buyer PDP (with 21).
9. **SEO** — sitemap generation job, schema.org Product JSON-LD, canonical URLs.
10. **Hardening** — rich text sanitised (allow-list), load test PDP API.

## Key tests
- Unit: variant matrix for 2 axes (3 colours × 4 sizes = 12 SKUs); attribute validation per schema; illegal state transitions.
- Integration: bulk import of 5,000 rows completes, invalid rows reported with line numbers; price change writes price_history and emits `price.changed`.
- Contract: public product response matches OpenAPI.
- Security: seller cannot edit another seller's product; XSS payload in description is stripped.

## Scalability notes
- Public product reads served from cache/read model (01 §4, §6); writes go to primary.
- Category tree cached and pushed to CDN; attribute schemas versioned.

## Definition of Done
- [ ] Moderation queue usable by admin; auto-checks tested
- [ ] Bulk upload template + validator documented
- [ ] Product events consumed by search (07) in staging

## Prompt for Claude
```
Follow CLAUDE.md. Module 05-catalog Step <n>. Start with the domain: variant generation,
attribute validation against JSON Schema, and the product state machine, all with unit tests.
```
