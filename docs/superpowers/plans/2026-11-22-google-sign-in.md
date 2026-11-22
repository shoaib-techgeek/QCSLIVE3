# Google sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers can sign up and sign in with Google and receive the normal `sid` session cookie.

**Architecture:** The frontend gets a Google ID token via Google Identity Services and posts it to `POST /api/v1/auth/oauth/google`. `AuthService.googleLogin` verifies it through an injected `GoogleVerifier`, matches by Google `sub` (table `user_identities`), else links by verified email, else creates a customer, then issues a session the same way `login` does.

**Tech Stack:** Node 22, TS strict, Fastify, Knex/MySQL, zod, Vitest, `jose` (new backend dependency, JWT verification); React 19 (no new frontend dependency, GIS script loaded at runtime).

**Spec:** `docs/superpowers/specs/2026-11-22-google-sign-in-design.md`

## Global Constraints
- Contract first: `docs/openapi.yaml` edited before the route; additive only inside `/v1`.
- Errors use `{error:{code,message,requestId,details}}` via `AppError`.
- Mutating requests keep the `X-Requested-With` guard; route uses the `limited` rate-limit config.
- Knex migration with working `down`; never edit merged migrations.
- No secrets in code: `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend) from env; `.env.example` entries empty.
- Never log the ID token or PII. Business rules in the service (no HTTP); the Google call sits behind `GoogleVerifier` with a Fake.
- Before done: backend `npm run typecheck && npm test`; frontend `npm run lint && npm test && npm run build`.
- Commit format: `feat(identity): ... [FR-AUTH-*]` plus the Co-Authored-By trailer.

## Review Focus
- Google email with `email_verified=false`: rejected 401 `GOOGLE_EMAIL_UNVERIFIED`, no user created (Task 3).
- Token for another app (`aud` mismatch), expired token, or bad signature: 401 `INVALID_GOOGLE_TOKEN` (Task 2 unit tests on the real verifier's claim checks, Task 3 route test with the fake throwing).
- A Google-only user (NULL `password_hash`) tries password login or change-password: INVALID_CREDENTIALS / INVALID_CURRENT_PASSWORD, never a 500 (Task 4).
- Two concurrent first-time sign-ins with the same `sub` or email create one user and one identity (Task 3).
- Google email differs in case from the stored email, or the existing account is suspended or deleted (Task 3).

---

### Task 1: Schema and repository

**Files:**
- Create: `backend/src/db/migrations/20261122000001_create_user_identities.ts`
- Modify: `backend/src/modules/identity/identity.repository.ts` (`UserRow.password_hash: string | null`; new functions below)
- Modify: `backend/test/integration/helpers.ts` (add `'user_identities'` before `'users'` in `resetIdentityData`)
- Test: `backend/test/integration/migrations.test.ts`, `backend/test/integration/oauth-repository.test.ts`

**Interfaces:**
- Produces (all `Db = Knex | Knex.Transaction`):
  - `findIdentity(db, provider: 'google', subject: string): Promise<{ user_id: number } | undefined>`
  - `insertIdentity(db, i: { userId: number; provider: 'google'; subject: string }): Promise<void>`: throws `ER_DUP_ENTRY` on a duplicate `(provider, subject)`
  - `insertUser` input `passwordHash: string | null`
  - `clearPasswordAndVerify(db, userId: number, now: Date): Promise<void>`: sets `password_hash` NULL, `email_verified_at = now`, `status = 'active'`, `failed_login_count = 0`, `locked_until` NULL

- [ ] **Step 1: Failing tests.** In `oauth-repository.test.ts`: `insertIdentity twice with the same (provider, subject) throws ER_DUP_ENTRY`; `insertUser accepts a null passwordHash`; `clearPasswordAndVerify nulls the hash, sets email_verified_at and status active`. Extend `migrations.test.ts` so up, down, up works for the new migration.
- [ ] **Step 2: Run** `cd backend && npx vitest run test/integration/oauth-repository.test.ts test/integration/migrations.test.ts` and expect FAIL (table missing).
- [ ] **Step 3: Migration.** `user_identities(id bigint PK, user_id bigint FK users cascade delete, provider varchar(20), provider_subject varchar(255), created_at timestamp)` with unique `(provider, provider_subject)`; `alter users.password_hash` to nullable. `down` drops the table and makes the hash NOT NULL again, but throws a clear error first if any user has a NULL hash (never silently destroy accounts).
- [ ] **Step 4: Implement** the repository functions above.
- [ ] **Step 5: Run** the same command and expect PASS. Then run `npm run typecheck`, which flags every `password_hash` usage that must now handle null (fixed in Task 4).
- [ ] **Step 6: Commit** `feat(identity): add user_identities and nullable password hash [FR-AUTH-SOCIAL]`.

### Task 2: GoogleVerifier, config and wiring

**Files:**
- Create: `backend/src/modules/identity/google-verifier.ts`
- Modify: `backend/src/config/env.ts`, `backend/src/app.ts`, `backend/.env.example`, `backend/package.json` (`npm i jose`)
- Test: `backend/test/unit/google-verifier.test.ts`, `backend/test/unit/env.test.ts`

**Interfaces:**
- Produces:
  - `interface GoogleProfile { subject: string; email: string; emailVerified: boolean; name: string | null }`
  - `interface GoogleVerifier { verify(idToken: string): Promise<GoogleProfile> }`: rejects with `AppError(401, 'INVALID_GOOGLE_TOKEN', ...)` on any failure
  - `class FakeGoogleVerifier implements GoogleVerifier` with `tokens: Map<string, GoogleProfile>`; unknown token throws INVALID_GOOGLE_TOKEN
  - `class JoseGoogleVerifier implements GoogleVerifier` constructed with `{ clientId: string; keys?: JWTVerifyGetKey }`; default keys are `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))`; checks `iss` in `['https://accounts.google.com','accounts.google.com']`, `aud === clientId`, expiry
  - `Env.GOOGLE_CLIENT_ID: string | undefined` (empty string treated as unset)
  - `AppDeps.googleVerifier?: GoogleVerifier`: when absent, `buildApp` uses `JoseGoogleVerifier` if `GOOGLE_CLIENT_ID` is set, else a verifier that always throws `AppError(503, 'GOOGLE_SIGN_IN_DISABLED', ...)`

- [ ] **Step 1: Failing tests.** `google-verifier.test.ts` signs JWTs with a locally generated key (`jose` `generateKeyPair`/`SignJWT`) and passes `keys` as a local JWKS getter. Cases: `accepts a valid token and maps sub, email, email_verified, name`; `rejects wrong audience`; `rejects wrong issuer`; `rejects expired token`; `rejects a token signed by another key`. `env.test.ts`: `treats an empty GOOGLE_CLIENT_ID as unset`.
- [ ] **Step 2: Run** `npx vitest run test/unit/google-verifier.test.ts test/unit/env.test.ts` and expect FAIL.
- [ ] **Step 3: Implement** the signatures above. Wrap every jose error in the single INVALID_GOOGLE_TOKEN error; never include the token in the message or logs.
- [ ] **Step 4: Wire** `googleVerifier` through `buildApp` into `new AuthService({ db, env, mailer, googleVerifier })`. Add `GOOGLE_CLIENT_ID=` (empty) to `backend/.env.example`.
- [ ] **Step 5: Run** the tests and expect PASS. Run `npm run typecheck`.
- [ ] **Step 6: Commit** `feat(identity): Google ID token verifier behind an interface [FR-AUTH-SOCIAL]`.

### Task 3: googleLogin service, route and contract

**Files:**
- Modify: `docs/openapi.yaml` (first), `backend/src/modules/identity/schemas.ts`, `auth.service.ts`, `auth.routes.ts`
- Test: `backend/test/integration/google-auth.test.ts`

**Interfaces:**
- Consumes: Task 1 repo functions, Task 2 `GoogleVerifier`.
- Produces:
  - `googleLoginSchema = z.object({ idToken: z.string().min(20).max(4096) })`
  - `AuthService.googleLogin(idToken: string, ctx: RequestContext): Promise<{ token: string; account: AccountView; created: boolean }>`
  - `POST /api/v1/auth/oauth/google` returns 200 `{ account }` and sets the `sid` cookie exactly as `/auth/login` does. Errors: 400 validation, 401 `INVALID_GOOGLE_TOKEN` or `GOOGLE_EMAIL_UNVERIFIED`, 403 `ACCOUNT_DISABLED`, 429, 503 `GOOGLE_SIGN_IN_DISABLED`.

- [ ] **Step 1: OpenAPI.** Add the path, the `GoogleLogin` schema and the responses beside `/auth/login`.
- [ ] **Step 2: Failing tests** in `google-auth.test.ts`, using `FakeGoogleVerifier` passed through `startTestApp` (extend `startTestApp` to accept `{ googleVerifier }`). All requests send the `x-requested-with` header.
  - `creates an active customer with a verified email, one identity and a session cookie for a new Google user`
  - `signs in again by sub without creating a second user`
  - `matches by sub even when the Google email changed`
  - `links to an existing verified password account by email, case-insensitively, keeping its password`
  - `links to an existing never-verified password account, clears its password, revokes its sessions and marks the email verified`
  - `activates a pending_verification account when linking`
  - `rejects a suspended linked account with 403 ACCOUNT_DISABLED and issues no session`
  - `rejects email_verified=false with 401 GOOGLE_EMAIL_UNVERIFIED and creates nothing`
  - `rejects an invalid token with 401 INVALID_GOOGLE_TOKEN`
  - `returns 503 GOOGLE_SIGN_IN_DISABLED when no client id is configured`
  - `rejects a request without X-Requested-With` (CSRF guard)
  - `concurrent first sign-ins for the same sub create exactly one user and one identity` (`Promise.all` of 5)
  - Audit rows: `auth.oauth_login` (every success) and `auth.oauth_link` (when linked).
- [ ] **Step 3: Run** `npx vitest run test/integration/google-auth.test.ts` and expect FAIL.
- [ ] **Step 4: Implement** `googleLogin`:
  1. Verify the token, reject unless `emailVerified`; lowercase the email.
  2. Look up identity by `sub`, else user by email, else create (`insertUser` with null hash, `assignRole('customer')`, `email_verified_at = now`, `status = 'active'`, `fullName` from the profile).
  3. When linking to a user without `email_verified_at`, call `clearPasswordAndVerify` and `revokeUserSessions`. Otherwise leave the password untouched. Insert the identity.
  4. Reject any status other than `active` or `pending_verification` with ACCOUNT_DISABLED.
  5. Run all writes in one transaction. On `ER_DUP_ENTRY` (identity or email), re-run the lookup once, since the race loser should sign in as the winner.
  6. Issue the session with the same code path as `login`. Extract the shared session-issuing block into a private method used by both.
- [ ] **Step 5: Add the route** using `limited`. Cookie options are shared with `/auth/login`.
- [ ] **Step 6: Run** the new test file plus `npx vitest run test/integration/auth.test.ts` (no regression) and expect PASS.
- [ ] **Step 7: Commit** `feat(identity): sign in and sign up with Google [FR-AUTH-SOCIAL]`.

### Task 4: Null-password safety

**Files:**
- Modify: `auth.service.ts` (`login`, `changePassword`, anywhere `password_hash` is read), `password.ts` if `verifyPassword` needs a guard
- Test: `backend/test/integration/google-auth.test.ts` (extra cases)

- [ ] **Step 1: Failing tests.** `password login for a Google-only user returns 401 INVALID_CREDENTIALS, not 500`; `change-password for a Google-only user returns 400 INVALID_CURRENT_PASSWORD`; `forgot-password then reset-password lets a Google-only user set a password and then log in with it`.
- [ ] **Step 2: Run** and expect FAIL.
- [ ] **Step 3: Implement.** When `user.password_hash` is null, `login` runs `verifyPassword` against `getDummyHash()` (same timing as an unknown email) and counts it as a failed attempt. `changePassword` throws INVALID_CURRENT_PASSWORD. Fix every typecheck error from Task 1.
- [ ] **Step 4: Run** `npm run typecheck && npm test` in `backend` and expect PASS.
- [ ] **Step 5: Commit** `fix(identity): handle accounts without a password [FR-AUTH-SOCIAL]`.

### Task 5: Frontend

**Files:**
- Create: `src/components/GoogleButton.jsx`, `src/pages/google-auth.test.jsx`
- Modify: `src/api/auth.js`, `src/auth/AuthContext.jsx`, `src/pages/LoginPage.jsx`, `src/pages/RegisterPage.jsx`, `.env.example` (frontend; add `VITE_GOOGLE_CLIENT_ID=`)

**Interfaces:**
- Produces:
  - `googleLogin(idToken)` in `src/api/auth.js` posting to `/auth/oauth/google`
  - `useAuth().googleLogin(idToken): Promise<void>`: same state updates as `login`
  - `<GoogleButton onCredential={(idToken) => Promise<void>} onError={(message) => void} />`: loads `https://accounts.google.com/gsi/client` once, calls `google.accounts.id.initialize({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, callback })` and `renderButton`; renders nothing when the env var is empty

