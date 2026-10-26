# 16 — Messaging (Chat) and Notifications

## Goal
Real-time buyer–seller chat kept on-platform, and a multi-channel notification system driven by templates and preferences.

## SRS requirements covered
FR-MSG-01, FR-NOTIF-01 … FR-NOTIF-03, NFR-PRIV-02.

## Dependencies
03

## Steps — Notifications
1. **Design** — `NotificationTemplate` (event type, channel, locale, versioned), `NotificationPreference`, `NotificationLog`, in-app `InboxItem`. Channel interfaces: `SmsSender`, `EmailSender`, `PushSender` with fakes.
2. **Event mapping** — table of domain events → template → channels (e.g. `order.confirmed` → push + SMS + inbox).
3. **Dispatcher** — consumes events, renders templates, checks preferences (transactional always; marketing only with consent), enqueues per channel.
4. **Delivery** — per-channel workers with retry, provider failover, rate limiting; delivery status webhooks (bounces) update logs.
5. **UI** — notification preferences, in-app inbox; admin template editor with preview per locale.

## Steps — Chat
6. **Design** — `Conversation` (buyer, seller, optional product/order context), `Message` (text, image, product/order card), read receipts.
7. **Real-time** — WebSocket server (separate deployment), Redis pub/sub for fan-out across nodes; fallback to polling.
8. **Safety** — profanity filter, mask phone numbers/links/emails to keep transactions on-platform, report and block.
9. **UI** — buyer chat from PDP/order; seller inbox with quick replies; response-rate metric for scorecard.

## Key tests
- Unit: event → template mapping; preference logic (marketing blocked without consent); masking regexes (table-driven).
- Integration: provider failure triggers fallback; duplicate event sends one notification.
- WebSocket integration: message delivered across two server nodes.

## Scalability notes
- Notifications and WebSocket servers scale independently; notifications is an early extraction candidate.

## Definition of Done
- [ ] All order lifecycle events notify buyer and seller
- [ ] Chat masking verified; WebSocket load test (10k concurrent connections in staging)

## Prompt for Claude
```
Follow CLAUDE.md. Module 16 Step <n>. Build the notification dispatcher with fake channel senders first.
```
