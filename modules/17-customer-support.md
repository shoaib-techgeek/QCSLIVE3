# 17 — Customer Support

## Goal
Help center, ticketing tied to orders, agent console and dispute handling.

## SRS requirements covered
FR-CS-01 … FR-CS-03.

## Dependencies
09, 13

## Steps
1. **Design** — `HelpArticle` (CMS, locale), `Ticket` (requester, order ref, category, priority, status, SLA), `TicketMessage`, `Macro`. Permission: refund limit per agent.
2. **Help center** — searchable FAQ, article feedback ("was this helpful").
3. **Ticketing** — create from order page or help center; auto-categorise; SLA timers and escalation.
4. **Agent console** — 360° view: buyer, orders, payments, shipments, returns, chat history; actions within permission (refund ≤ limit, reship, cancel), all audited.
5. **Disputes** — evidence from buyer and seller, decision recorded, ledger effects via 11.
6. **AI assistant (Growth)** — bot answers order status and FAQs using tools (read-only APIs), hands off to human with context.
7. **Reporting** — first response time, resolution time, CSAT.

## Key tests
- Authorization: agent cannot refund above limit (maker-checker triggered).
- Integration: ticket SLA breach escalates.

## Definition of Done
- [ ] Agents can resolve top 10 contact reasons without engineering help

## Prompt for Claude
```
Follow CLAUDE.md. Module 17-customer-support Step <n>.
```
