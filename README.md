# QCS Store

Multi-vendor, deal-first e-commerce marketplace (Temu-style; see [docs/PRODUCT.md](docs/PRODUCT.md)). React + Vite storefront (this folder) and a Node/Fastify + MySQL API in [`backend/`](backend/README.md). Start with a reliable, secure, observable modular monolith; scale on measured bottlenecks, not guesses.

## Documentation map
| File | Purpose |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | What "Temu-style" means, release phases, MVP scope, open business decisions |
| [CLAUDE.md](CLAUDE.md) | Rules every contributor and AI agent must follow |
| [docs/adr/](docs/adr/) | Architecture decisions (stack, modular monolith, API-first backend) |
| [modules/README.md](modules/README.md) | Ordered module guides, status of each, definition of done |
| [backend/README.md](backend/README.md) | Backend setup, commands, identity API |
| [CHANGELOG.md](CHANGELOG.md) | What changed |

## Working with Claude Code
1. Read `CLAUDE.md` and the target `modules/NN-*.md` first.
2. One module, one step per task. Ask for the design first, approve, then implement.
3. A module is Done only when its checklist passes and its status is updated in `modules/README.md`.

## Run locally
1. Start MySQL (XAMPP) with databases `marketplace_dev` and `marketplace_test`.
2. Backend: `cd backend && cp .env.example .env && npm install && npm run migrate && npm run seed:dev && npm run dev` (http://localhost:4000)
3. Frontend: `npm install && npm run dev` (http://localhost:5173, proxies `/api` to the backend)
4. Optional Google sign-in: create an OAuth Web Client ID in Google Cloud Console and add `http://localhost:5173` as an authorized JavaScript origin.
   Set the same ID as `GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in the root `.env`; open the app at `localhost`, not `127.0.0.1`.

### Demo login (local development only)
Created by `npm run seed:dev` (run `npm run migrate` first; also set `PII_ENCRYPTION_KEY` from `backend/.env.example` in `backend/.env` for seller verification); it refuses to run in production.

| Email | Password |
|---|---|
| demo@example.com | Marketplace-Demo-2026 |
| admin@example.com (admin: seller verification and product review) | Marketplace-Admin-2026 |
| seller@example.com (approved demo seller with 8 live products) | Marketplace-Seller-2026 |

Email verification is currently **disabled** (`REQUIRE_EMAIL_VERIFICATION=false` in `backend/.env`): new accounts are active immediately and can sign in right after registering. Set it to `true` to require the emailed link (with `MAIL_DRIVER=log` it is printed in the backend console). The code default is `true`.

## Tests
- Frontend: `npm run lint && npm test && npm run build`
- Backend: `cd backend && npm run typecheck && npm test` (unit + integration against `marketplace_test`)

## Design system
A deal-first marketplace look: white page, red header, orange prices and actions, green trust band. Our own name, logo, copy and imagery; never another brand's.

- **Colour tokens** (`src/styles/tokens.css`, with a dark-mode override): header red `#B6030C`, orange `#FB7701` (fills) and `#E56A00` (price text), trust green `#0B8000`, black promise bar and footer, white canvas. Text links use `--link` (`#B34D00`) for AA contrast. Always use the CSS variables, never raw hex in components.
- **Type:** the platform UI font (`system-ui` stack), no web fonts.
- **Shape:** small radii (4px images and badges, 8px cards), pill buttons, search and chips.
- **Layout:** promise bar, red header (logo, links, Categories menu, search, account, cart), red hero banner, green trust band, two rails side by side, interest chips over a five-across product grid, seller band, footer. Content width 1280px.
- **Product card:** square image, one-line title, orange price with struck-through old price, rating, sold count, verified-seller badge. No fake urgency (countdowns, "only N left") and no unconfirmed claims; only decided rules are stated.
- **Components:** `Field`, `ErrorMessage`/`SuccessMessage`, `Logo`, `AuthShell`, `Layout`, `SiteFooter`, and the UI kit in `src/ui`.
- **Accessibility floor:** visible focus ring, labelled inputs, `role="alert"`/`status` for messages, skip link, AA contrast in light and dark, responsive down to mobile.
- **Copy:** plain verbs, action names stay consistent (Sign in / Create account / Sign out). Errors say what happened and what to do; no apologies.
