# QCS Live Marketplace

Multi-vendor e-commerce marketplace. React + Vite storefront (this folder) and a Node/Fastify + MySQL API in [`backend/`](backend/README.md). Development follows the module guide in `Marketplace_Module_Wise_Development_Guide.md`.

## Run locally
1. Start MySQL (XAMPP) with databases `marketplace_dev` and `marketplace_test`.
2. Backend: `cd backend && cp .env.example .env && npm install && npm run migrate && npm run seed:dev && npm run dev` (http://localhost:4000)
3. Frontend: `npm install && npm run dev` (http://localhost:5173, proxies `/api` to the backend)

### Demo login (local development only)
Created by `npm run seed:dev`; it refuses to run in production.

| Email | Password |
|---|---|
| demo@example.com | Marketplace-Demo-2026 |

Email verification is currently **disabled** (`REQUIRE_EMAIL_VERIFICATION=false` in `backend/.env`): new accounts are active immediately and can sign in right after registering. Set it to `true` to require the emailed link (with `MAIL_DRIVER=log` it is printed in the backend console). The code default is `true`.

## Tests
- Frontend: `npm test` (Vitest + Testing Library)
- Backend: `cd backend && npm test` (unit + integration against `marketplace_test`)

## Design system
Idea: a **market stall**. A striped, scalloped awning hangs under the header and across the sign-in brand panel; everything else stays quiet so that is the memorable element.

- **Colour tokens** (`src/index.css`, `:root`, with a dark-mode override): canvas `#F5F4FB`, surface `#FFFFFF`, ink `#1D1A3B`, primary electric violet `#5B3DF5`, accents mango `#FFB938`, teal `#15B8A6`, coral `#FF6F59`. Error `#B42318`, success `#0B7A55`. Always use the CSS variables, never raw hex in components.
- **Type:** Bricolage Grotesque (headings) and DM Sans (body), self-hosted via `@fontsource-variable`. Sentence case, no all-caps labels.
- **Shape and depth:** 12px controls, 20px cards, one tinted violet shadow. 48px minimum control height.
- **Layout:** auth pages use `AuthShell` (brand panel from 900px up, form card always). Content pages use `.container` (max 1040px).
- **Components:** `Field` (label, hint, error, password show/hide), `ErrorMessage`/`SuccessMessage`, `Logo`, `AuthShell`, `Layout`.
- **Motion:** one awning unfurl on load; disabled under `prefers-reduced-motion`. No other ambient animation.
- **Accessibility floor:** visible focus ring, labelled inputs, `role="alert"`/`status` for messages, skip link, AA contrast in light and dark, responsive down to mobile.
- **Copy:** plain verbs, action names stay consistent (Sign in / Create account / Sign out). Errors say what happened and what to do; no apologies.
