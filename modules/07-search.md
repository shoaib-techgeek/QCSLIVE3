# 07 — Search and Discovery

## Goal
Fast, typo-tolerant search with facets, autocomplete, category browse, and (Growth) personalised recommendations.

## SRS requirements covered
FR-SEARCH-01 … FR-SEARCH-07, NFR-PERF-05.

## Dependencies
05, 06

## Steps
1. **Design** — index document (product id, title per locale, category path, brand, attributes, min/max price, rating, sold count, seller location, flags: free shipping, COD), ranking formula, `SearchEngine` interface. ADR: Meilisearch (MVP) vs OpenSearch (Scale).
2. **Indexer** — consumes `product.*`, `price.changed`, `inventory.out_of_stock`, `review.created` → partial updates; bulk batching; freshness ≤ 60 s.
3. **Full reindex** — job writing to new index then swapping alias (zero downtime).
4. **Query API** — `/v1/search?q=&filters=&sort=&cursor=` with facets; `/v1/search/suggest` (autocomplete, p95 < 100 ms); category listing `/v1/categories/{slug}/products`.
5. **Language** — synonyms dictionary (admin-managed), Roman-Urdu ↔ Urdu transliteration, stemming per language.
6. **Ranking** — relevance × (sales velocity, rating, seller tier, stock availability); out-of-stock demoted; boosting rules for campaigns (admin).
7. **Home feed** — admin-curated sections + "Just for you" slot (falls back to best sellers).
8. **Recommendations (Growth)** — recently viewed, similar items (attribute/embedding similarity), frequently bought together (co-purchase from analytics).
9. **UI** — search bar with suggestions, results page with filters/sort, empty-state suggestions.
10. **Hardening** — query rate limits, query logging for zero-result analysis, load tests on 10M documents.

## Key tests
- Unit: query builder maps filters/sort to engine query; ranking function.
- Integration (engine in Testcontainers): typo "samsng" finds "Samsung"; facet counts correct; out-of-stock item ranks below in-stock.
- Event test: price change visible in search within 60 s.
- Contract: response schema; Performance: p95 targets under k6.

## Scalability notes
- Search engine is the first service to extract; it reads only from events, never from the catalog DB.
- Cache popular queries for 30–60 s; shard indices per country at Scale.

## Definition of Done
- [ ] Freshness SLO monitored (lag metric + alert)
- [ ] Zero-downtime reindex rehearsed
- [ ] Zero-result query report available to admin

## Prompt for Claude
```
Follow CLAUDE.md. Module 07-search Step <n>. Keep SearchEngine behind an interface
with an in-memory fake for unit tests and the real engine in integration tests.
```
