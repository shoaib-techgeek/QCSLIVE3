# 15 — Reviews and Ratings

## Goal
Verified-purchase reviews with media, seller replies and moderation, feeding product and seller ratings.

## SRS requirements covered
FR-REV-01 … FR-REV-04.

## Dependencies
09

## Steps
1. **Design** — `Review` (order_item, rating 1–5, text, media, status: Pending → Published | Rejected | Hidden), `SellerReply`, `HelpfulVote`, `ReviewReport`, `SellerRating`. Events `review.published`.
2. **Domain** — eligibility: order item Delivered, one review per order item, within 90 days; edit window.
3. **Moderation** — automated checks (profanity, PII like phone numbers, links, spam similarity) → auto-publish or queue; admin moderation queue.
4. **Aggregation** — rating average and distribution updated via event into product read model and search (07); Bayesian average for ranking.
5. **API + UI** — write review after delivery (prompted by notification), PDP reviews with filters (with photos, star), seller reply, report abuse.
6. **Fake review detection (Growth)** — same device/IP clusters, burst patterns → flag (with 18).

## Key tests
- Unit: eligibility rules; aggregation math.
- Integration: review on non-delivered item rejected (403); PII masked before publish.
- Security: buyer cannot edit another buyer's review.

## Definition of Done
- [ ] Ratings visible on PDP and in search ranking
- [ ] Moderation queue in admin

## Prompt for Claude
```
Follow CLAUDE.md. Module 15-reviews Step <n>.
```
