# Module 02 — Catalogue, Media, and Search

## Goal
Enable approved sellers and authorized staff to create structured listings that customers can reliably discover.

## Prerequisites
- Identity/permissions module complete.
- Seller ownership model established.

## Step-by-step implementation
1. Define category hierarchy, category attributes, brands, and product moderation rules.
2. Define product, variant/SKU, attribute, media, and category-assignment schemas.
3. Specify which attributes are variant-defining (e.g., size/color) and which are descriptive.
4. Implement draft, pending-review, approved, rejected, inactive, and archived listing states.
5. Implement seller-owned product CRUD with server-side seller scope.
6. Validate required fields, SKU uniqueness, variant combinations, price/currency, and allowed category attributes.
7. Implement media upload through object storage; validate size, file signature, format, dimensions, and permissions.
8. Generate safe image variants/thumbnails asynchronously where appropriate.
9. Implement moderation queue, rejection reasons, audit history, and resubmission.
10. Implement public product/category pages with SEO metadata and canonical URL rules.
11. Start with database-backed search only if expected scale/relevance allows it; keep a search interface so a dedicated engine can replace it.
12. Implement filters, sorting, pagination, category facets, brand, price range, availability, and seller filters.
13. Prevent unpublished/rejected/private products from appearing in public search or feeds.
14. Add caching only after defining invalidation behavior for product updates and stock/price changes.
15. Add tests for ownership, moderation, media validation, search visibility, and pagination.

## Acceptance criteria
- Seller A cannot edit or see private data for Seller B's listings.
- Only approved, active listings are publicly discoverable.
- Variant/SKU identity and pricing are unambiguous.
- Media is stored outside the relational database and served securely.
- Search filters/sort/pagination are stable and tested.
- Catalogue changes invalidate or refresh cached/search documents correctly.

## Required tests
- Unit: variant validation, slug generation, moderation transitions.
- Integration: product CRUD, media upload, search queries, indexing/update behavior.
- Security: seller isolation, upload spoofing, oversized files, unauthorized media access.
- E2E: seller creates listing, moderator approves, customer searches and opens product.
