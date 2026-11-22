# Google sign-in / sign-up for customers

Module 03 (identity-auth), `SocialLogin` / `/v1/auth/oauth/{provider}`.

## Intent
Customers can register and sign in with Google, ending in the same session cookie as `/auth/login`, with the `customer` role.

## Goals / non-goals
- Goals: Google sign-in and sign-up on LoginPage and RegisterPage; match by Google `sub`; auto-link to an existing account by verified email.
- Non-goals: Apple, unlinking, OTP, seller/admin social login.
- Anti-goal: account takeover through an unverified pre-registered password account.

## Approaches
1. Google Identity Services button, ID token verified by the backend (chosen: headless-API friendly, no redirect pages, ADR-0003).
2. Server-side authorization-code redirect flow: needs redirect and callback pages, rejected.
3. Link only after password confirmation: safest but extra screens, rejected by the user.

## Decisions
- `POST /api/v1/auth/oauth/google` body `{idToken}`; rate limited like other auth routes; contract added to `docs/openapi.yaml` first.
- Backend verifies signature, `aud` = `GOOGLE_CLIENT_ID`, `iss`, expiry and `email_verified=true` behind a `GoogleVerifier` interface (Fake for tests).
- Migration: `user_identities(id, user_id, provider, provider_subject UNIQUE with provider, created_at)` and `users.password_hash` nullable (reversible `down`).
- Flow: identity by `sub` found: sign in. Else user by email found: link (account must be active); if that account never had a verified email (`email_verified_at` NULL), clear its password hash and revoke its sessions first. Else create an active user with the `customer` role and `email_verified_at` set.
- Password login on a user with NULL hash returns INVALID_CREDENTIALS (the same timing path as an unknown email).
- Disabled accounts get ACCOUNT_DISABLED. Audit `auth.oauth_login` and `auth.oauth_link`.
- Frontend: `src/api` function, a `GoogleButton` component in `src/components`, `VITE_GOOGLE_CLIENT_ID`. Button hidden when unset.

## Left to the builder
Library choice for JWT verification (prefer `google-auth-library` or `jose`), exact error codes, UI copy.