- [ ] **Step 1: Failing tests.** With the GIS script stubbed on `window.google`: `LoginPage shows the Google button only when VITE_GOOGLE_CLIENT_ID is set`; `a credential callback calls the API with the idToken and navigates to /account`; `an API error shows a role="alert" message`; the same button present on RegisterPage.
- [ ] **Step 2: Run** `npm test -- google-auth` and expect FAIL.
- [ ] **Step 3: Implement** the interfaces above. Use existing `ErrorMessage`; put the button under the form with an "or" divider, using CSS variables only; keep it keyboard reachable (the GIS iframe is).
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` and expect PASS.
- [ ] **Step 5: Commit** `feat(web): Google sign-in button on login and register [FR-AUTH-SOCIAL]`.

### Task 6: Docs and manual check

**Files:** `CHANGELOG.md`, `modules/03-identity-auth.md` (DoD checkbox), `modules/README.md` (row 03 text: social login for Google done), `README.md` env table if one exists.

- [ ] **Step 1: Update** the docs above.
- [ ] **Step 2: Manual check:** set `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`, run both apps, open `http://localhost:5173/login` (not `127.0.0.1`), and sign in with the Google test user. Expect redirect to `/account`, then sign out and in again with no duplicate user.
- [ ] **Step 3: Commit** `docs: record Google sign-in [FR-AUTH-SOCIAL]`.
