# TradeNG API

TradeNG is a peer-to-peer escrow marketplace where sellers list items, buyers purchase directly or negotiate a price via offers, and payments are held in escrow until the buyer confirms receipt. This repository is the backend REST + WebSocket API powering the TradeNG web app — handling auth, listings, offers, real-time chat, escrow payments (via Nomba), wallet/withdrawals, disputes, reviews, and notifications.

## Links

- **Frontend (web app):** https://trade-ng-kappa.vercel.app/
- **Frontend repo:** https://github.com/dprince001/TradeNG
- **API docs (Swagger UI):** `<SERVER_URL>/api/docs` (e.g. `http://localhost:5000/api/docs` locally)
- **API base URL:** `<SERVER_URL>/api/v1`
- **Health check:** `<SERVER_URL>/api/health`

## Test accounts

Seed the database with `pnpm db:seed` (see [Getting started](#getting-started)) to populate realistic demo data. All seeded accounts share the password below:

```
Passw0rd1
```

| Email | Role |
| --- | --- |
| `adaeze.seller@tradeng.dev` | Verified seller — top performer, gadgets/electronics |
| `chidi.seller@tradeng.dev` | Verified seller — furniture/home |
| `bola.seller@tradeng.dev` | Verified seller — fashion |
| `ifeoma.seller@tradeng.dev` | Verified seller — fewer sales |
| `tunde.unverified@tradeng.dev` | Unverified — never completed signup |
| `grace.suspended@tradeng.dev` | Suspended account |
| `emeka.buyer@tradeng.dev` | Regular buyer |
| `ngozi.buyer@tradeng.dev` | Regular buyer — seller-verification pending |

The seed also creates sample listings, offers, conversations/messages, transactions in every escrow status, disputes, reviews, wallet ledger entries, withdrawal requests, notifications, category requests, and contact messages — see `src/scripts/seed.ts` for the full picture.

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in the values described below
pnpm db:seed            # optional: populate demo data
pnpm dev                 # start the dev server with hot reload
```

Other scripts:

```bash
pnpm build   # compile TypeScript to dist/
pnpm start   # run the compiled server (node dist/server.js)
```

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Variables without a listed default are required at startup.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime environment. Seeding refuses to run when this is `production`. |
| `PORT` | `3000` | Port the HTTP server listens on. |
| `APP_NAME` | `TradeNG` | Display name used in emails/notifications. |
| `FRONTEND_URL` | `http://localhost:3000` | Web app origin, used for CORS and links in emails. |
| `SERVER_URL` | `http://localhost:5000` | Public URL of this API, used for logging and generated links. |
| `API_VERSION` | `v1` | Path segment mounted under `/api`, e.g. `/api/v1`. |
| `MONGODB_URI` | — | MongoDB connection string. |
| `JWT_SECRET` | — | Secret used to sign auth JWTs. |
| `JWT_EXPIRY` | `7d` | Access token lifetime. |
| `JWT_REMEMBER_ME_EXPIRY` | `30d` | Access token lifetime when "remember me" is used. |
| `EMAILJS_SERVICE_ID` | — | EmailJS service ID for transactional emails. |
| `EMAILJS_TEMPLATE_ID` | — | EmailJS template ID. |
| `EMAILJS_PUBLIC_KEY` | — | EmailJS public key. |
| `EMAILJS_PRIVATE_KEY` | — | EmailJS private key. |
| `SMTP_FROM` | `noreply@tradeng.com` | From-address used on outgoing emails. |
| `PLATFORM_FEE_PERCENT` | `5` | Platform commission taken from each completed sale. |
| `OTP_EXPIRY_MINUTES` | `15` | Lifetime of one-time verification codes. |
| `ACCOUNT_EXPIRY_DAYS` | `7` | Days before an unverified account is auto-deleted. |
| `AUTO_RELEASE_HOURS` | `48` | Hours after receipt confirmation before escrow auto-releases to the seller. |
| `CLOUDINARY_CLOUD_NAME` | — | Cloudinary cloud name, used for listing/profile image uploads. |
| `CLOUDINARY_API_KEY` | — | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | — | Cloudinary API secret. |
| `NOMBA_CREDENTIALS_ENV` | — | Nomba environment (e.g. `development`/`sandbox`/`production`). |
| `NOMBA_CLIENT_ID` | — | Nomba payment gateway client ID. |
| `NOMBA_CLIENT_SECRET` | — | Nomba payment gateway client secret. |
| `NOMBA_ACCOUNT_ID` | — | Nomba account ID. |
| `NOMBA_BASE_URL` | `https://sandbox.nomba.com` | Nomba API base URL. |
| `NOMBA_WEBHOOK_SECRET` | — | Secret used to verify incoming Nomba webhook signatures. |
| `SUPPORT_INBOX_EMAIL` | `support@tradeng.com` | Address contact-form messages are forwarded to. |
| `SOCKET_CORS_ORIGIN` | `*` | Allowed origin(s) for the Socket.io real-time chat connection. |
| `WITHDRAWAL_MIN_AMOUNT` | `1000` | Minimum amount (₦) a seller can request as a withdrawal. |
