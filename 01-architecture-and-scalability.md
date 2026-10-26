# 01 — Architecture and Scalability Playbook

## Goal
Define how the platform scales from launch traffic to Daraz/Temu-level traffic (millions of daily users, 10M+ SKUs, campaign spikes of 20× normal) without a rewrite. Every module file references this playbook.

## 1. Evolution path
| Stage | Traffic (indicative) | Architecture |
|---|---|---|
| Launch | < 50k daily users | Modular monolith, 1 primary Postgres + 1 replica, Redis, queue workers |
| Growth | 50k – 1M daily users | Extract Search, Notifications, Media; read replicas; CQRS read models; Kafka |
| Scale | 1M+ daily users, mega campaigns | Extract Order, Payment, Inventory, Promotion; partitioned/sharded DBs; multi-AZ, then multi-region |

Rule: extract a module into a service only when a metric (deploy contention, scaling need, team ownership, failure isolation) justifies it. Record each extraction as an ADR.

## 2. Stateless application tier
- No local session or file state; sessions/tokens in Redis or JWT, files in object storage.
- Horizontal autoscaling on CPU and requests per second; minimum 2 replicas per workload across zones.
- Separate deployments for web/API, queue workers, schedulers, and WebSocket servers so each scales independently.

## 3. Database scaling (PostgreSQL)
1. **Indexes first**: every query in hot paths has an index; `EXPLAIN ANALYZE` reviewed in PRs touching queries. No N+1 queries (detected in tests).
2. **Connection pooling**: PgBouncer in transaction mode in front of every DB.
3. **Read replicas**: read-only queries (catalog, order history, dashboards) go to replicas; writes and read-your-own-write flows go to primary.
4. **Partitioning**: time-based partitions for `orders`, `order_items`, `order_status_history`, `ledger_entries`, `stock_movements`, `outbox_events`, `audit_logs`, `tracking_events` (monthly). Old partitions archived to cold storage.
5. **Sharding (Scale stage)**: orders sharded by `buyer_id` hash, seller data by `seller_id`; use Citus or application-level sharding behind the repository interface.
6. **Database per module** once extracted; no cross-module joins ever.
7. Avoid long transactions; never call external APIs inside a DB transaction.

## 4. Caching strategy
| Data | Cache | TTL | Invalidation |
|---|---|---|---|
| Category tree, CMS, banners | CDN + Redis | 5–15 min | Event `category.updated` purges |
| Product detail (static parts) | Redis + CDN (ISR) | 10 min | `product.updated` event |
| Price and stock | Redis only, short | 5–30 s | `price.changed`, `inventory.*` events |
| Search results | Search engine cache | 30–60 s | Index refresh |
| User session/cart | Redis | sliding 30 days | On change |
| Config / feature flags | In-process + Redis | 30 s | Pub/sub broadcast |

- Pattern: cache-aside with jittered TTLs.
- Stampede protection: single-flight lock (Redis `SET NX`) or stale-while-revalidate.
- Never cache personalised data on the CDN; vary keys by locale and currency.

## 5. Event-driven design
- Transactional outbox → relay → broker (RabbitMQ at Launch, Kafka at Growth+).
- Consumers idempotent (dedupe table by `eventId`), exponential backoff, DLQ with alerting.
- Partition Kafka topics by aggregate ID to keep per-order event ordering.
- Event schemas versioned in a registry; additive changes only within a version.

## 6. CQRS read models
Heavy read screens get denormalised read models updated by events:
- Buyer order list, seller order list, seller dashboard metrics, admin GMV dashboard, product listing cards.
- Stored in Postgres read tables, Redis, or OpenSearch; eventual consistency of a few seconds is acceptable and must be shown in UI where relevant.

## 7. Flash sale and campaign architecture
1. **Pre-warm**: 30 minutes before a slot, load sale SKU stock and price into Redis; pre-render sale pages to CDN.
2. **Atomic stock**: Redis Lua script decrements sale stock and per-buyer limit in one step; DB reservation follows asynchronously, reconciled by a job.
3. **Admission control**: requests beyond capacity enter a virtual waiting room (token queue) rather than failing; show position to user.
4. **Rate limiting**: per user, per device, per IP on add-to-cart and checkout during sales.
5. **Async order creation**: accept → enqueue → process → notify; client polls/WebSocket for result.
6. **Kill switches**: feature flags to disable recommendations, reviews, chat, non-critical widgets under load.
7. **Game days**: load test every campaign at 1.5× forecast peak one week before.

## 8. Search at scale
- OpenSearch/Elasticsearch cluster with index aliases for zero-downtime reindex.
- Index updates via events (≤ 60 s freshness), bulk API batching.
- Separate indices per country/locale at Scale stage; shards sized 10–50 GB.

## 9. Media
- Direct-to-storage uploads using signed URLs; async image processing (resize, WebP/AVIF, thumbnails) in workers.
- All media served through CDN with long cache headers and content-hash file names.

## 10. Resilience
- Timeouts on every outbound call; circuit breakers; bulkheads (separate worker pools for payments vs notifications).
- Graceful degradation: browse and checkout must work if search suggestions, recommendations, reviews or chat are down.
- Multi-AZ for DB, cache and app; multi-region active-passive at Scale stage with RPO ≤ 5 min, RTO ≤ 1 h.
- Retry only idempotent operations; use idempotency keys end to end.

## 11. Capacity planning (fill in before launch)
- Open questions for the business: launch countries, expected daily users at month 1/6/12, SKUs, orders/day, peak campaign multiplier.
- From these, derive: RPS per endpoint, DB IOPS, storage growth, broker throughput, and cost per order. Re-plan quarterly.

## 12. Cost control
- Autoscaling with min/max limits; spot/preemptible instances for workers and batch jobs.
- Per-module cost dashboards; alert on cost per order above budget.

## Definition of Done (for the platform)
- [ ] ADRs for caching, eventing, partitioning, read models, flash-sale design
- [ ] Load test suite (k6) covering browse, search, add to cart, checkout, flash sale
- [ ] Chaos test: payment gateway timeout and DB failover rehearsed in staging
- [ ] Capacity plan document with numbers from the business
