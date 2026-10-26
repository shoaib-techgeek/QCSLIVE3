# 03 — Identity and Authentication

## Goal
Secure sign-up/sign-in for buyers, sellers and admins with OTP, passwords and social login; RBAC; profile and address book.

## SRS requirements covered
FR-AUTH-01 … FR-AUTH-08, NFR-SEC-01/02/05/06, NFR-PRIV-02.

## Dependencies
02

## Steps
1. **Design** — entities `User`, `Credential`, `Session/RefreshToken`, `Role`, `Permission`, `Address`, `OtpChallenge`; endpoints `/v1/auth/otp/request`, `/v1/auth/otp/verify`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/auth/oauth/{provider}`, `/v1/me`, `/v1/me/addresses`, `/v1/me/sessions`; events `user.registered`, `user.deleted`.
2. **Migrations** — users (unique phone, unique email, status), addresses, roles/permissions pivot, refresh_tokens (hashed, family_id, revoked_at), otp_challenges.
3. **Domain** — OTP policy (6 digits, 5-min expiry, 5 attempts, 60 s resend), password policy, refresh-token rotation with reuse detection (reuse → revoke whole family).
4. **Application** — RequestOtp, VerifyOtp (register or login), LoginWithPassword, SocialLogin, RefreshToken, Logout, ManageAddresses, DeleteAccount (30-day grace job).
5. **Infrastructure** — SMS provider adapter + fake, Argon2id hasher, breached-password check (k-anonymity API), Google/Apple OAuth verification, rate limiter (Redis sliding window) per phone and IP.
6. **API** — controllers, validation, cookie (web, httpOnly, SameSite) and bearer (mobile) token delivery, CSRF for cookie flows.
7. **RBAC** — seed roles (buyer, seller_owner, seller_staff, admin_* roles from SRS §2.1); permission middleware; TOTP 2FA mandatory for admins and seller owners.
8. **UI** — buyer login/OTP screens, profile, address book with map pin; admin login with 2FA.
9. **E2E + observability** — metrics: OTP sent/verified ratio, login failures, token reuse detections (alert).
10. **Hardening** — brute-force tests, enumeration-safe responses ("if this number exists, we sent a code"), pen-test checklist for auth (OWASP ASVS V2/V3).

## Key tests
- Unit: OTP expiry, attempts lock, resend cooldown; token rotation and reuse detection.
- Integration: 6th wrong OTP returns 429 for 15 min; refresh token reuse revokes all sessions in family.
- Security: user A cannot read/edit user B's address (IDOR); admin endpoint rejects buyer token (403).
- E2E: guest signs up via OTP and guest cart merges (with 08-cart).

## Scalability notes
- Stateless JWT validation at gateway; refresh tokens in Postgres with Redis cache.
- OTP/rate-limit counters only in Redis; SMS sending via queue with provider failover.

## Definition of Done
- [ ] All FR-AUTH ACs automated; coverage ≥ 90%
- [ ] Rate limits verified by integration tests
- [ ] 2FA enforced for admin and seller owner roles
- [ ] Account deletion job tested (data anonymised after grace period)

## Prompt for Claude
```
Follow CLAUDE.md. Module 03-identity-auth, Step 1 only: produce the design
(entities, OpenAPI for all endpoints, migrations, events, sequence for OTP and refresh rotation). Do not write code yet.
```
