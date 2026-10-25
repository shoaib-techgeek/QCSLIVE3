# Module 01 — Engineering Foundation and Identity

## Goal

Create a reproducible development baseline and secure user identity/authorization before building commerce features.

## Prerequisites
- Project charter and technology stack decisions approved.
- Repository inspected; existing code and constraints documented.

## Step-by-step implementation
1. Establish repository structure and branch/PR policy.
2. Configure formatter, linter, static analysis, type checking, and test runner.
3. Create local and CI configuration with environment-variable validation.
4. Add health/readiness endpoints and a minimal application boot path.
5. Configure database connection, migration runner, and synthetic seed mechanism.
6. Implement registration, login, logout, password reset, and email/phone verification as required.
7. Use maintained framework authentication and password-hashing features.
8. Implement role/permission policy primitives, but prefer permissions over scattered hard-coded role-name checks.
9. Add authorization middleware/policies and object-level access checks.
10. Implement session/token rotation, expiration, revocation, and secure cookie behavior as applicable.
11. Add login/OTP rate limiting, audit events, and security logging.
12. Add account status handling: active, suspended, pending verification, deleted/anonymized as policy requires.
13. Add account profile and address book.
14. Add tests for authentication, authorization, lockout/rate limits, and account recovery.
15. Document setup, commands, configuration, migrations, and troubleshooting.

## Acceptance criteria
- A new developer can run the app and tests from documented instructions.
- CI runs the required quality gates.
- Unauthenticated requests cannot access protected resources.
- Users cannot read or modify another user's private records.
- Privileged actions are permission-checked and audited.
- Secrets are not committed or logged.
- Password reset and verification tokens expire and cannot be reused.
- All core identity tests pass.

## Required tests
- Unit: password/verification token policy where custom logic exists; permission decisions.
- Integration: register/login/logout/reset flows; session/token revocation.
- Security: brute-force/rate-limit behavior; object-level authorization; session cookie settings.
- E2E: register, verify, sign in, update profile, sign out.

## Deliverables
- Working app skeleton, CI configuration, migrations, auth and permissions, API docs, tests, local setup guide.
