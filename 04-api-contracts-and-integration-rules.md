# 04 — API Contracts and Integration Rules

## 1. API conventions

Choose REST, GraphQL, or a combination intentionally and document it. REST is a practical default for commerce workflows.

- Version public contracts (`/api/v1` or a documented equivalent).
- Use consistent resource naming, pagination, sorting, filtering, and error schemas.
- Validate request bodies, path parameters, and query parameters.
- Return appropriate HTTP status codes.
- Never expose internal stack traces, SQL, secrets, or provider credentials.
- Use a correlation/request ID and include it in logs and error responses.
- Document APIs with OpenAPI and validate generated/client contracts in CI.
- Define rate limits and authentication requirements per route.
- Apply object-level permissions to every record, not only route-level role checks.

## 2. Example error shape

```json
{
  "error": {
    "code": "INVENTORY_UNAVAILABLE",
    "message": "One or more items are no longer available.",
    "requestId": "correlation-id",
    "details": []
  }
}
```

Keep user-facing messages safe and actionable. Do not leak sensitive validation internals.

## 3. Idempotency

Require an idempotency key for operations where a retry must not duplicate effects:
- order/checkout submission
- payment intent/authorization creation
- refund initiation
- payout initiation
- coupon redemption where duplicate redemption is forbidden

Store key, actor/scope, request fingerprint, state, response reference, and expiry. A reused key with a different request body must be rejected. Define retention and cleanup.

## 4. Webhooks

- Verify signatures using provider documentation and constant-time comparison where applicable.
- Validate event timestamp/replay protection where supported.
- Store event ID with a unique constraint.
- Acknowledge quickly; use durable processing for complex workflows.
- Treat webhook delivery as at-least-once and possibly out of order.
- Enforce state transition rules and idempotent side effects.
- Monitor signature failures, retries, processing delay, and dead-letter volume.
- Have a reconciliation path for missing webhooks.
- Never trust a browser redirect as proof that payment succeeded.

## 5. Background jobs and events

Each job must define:
- unique job/business key where duplicate execution matters
- timeout and retry policy
- backoff and jitter
- maximum attempts
- dead-letter/replay procedure
- structured logs and metrics
- idempotent handler behavior
- PII minimization in payloads

For reliable DB-to-queue publishing, use a transactional outbox or a documented equivalent. Do not commit a database change and then rely on an unprotected in-memory event to notify another module.

## 6. External service adapters

Create interfaces for payment, shipping, email, SMS, object storage, and search providers. Keep vendor SDK calls in adapters. Map provider errors into internal error categories. Define timeout, retry, rate limit, and reconciliation behavior for each adapter.

## 7. API security checklist

- Authentication and authorization tests for every sensitive endpoint
- Input validation and size limits
- Rate limiting / abuse detection
- CORS policy restricted to expected origins
- CSRF protection if cookie sessions are used
- No sensitive fields in response DTOs
- Safe upload handling
- Security headers at the edge/app
- No secrets in logs or error messages
- API schema diff reviewed before breaking changes
