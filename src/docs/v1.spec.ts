// OpenAPI 3.0 specification for TradeNG API v1

const envelope = (dataSchema: object | null, description: string) => ({
  type: "object",
  description,
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string", example: "Success" },
    data: dataSchema ?? { nullable: true, example: null },
    pagination: {
      nullable: true,
      example: null,
      oneOf: [
        { $ref: "#/components/schemas/PagePagination" },
        { $ref: "#/components/schemas/CursorPagination" },
      ],
    },
    code: { type: "integer", example: 200 },
    status: { type: "string", example: "OK" },
    error_stack: { type: "string", nullable: true, example: null },
    error_log_time: { type: "string", nullable: true, example: null },
    api_version: { type: "string", example: "v1" },
  },
});

const errorEnvelope = (
  code: number,
  statusText: string,
  description: string,
  includeErrors = false,
) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: description },
          data: includeErrors
            ? {
                type: "array",
                nullable: true,
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string", example: "email" },
                    message: {
                      type: "string",
                      example: "Invalid email address",
                    },
                  },
                },
              }
            : { nullable: true, example: null },
          pagination: { nullable: true, example: null },
          code: { type: "integer", example: code },
          status: { type: "string", example: statusText },
          error_stack: { type: "string", nullable: true, example: null },
          error_log_time: { type: "string", example: new Date().toISOString() },
          api_version: { type: "string", example: "v1" },
        },
      },
    },
  },
});

const ok = (dataSchema: object | null, description = "Success") => ({
  description,
  content: {
    "application/json": { schema: envelope(dataSchema, description) },
  },
});

const created = (dataSchema: object, description = "Created") => ({
  description,
  content: {
    "application/json": {
      schema: {
        ...envelope(dataSchema, description),
        properties: {
          ...envelope(dataSchema, description).properties,
          code: { type: "integer", example: 201 },
          status: { type: "string", example: "CREATED" },
        },
      },
    },
  },
});

const AUTH_HEADER = { BearerAuth: [] };
const BEARER = [AUTH_HEADER];

const paginationQueryParams = [
  {
    name: "pagination_type",
    in: "query",
    schema: { type: "string", enum: ["cursor", "page"], default: "cursor" },
    description:
      "Pagination mode. Use `page` for offset-based or `cursor` for cursor-based (default).",
  },
  {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    description: "Number of items per page (max 50).",
  },
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
    description: "Page number — only used when `pagination_type=page`.",
  },
  {
    name: "cursor",
    in: "query",
    schema: { type: "string" },
    description:
      "Opaque cursor from the previous response's `pagination.next_cursor` — only used when `pagination_type=cursor`.",
  },
];

export const v1Spec = {
  openapi: "3.0.3",
  info: {
    title: "TradeNG API",
    version: "1.0.0",
    description: `
## Overview

TradeNG is a peer-to-peer escrow marketplace where sellers list items, buyers purchase directly or negotiate a price via offers, and payments are held in escrow until the buyer confirms receipt.

## Base URL

All v1 endpoints are prefixed with \`/api/v1\`.

## Authentication

Protected endpoints require a **Bearer JWT** in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Tokens are obtained from \`POST /auth/login\` or \`POST /auth/verify-email\` and are valid for **7 days** by default (**30 days** if \`remember_me\` is set on login). Call \`POST /auth/signout\` to invalidate all of a user's active tokens immediately. Forgotten passwords can be reset via \`POST /auth/forgot-password\` and \`POST /auth/reset-password\` using a one-time OTP.

## Response Envelope

Every response — success or error — is wrapped in a consistent envelope:

\`\`\`json
{
  "success": true,
  "message": "message",
  "data": { ... } | null,
  "pagination": { ... } | null,
  "code": 200,
  "status": "OK",
  "error_stack": null,
  "error_log_time": null,
  "api_version": "v1"
}
\`\`\`

## Validation Errors (400)

When request body or query validation fails, \`data\` contains a list of field errors:

\`\`\`json
{
  "success": false,
  "message": "Validation error",
  "data": [
    { "field": "email", "message": "Invalid email address" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ],
  ...
}
\`\`\`

## Pagination

All list endpoints support **cursor-based** (default) and **page-based** pagination controlled by query params.

**Cursor response shape:**
\`\`\`json
{
  "type": "cursor",
  "cursor": null,
  "next_cursor": "686a1c4e...",
  "has_next": true,
  "limit": 20,
  "total": null
}
\`\`\`

**Page response shape:**
\`\`\`json
{
  "type": "page",
  "page": 1,
  "limit": 20,
  "total": 142,
  "total_pages": 8,
  "has_next": true,
  "has_prev": false
}
\`\`\`

## Realtime (Socket.io)

In addition to the REST endpoints, the server runs a Socket.io gateway on the same host (no separate port or path — same origin as the REST API).

### Connecting

Pass the JWT from \`POST /auth/login\` (or \`/auth/verify-email\`) as \`auth.token\` in the handshake:

\`\`\`js
import { io } from "socket.io-client";

const socket = io("<SERVER_URL>", {
  auth: { token: "<jwt>" },
});

socket.on("connect", () => console.log("connected", socket.id));

// Handshake failures surface here, not as an "error" event:
socket.on("connect_error", (err) => console.error(err.message));
\`\`\`

Handshake rejection reasons (\`err.message\`):

| Message | Cause |
|---|---|
| \`Authentication token required\` | No \`auth.token\` sent. |
| \`Invalid or expired token\` | Token is malformed or past its \`exp\`. |
| \`Account not authorized\` | Account is not \`ACTIVE\` (unverified, suspended, or deleted). |
| \`Session has been signed out\` | Token was issued before the user's last \`POST /auth/signout\`. |

On success, the socket is automatically joined to a private \`user:<id>\` room — this is what makes notification delivery "just work" with no extra client action. Conversation rooms (below) must be joined explicitly.

Once connected, any other in-session error (e.g. acting on a conversation you're not part of) is delivered as a generic event:

\`\`\`js
socket.on("error", (payload) => console.error(payload.message));
// payload: { "message": "Not a participant in this conversation" }
\`\`\`

### Conversations

**1. Join a conversation** so you start receiving its \`message:new\`/\`typing:*\` events. Do this for every conversation the buyer/seller screen has open (there's no bulk-join — one \`conversation:join\` per \`conversation_id\`):

\`\`\`js
// → emit
socket.emit("conversation:join", { conversation_id: "687a2b1e9c0d4f0012ef5678" });
\`\`\`

There's no ack event for a successful join; if you're not a buyer/seller on that conversation you'll instead get the generic \`error\` event shown above and will not receive its messages.

**2. Send a message.** This is the realtime equivalent of \`POST /conversations/{id}/messages\` — use whichever fits your client; both end up calling the same persistence logic and both broadcast \`message:new\` to everyone in the room (including your own other tabs).

\`\`\`js
// → emit
socket.emit("message:send", {
  conversation_id: "687a2b1e9c0d4f0012ef5678",
  body: "Is this still available?",
});
\`\`\`

A blank/whitespace-only \`body\` is silently ignored (no error emitted). \`message:send\` only creates plain \`TEXT\` messages — \`OFFER\`/\`SYSTEM\` messages are created server-side by the Offers flow and delivered the same way over \`message:new\`.

\`\`\`js
// ← listen
socket.on("message:new", (message) => { /* ... */ });
\`\`\`
\`\`\`json
{
  "id": "687a2c0f9c0d4f0012ef56ab",
  "conversation_id": "687a2b1e9c0d4f0012ef5678",
  "sender_id": "686a1c4e3f9b2d0012ab3400",
  "message_type": "TEXT",
  "body": "Is this still available?",
  "created_at": "2026-07-06T10:15:30.000Z"
}
\`\`\`

The message's recipient (whichever of buyer/seller didn't send it) also gets a \`NEW_MESSAGE\` entry through the notification pipeline below — so a client that isn't currently viewing the conversation still sees it via \`notification:new\`.

**3. Typing indicator** — fire on keystroke/blur; there's no payload validation or persistence, it's a bare broadcast to the room:

\`\`\`js
// → emit
socket.emit("typing:start", { conversation_id: "687a2b1e9c0d4f0012ef5678" });
socket.emit("typing:stop", { conversation_id: "687a2b1e9c0d4f0012ef5678" });

// ← listen (fired to the other participant, not echoed back to the sender)
socket.on("typing:start", (payload) => { /* ... */ });
socket.on("typing:stop", (payload) => { /* ... */ });
\`\`\`
\`\`\`json
{ "conversation_id": "687a2b1e9c0d4f0012ef5678", "user_id": "686a1c4e3f9b2d0012ab3400" }
\`\`\`

### Notifications

No client action is needed to subscribe — every connected socket already sits in its own \`user:<id>\` room. Just listen:

\`\`\`js
socket.on("notification:new", (payload) => { /* ... */ });
\`\`\`
\`\`\`json
{
  "id": "686a1c4e3f9b2d0012ab3d00",
  "type": "OFFER_RECEIVED",
  "title": "New offer received",
  "body": "Adeola offered ₦230,000 for \\"iPhone 14 Pro Max\\"",
  "related_listing_id": "686a1c4e3f9b2d0012ab3300",
  "related_transaction_id": null,
  "related_conversation_id": "687a2b1e9c0d4f0012ef5678",
  "created_at": "2026-07-06T10:15:30.000Z",
  "unread_count": 4
}
\`\`\`

This fires for every \`NotificationType\` on the \`Notification\` schema below (offers, payments, disputes, reviews, messages, withdrawals, seller verification, etc.) — same shape as a REST \`Notification\` object, plus a live \`unread_count\` so the client can update a badge without a follow-up \`GET /notifications/unread-count\` call. It's skipped entirely (no event fires) if the user has the relevant \`notification_settings\` toggle (\`in_app_general\`/\`in_app_offers\`) turned off — the notification still exists and is visible via \`GET /notifications\`, it just isn't pushed live.

If the same user has multiple tabs/devices connected, marking notifications as read on one syncs the badge on the others:

\`\`\`js
socket.on("notification:read", (payload) => { /* ... */ });
// payload: { "id": "686a1c4e3f9b2d0012ab3d00", "unread_count": 3 }

socket.on("notification:read-all", (payload) => { /* ... */ });
// payload: { "unread_count": 0 }
\`\`\`

\`notification:read\` fires after \`PATCH /notifications/{id}/read\` actually flips an unread notification (a no-op call, e.g. re-marking an already-read one, fires nothing); \`notification:read-all\` fires the same way after \`PATCH /notifications/read-all\`.

## Escrow Flow

\`\`\`
Seller creates a DRAFT listing → uploads images/video via /uploads → publishes it (PATCH /listings/:id/publish)
→ Buyer either buys directly (POST /listings/:id/buy) or negotiates via Offers
  (POST /offers/listings/:listingId, then accept/counter/decline)
→ A direct buy or an accepted offer creates a Transaction in PENDING_PAYMENT status
→ Buyer calls POST /transactions/:id/checkout to get a Nomba checkout_link and completes payment
→ Payment gateway webhooks POST /api/webhooks/payment (or GET /transactions/:id/verify as a manual fallback)
→ Platform confirms payment (status: PAID) — if Nomba instead reports a failed or reversed payment,
  the transaction is either left in PENDING_PAYMENT (failed, buyer can retry) or moved to REFUNDED (reversed)
→ Seller ships item
→ Buyer confirms receipt (status: RECEIPT_CONFIRMED)
→ Buyer releases payment OR auto-releases after 48h (status: RELEASED)
→ Seller's wallet is credited and can be withdrawn to a payout bank
\`\`\`

## Payment Webhook Events

The platform's \`POST /api/webhooks/payment\` endpoint verifies Nomba's \`nomba-signature\`/\`nomba-timestamp\` headers (HMAC-SHA256, base64) and reacts to these event types:

| Event | Effect |
|---|---|
| \`payment_success\` | Transaction → \`PAID\`, escrow held, seller notified. |
| \`payment_failed\` | Transaction stays \`PENDING_PAYMENT\`; buyer is notified to retry checkout. |
| \`payment_reversal\` | Transaction (if \`PAID\`/\`RECEIPT_CONFIRMED\`) → \`REFUNDED\`, escrow hold released, buyer and seller notified. |
| \`payout_success\`, \`payout_failed\`, \`payout_refund\` | Acknowledged only — withdrawals are settled manually by an admin, not via Nomba payouts. |
    `,
    contact: { name: "TradeNG Support", email: "support@tradeng.com" },
  },
  servers: [{ url: "/api/v1", description: "Current server (v1)" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from login or email verification.",
      },
    },
    schemas: {
      // ─── Pagination ─────────────────────────────────────────────
      PagePagination: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["page"] },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 142 },
          total_pages: { type: "integer", example: 8 },
          has_next: { type: "boolean", example: true },
          has_prev: { type: "boolean", example: false },
        },
      },
      CursorPagination: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["cursor"] },
          cursor: { type: "string", nullable: true, example: null },
          next_cursor: {
            type: "string",
            nullable: true,
            example: "686a1c4e3f9b2d0012ab34cd",
          },
          has_next: { type: "boolean", example: true },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", nullable: true, example: null },
        },
      },

      // ─── User ────────────────────────────────────────────────────
      UserSummary: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab34cd" },
          first_name: { type: "string", example: "Adeola" },
          last_name: { type: "string", example: "Bello" },
        },
      },
      SellerSummary: {
        allOf: [
          { $ref: "#/components/schemas/UserSummary" },
          {
            type: "object",
            properties: {
              is_verified_seller: { type: "boolean", example: true },
            },
          },
        ],
      },
      UserPublic: {
        allOf: [
          { $ref: "#/components/schemas/UserSummary" },
          {
            type: "object",
            properties: {
              email: {
                type: "string",
                format: "email",
                example: "adeola@example.com",
              },
              status: {
                type: "string",
                enum: ["ACTIVE", "UNVERIFIED", "SUSPENDED"],
                example: "ACTIVE",
              },
              created_at: {
                type: "string",
                format: "date-time",
                example: "2025-07-01T10:00:00.000Z",
              },
            },
          },
        ],
      },
      NotificationSettings: {
        type: "object",
        properties: {
          email_general: { type: "boolean", example: true },
          email_offers: { type: "boolean", example: true },
          in_app_general: { type: "boolean", example: true },
          in_app_offers: { type: "boolean", example: true },
        },
      },
      UserProfile: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab34cd" },
          first_name: { type: "string", example: "Adeola" },
          last_name: { type: "string", example: "Bello" },
          email: { type: "string", format: "email", example: "adeola@example.com" },
          phone_number: { type: "string", nullable: true, example: "+2348012345678" },
          about: { type: "string", nullable: true, example: "Trusted electronics seller since 2023." },
          address: { type: "string", nullable: true, example: "12 Admiralty Way, Lekki, Lagos" },
          profile_photo: { type: "string", nullable: true, example: "https://res.cloudinary.com/tradeng/avatar.jpg" },
          is_verified_seller: { type: "boolean", example: false },
          notification_settings: { $ref: "#/components/schemas/NotificationSettings" },
          created_at: { type: "string", format: "date-time", example: "2025-07-01T10:00:00.000Z" },
        },
      },

      // ─── Category ───────────────────────────────────────────────
      Category: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3600" },
          name: { type: "string", example: "Mobile Phones & Tablets" },
          slug: { type: "string", example: "mobile-phones-tablets" },
          image: { type: "string", nullable: true, example: "https://res.cloudinary.com/tradeng/categories/phones.jpg" },
          is_active: { type: "boolean", example: true },
        },
      },
      CategoryRequest: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3610" },
          name: { type: "string", example: "Vintage Vinyl Records" },
          reason: {
            type: "string",
            example: "There's no category for collectible vinyl records and turntables.",
          },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED"],
            example: "PENDING",
          },
          resolved_category_id: { type: "string", nullable: true, example: null },
          created_at: { type: "string", format: "date-time", example: "2025-07-01T10:00:00.000Z" },
        },
      },

      // ─── Listing ─────────────────────────────────────────────────
      Listing: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab34cd" },
          item_name: { type: "string", example: "iPhone 14 Pro Max – Midnight" },
          category: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", example: "686a1c4e3f9b2d0012ab3600" },
              name: { type: "string", example: "Mobile Phones & Tablets" },
              slug: { type: "string", example: "mobile-phones-tablets" },
            },
          },
          condition: {
            type: "string",
            enum: ["NEW", "LIKE_NEW", "USED"],
            example: "USED",
          },
          defect_description: {
            type: "string",
            nullable: true,
            example: "Minor scratch on the back glass, not visible when cased.",
          },
          description: {
            type: "string",
            example:
              "Used for 6 months, no scratches. Comes with original box and all accessories.",
          },
          images: {
            type: "array",
            items: { type: "string", format: "uri" },
            example: ["https://res.cloudinary.com/tradeng/uploads/img1.jpg"],
          },
          video: {
            type: "string",
            nullable: true,
            example: "https://res.cloudinary.com/tradeng/uploads/video1.mp4",
          },
          price: { type: "number", example: 250000 },
          allow_price_negotiation: { type: "boolean", example: true },
          delivery_options: {
            type: "array",
            items: {
              type: "string",
              enum: ["SELF_DELIVERY", "PICKUP", "HUB_DROPOFF"],
            },
            example: ["SELF_DELIVERY", "PICKUP"],
          },
          pickup_address: {
            type: "string",
            nullable: true,
            example: "12 Admiralty Way, Lekki, Lagos",
          },
          location: { type: "string", nullable: true, example: "Lekki, Lagos" },
          status: {
            type: "string",
            enum: ["DRAFT", "ACTIVE", "SOLD", "CANCELLED"],
            example: "ACTIVE",
          },
          seller: { $ref: "#/components/schemas/SellerSummary" },
          view_count: { type: "integer", example: 42 },
          created_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-01T10:00:00.000Z",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-01T10:00:00.000Z",
          },
        },
      },

      // ─── Offer ───────────────────────────────────────────────────
      Offer: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab34ee" },
          listing: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              item_name: { type: "string" },
              status: { type: "string" },
            },
          },
          buyer: { $ref: "#/components/schemas/UserSummary" },
          seller: { $ref: "#/components/schemas/UserSummary" },
          amount: { type: "number", example: 230000 },
          note: { type: "string", nullable: true, example: "Can you do ₦230,000? I'll pick up today." },
          status: {
            type: "string",
            enum: ["PENDING", "ACCEPTED", "COUNTERED", "DECLINED", "WITHDRAWN"],
            example: "PENDING",
          },
          parent_offer_id: {
            type: "string",
            nullable: true,
            description: "Set on a counter-offer — points to the offer it counters.",
            example: null,
          },
          responded_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: null,
          },
          created_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-02T08:00:00.000Z",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-02T08:00:00.000Z",
          },
        },
      },

      // ─── Transaction ─────────────────────────────────────────────
      Transaction: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3500" },
          amount: { type: "number", example: 250000 },
          platform_fee: {
            type: "number",
            example: 12500,
            description: "5% platform commission deducted from the sale price.",
          },
          seller_amount: {
            type: "number",
            example: 237500,
            description: "Amount the seller receives after the platform fee.",
          },
          status: {
            type: "string",
            enum: [
              "PENDING_PAYMENT",
              "PAID",
              "RECEIPT_CONFIRMED",
              "RELEASED",
              "DISPUTED",
              "REFUNDED",
            ],
            example: "PENDING_PAYMENT",
          },
          payment_ref: {
            type: "string",
            nullable: true,
            example: "PAY-20250701-ABC123",
          },
          dispute_id: { type: "string", nullable: true, example: null },
          receipt_confirmed_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: null,
          },
          auto_release_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: null,
            description:
              "Payment auto-releases to seller 48 hours after receipt confirmation if no dispute is raised.",
          },
          released_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: null,
          },
          created_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-02T09:00:00.000Z",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-02T09:00:00.000Z",
          },
          listing: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              item_name: { type: "string" },
              condition: { type: "string", enum: ["NEW", "LIKE_NEW", "USED"] },
            },
          },
          buyer: { $ref: "#/components/schemas/UserSummary" },
          seller: { $ref: "#/components/schemas/UserSummary" },
        },
      },
      Dispute: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3700" },
          transaction_id: { type: "string", example: "686a1c4e3f9b2d0012ab3500" },
          description: {
            type: "string",
            example: "Item received was significantly different from the listing description.",
          },
          evidence_urls: {
            type: "array",
            items: { type: "string", format: "uri" },
            example: [],
          },
          status: {
            type: "string",
            enum: ["OPEN", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"],
            example: "OPEN",
          },
          resolution_note: { type: "string", nullable: true, example: null },
          resolved_at: { type: "string", format: "date-time", nullable: true, example: null },
          created_at: { type: "string", format: "date-time", example: "2025-07-03T09:00:00.000Z" },
        },
      },
      Order: {
        allOf: [
          { $ref: "#/components/schemas/Transaction" },
          {
            type: "object",
            properties: {
              timeline: {
                type: "array",
                description: "Computed lifecycle timeline for the order.",
                items: {
                  type: "object",
                  properties: {
                    state: { type: "string", example: "RECEIPT_CONFIRMED" },
                    label: { type: "string", example: "Buyer confirmed delivery" },
                    at: { type: "string", format: "date-time", nullable: true, example: null },
                  },
                },
              },
            },
          },
        ],
      },

      // ─── Wallet ──────────────────────────────────────────────────
      Wallet: {
        type: "object",
        properties: {
          available_balance: { type: "number", example: 237500 },
          escrow_balance: { type: "number", example: 0 },
        },
      },
      WalletLedgerEntry: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3800" },
          type: {
            type: "string",
            enum: ["ESCROW_HOLD", "ESCROW_RELEASE", "WITHDRAWAL_HOLD", "WITHDRAWAL_REVERSAL"],
            example: "ESCROW_RELEASE",
          },
          bucket: { type: "string", enum: ["AVAILABLE", "ESCROW"], example: "AVAILABLE" },
          amount: { type: "number", example: 237500 },
          created_at: { type: "string", format: "date-time", example: "2025-07-03T09:00:00.000Z" },
        },
      },
      PayoutBank: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3900" },
          bank_name: { type: "string", example: "Guaranty Trust Bank" },
          account_number: { type: "string", example: "0123456789" },
          account_name: { type: "string", example: "Adeola Bello" },
          is_default: { type: "boolean", example: true },
        },
      },
      WithdrawalRequest: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3a00" },
          amount: { type: "number", example: 100000 },
          bank_name: { type: "string", example: "Guaranty Trust Bank" },
          account_number: { type: "string", example: "0123456789" },
          account_name: { type: "string", example: "Adeola Bello" },
          status: {
            type: "string",
            enum: ["PENDING", "COMPLETED", "REJECTED"],
            example: "PENDING",
          },
          created_at: { type: "string", format: "date-time", example: "2025-07-03T09:00:00.000Z" },
        },
      },

      // ─── Conversations & Messages ──────────────────────────────
      Conversation: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3b00" },
          listing: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              item_name: { type: "string" },
              images: { type: "array", items: { type: "string", format: "uri" } },
            },
          },
          buyer: { $ref: "#/components/schemas/UserSummary" },
          seller: { $ref: "#/components/schemas/UserSummary" },
          last_message_at: { type: "string", format: "date-time", nullable: true, example: null },
          last_message_preview: { type: "string", nullable: true, example: null },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3c00" },
          sender_id: { type: "string", example: "686a1c4e3f9b2d0012ab34cd" },
          message_type: {
            type: "string",
            enum: ["TEXT", "OFFER", "SYSTEM"],
            example: "TEXT",
          },
          body: { type: "string", nullable: true, example: "Is this still available?" },
          offer: {
            type: "object",
            nullable: true,
            example: null,
            properties: {
              id: { type: "string", example: "686a1c4e3f9b2d0012ab3e00" },
              status: {
                type: "string",
                enum: ["PENDING", "ACCEPTED", "COUNTERED", "DECLINED", "WITHDRAWN"],
                example: "PENDING",
              },
              parent_offer_id: { type: "string", nullable: true, example: null },
              amount: { type: "number", example: 100000 },
            },
          },
          read_at: { type: "string", format: "date-time", nullable: true, example: null },
          created_at: { type: "string", format: "date-time", example: "2025-07-03T09:00:00.000Z" },
        },
      },

      // ─── Notification ────────────────────────────────────────────
      Notification: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3d00" },
          type: {
            type: "string",
            enum: [
              "OFFER_RECEIVED",
              "OFFER_ACCEPTED",
              "OFFER_COUNTERED",
              "OFFER_DECLINED",
              "PAYMENT_RECEIVED",
              "PAYMENT_FAILED",
              "PAYMENT_REVERSED",
              "RECEIPT_CONFIRMED",
              "PAYMENT_RELEASED",
              "DISPUTE_RAISED",
              "DISPUTE_RESOLVED",
              "REVIEW_RECEIVED",
              "CATEGORY_REQUEST_APPROVED",
              "NEW_MESSAGE",
              "WITHDRAWAL_UPDATE",
              "SELLER_VERIFIED",
            ],
            example: "OFFER_RECEIVED",
          },
          title: { type: "string", example: "New offer received" },
          body: { type: "string", example: "Adeola offered ₦230,000 for \"iPhone 14 Pro Max\"" },
          related_listing_id: { type: "string", nullable: true, example: null },
          related_transaction_id: { type: "string", nullable: true, example: null },
          related_conversation_id: { type: "string", nullable: true, example: null },
          read_at: { type: "string", format: "date-time", nullable: true, example: null },
          created_at: { type: "string", format: "date-time", example: "2025-07-03T09:00:00.000Z" },
        },
      },

      // ─── Review ──────────────────────────────────────────────────
      Review: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3e00" },
          reviewer_id: { type: "string", example: "686a1c4e3f9b2d0012ab34cd" },
          reviewee_id: { type: "string", example: "686a1c4e3f9b2d0012ab34ee" },
          reviewer_role: { type: "string", enum: ["BUYER", "SELLER"], example: "BUYER" },
          rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
          comment: { type: "string", nullable: true, example: "Fast shipping, item exactly as described." },
          created_at: { type: "string", format: "date-time", example: "2025-07-03T09:00:00.000Z" },
        },
      },
    },

    // ─── Reusable error responses ─────────────────────────────────
    responses: {
      Unauthorized: errorEnvelope(
        401,
        "UNAUTHORIZED",
        "Authentication token is missing or invalid.",
      ),
      Forbidden: errorEnvelope(
        403,
        "FORBIDDEN",
        "You do not have permission to perform this action.",
      ),
      NotFound: errorEnvelope(
        404,
        "NOT_FOUND",
        "The requested resource was not found.",
      ),
      Conflict: errorEnvelope(
        409,
        "CONFLICT",
        "Resource already exists or state conflict.",
      ),
      ValidationError: errorEnvelope(
        400,
        "BAD_REQUEST",
        "Validation error",
        true,
      ),
      InternalError: errorEnvelope(
        500,
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred.",
      ),
    },
  },

  paths: {
    // ═══════════════════════════════════════════════════════════════
    //  AUTH
    // ═══════════════════════════════════════════════════════════════
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create a new account",
        description: `
Registers a new user account. After signup the account is in **UNVERIFIED** status and a 6-digit OTP is sent to the provided email address. The account is automatically deleted if not verified within **7 days**.

**Next step:** call \`POST /auth/verify-email\` with the OTP to activate the account.
        `,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["first_name", "last_name", "email", "password"],
                properties: {
                  first_name: {
                    type: "string",
                    minLength: 1,
                    maxLength: 50,
                    example: "Adeola",
                  },
                  last_name: {
                    type: "string",
                    minLength: 1,
                    maxLength: 50,
                    example: "Bello",
                  },
                  email: {
                    type: "string",
                    format: "email",
                    example: "adeola@example.com",
                  },
                  password: {
                    type: "string",
                    minLength: 8,
                    example: "Secret123",
                    description:
                      "Must be at least 8 characters, contain one uppercase letter and one number.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/UserPublic" },
              },
            },
            "Account created — OTP sent to email.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "409": errorEnvelope(
            409,
            "CONFLICT",
            "An account with this email already exists.",
          ),
        },
      },
    },

    "/auth/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify email with OTP",
        description: `
Verifies the user's email address using the 6-digit OTP sent during signup or via \`POST /auth/resend-otp\`. On success the account status becomes **ACTIVE** and a JWT token is returned.

OTP codes expire after **15 minutes** by default.
        `,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "adeola@example.com",
                  },
                  otp: {
                    type: "string",
                    minLength: 6,
                    maxLength: 6,
                    pattern: "^\\d{6}$",
                    example: "847261",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                token: {
                  type: "string",
                  description:
                    "JWT token — include in `Authorization: Bearer <token>` header.",
                  example: "eyJhbGciOi...",
                },
                user: { $ref: "#/components/schemas/UserPublic" },
              },
            },
            "Email verified — JWT token returned.",
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Invalid or expired OTP."),
          "404": { $ref: "#/components/responses/NotFound" },
          "409": errorEnvelope(409, "CONFLICT", "Email is already verified."),
        },
      },
    },

    "/auth/resend-otp": {
      post: {
        tags: ["Auth"],
        summary: "Resend verification OTP",
        description:
          "Invalidates any existing unused OTPs for the account and sends a fresh 6-digit code to the email address. Only works if the account is still **UNVERIFIED**.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "adeola@example.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(null, "New OTP sent to email."),
          "400": { $ref: "#/components/responses/ValidationError" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": errorEnvelope(
            409,
            "CONFLICT",
            "Email is already verified — login instead.",
          ),
        },
      },
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        description: `
Authenticates an active user and returns a JWT token.

Set \`remember_me: true\` to receive a long-lived token (**30 days** by default) instead of the standard **7-day** token — useful for a "keep me signed in" checkbox on the client.

Signing out via \`POST /auth/signout\` invalidates every token previously issued to the user, regardless of \`remember_me\`.
        `,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "adeola@example.com",
                  },
                  password: { type: "string", example: "Secret123" },
                  remember_me: {
                    type: "boolean",
                    default: false,
                    description:
                      "Issue a long-lived (30-day) token instead of the default 7-day token.",
                    example: false,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                token: { type: "string", example: "eyJhbGciOi..." },
                user: { $ref: "#/components/schemas/UserPublic" },
              },
            },
            "Login successful — JWT token returned.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": errorEnvelope(
            401,
            "UNAUTHORIZED",
            "Invalid email or password.",
          ),
          "403": errorEnvelope(
            403,
            "FORBIDDEN",
            "Account is unverified or suspended.",
          ),
        },
      },
    },

    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset OTP",
        description:
          "Sends a 6-digit password-reset OTP to the email address if an **ACTIVE** account exists for it. Always returns a generic success message, regardless of whether the account exists, to avoid leaking account existence.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "adeola@example.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(null, "If an account exists for this email, a password reset code has been sent."),
          "400": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },

    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with OTP",
        description:
          "Resets the account password using the OTP sent by `POST /auth/forgot-password`. OTP codes expire after **15 minutes** by default.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp", "new_password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "adeola@example.com",
                  },
                  otp: {
                    type: "string",
                    minLength: 6,
                    maxLength: 6,
                    pattern: "^\\d{6}$",
                    example: "847261",
                  },
                  new_password: {
                    type: "string",
                    minLength: 8,
                    example: "NewSecret123",
                    description:
                      "Must be at least 8 characters, contain one uppercase letter and one number.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(null, "Password reset successfully. You can now log in."),
          "400": errorEnvelope(400, "BAD_REQUEST", "Invalid or expired OTP."),
        },
      },
    },

    "/auth/signout": {
      post: {
        tags: ["Auth"],
        summary: "Sign out",
        description: `
Invalidates every JWT previously issued to the authenticated user — including tokens from other devices and long-lived \`remember_me\` tokens — by bumping the user's internal token version.

Because tokens are stateless, any request made with a token issued before this call will start failing with **401** immediately after.
        `,
        security: BEARER,
        responses: {
          "200": ok(null, "Signed out successfully. All active sessions have been invalidated."),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  LISTINGS
    // ═══════════════════════════════════════════════════════════════
    "/listings": {
      get: {
        tags: ["Listings"],
        summary: "Browse listings",
        description:
          "Returns a paginated list of listings. Defaults to showing **ACTIVE** listings. Supports full-text search via `q` and several filters.",
        parameters: [
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Full-text search term across item name and description.",
            example: "iPhone",
          },
          {
            name: "category_id",
            in: "query",
            schema: { type: "string" },
            description: "Filter by category ID.",
          },
          {
            name: "condition",
            in: "query",
            schema: { type: "string", enum: ["NEW", "LIKE_NEW", "USED"] },
            description: "Filter by item condition.",
          },
          {
            name: "min_price",
            in: "query",
            schema: { type: "number", minimum: 0 },
            description: "Minimum price in Naira (NGN).",
          },
          {
            name: "max_price",
            in: "query",
            schema: { type: "number", minimum: 0 },
            description: "Maximum price in Naira (NGN).",
          },
          {
            name: "location",
            in: "query",
            schema: { type: "string" },
            description: "Filter by location (case-insensitive partial match).",
            example: "Lagos",
          },
          {
            name: "verified_sellers_only",
            in: "query",
            schema: { type: "boolean" },
            description: "Only return listings from verified sellers.",
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["DRAFT", "ACTIVE", "SOLD", "CANCELLED"],
              default: "ACTIVE",
            },
            description: "Filter by listing status.",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                listings: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Listing" },
                },
              },
            },
            "Listing results with pagination.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
        },
      },
      post: {
        tags: ["Listings"],
        summary: "Create a listing",
        description: `
Creates a new item listing. The authenticated user becomes the **seller**.

Set \`status: "ACTIVE"\` to publish immediately (requires at least one image), or omit/leave as \`"DRAFT"\` to save a draft and publish later via \`PATCH /listings/{id}/publish\`.
        `,
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["item_name", "category_id", "condition", "description", "price", "delivery_options"],
                properties: {
                  item_name: {
                    type: "string",
                    minLength: 3,
                    maxLength: 120,
                    example: "iPhone 14 Pro Max – Midnight",
                  },
                  category_id: {
                    type: "string",
                    example: "686a1c4e3f9b2d0012ab3600",
                  },
                  condition: {
                    type: "string",
                    enum: ["NEW", "LIKE_NEW", "USED"],
                    example: "USED",
                  },
                  defect_description: {
                    type: "string",
                    maxLength: 1000,
                    example: "Minor scratch on the back glass, not visible when cased.",
                  },
                  description: {
                    type: "string",
                    minLength: 10,
                    maxLength: 2000,
                    example:
                      "Used for 6 months, no scratches. Comes with original box and all accessories.",
                  },
                  images: {
                    type: "array",
                    items: { type: "string", format: "uri" },
                    maxItems: 8,
                    description: "Cloudinary URLs returned by `POST /uploads/images`.",
                  },
                  video: {
                    type: "string",
                    format: "uri",
                    description: "Cloudinary URL returned by `POST /uploads/video`.",
                  },
                  price: {
                    type: "number",
                    minimum: 0,
                    exclusiveMinimum: true,
                    example: 250000,
                    description: "Price in Naira (NGN). Must be greater than 0.",
                  },
                  allow_price_negotiation: {
                    type: "boolean",
                    default: false,
                    description: "Whether buyers can send offers via `/offers`.",
                  },
                  delivery_options: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["SELF_DELIVERY", "PICKUP", "HUB_DROPOFF"],
                    },
                    minItems: 1,
                    example: ["SELF_DELIVERY", "PICKUP"],
                  },
                  pickup_address: {
                    type: "string",
                    maxLength: 300,
                    description: "Required when `delivery_options` includes `PICKUP`.",
                  },
                  location: { type: "string", maxLength: 120, example: "Lekki, Lagos" },
                  status: {
                    type: "string",
                    enum: ["DRAFT", "ACTIVE"],
                    default: "DRAFT",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { listing: { $ref: "#/components/schemas/Listing" } },
            },
            "Listing created.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/listings/mine": {
      get: {
        tags: ["Listings"],
        summary: "Get my listings",
        description:
          "Returns all listings created by the authenticated seller, in reverse chronological order. Includes drafts.",
        security: BEARER,
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["DRAFT", "ACTIVE", "SOLD", "CANCELLED"] },
            description: "Filter by listing status.",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                listings: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Listing" },
                },
              },
            },
            "Seller's listings with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/listings/{id}": {
      get: {
        tags: ["Listings"],
        summary: "Get a listing",
        description:
          "Returns full details of a single listing. Increments the listing's `view_count`.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID (MongoDB ObjectId).",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                listing: { $ref: "#/components/schemas/Listing" },
              },
            },
            "Listing details.",
          ),
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Listings"],
        summary: "Update a listing",
        description:
          "Partially updates a **DRAFT** or **ACTIVE** listing. Only the seller can update their own listing. `status` cannot be changed here — use `PATCH /listings/{id}/publish` to publish a draft.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  item_name: {
                    type: "string",
                    minLength: 3,
                    maxLength: 120,
                    example: "iPhone 14 Pro Max – Midnight (Updated)",
                  },
                  category_id: { type: "string" },
                  condition: { type: "string", enum: ["NEW", "LIKE_NEW", "USED"] },
                  defect_description: { type: "string", maxLength: 1000 },
                  description: {
                    type: "string",
                    minLength: 10,
                    maxLength: 2000,
                  },
                  images: {
                    type: "array",
                    items: { type: "string", format: "uri" },
                    maxItems: 8,
                  },
                  video: { type: "string", format: "uri" },
                  price: { type: "number", minimum: 0, exclusiveMinimum: true },
                  allow_price_negotiation: { type: "boolean" },
                  delivery_options: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["SELF_DELIVERY", "PICKUP", "HUB_DROPOFF"],
                    },
                    minItems: 1,
                  },
                  pickup_address: { type: "string", maxLength: 300 },
                  location: { type: "string", maxLength: 120 },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { listing: { $ref: "#/components/schemas/Listing" } },
            },
            "Listing updated.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Only draft or active listings can be updated.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Listings"],
        summary: "Cancel a listing",
        description:
          "Cancels a **DRAFT** or **ACTIVE** listing. Sets the status to `CANCELLED`. Only the seller can cancel their own listing.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        responses: {
          "200": ok(null, "Listing cancelled."),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Only draft or active listings can be cancelled.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/listings/{id}/publish": {
      patch: {
        tags: ["Listings"],
        summary: "Publish a draft listing",
        description:
          "Publishes a **DRAFT** listing, setting its status to `ACTIVE`. Requires at least one image. Only the seller can publish their own listing.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { listing: { $ref: "#/components/schemas/Listing" } },
            },
            "Listing published successfully.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Only draft listings can be published, or the listing has no images.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/listings/{id}/buy": {
      post: {
        tags: ["Listings"],
        summary: "Buy a listing directly",
        description: `
Starts a direct purchase of an **ACTIVE** listing at its listed \`price\`, creating a new **Transaction** in \`PENDING_PAYMENT\` status.

**Next step:** call \`POST /transactions/{id}/checkout\` to get a payment link.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        responses: {
          "201": created(
            {
              type: "object",
              properties: {
                transaction: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    amount: { type: "number" },
                    platform_fee: { type: "number" },
                    seller_amount: { type: "number" },
                    status: { type: "string", example: "PENDING_PAYMENT" },
                    created_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
            "Purchase started. Proceed to checkout to complete payment.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Listing is not available for purchase.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  DISCOVERY
    // ═══════════════════════════════════════════════════════════════
    "/discovery/top-sellers": {
      get: {
        tags: ["Discovery"],
        summary: "Get top sellers",
        description: `
Public leaderboard ranking sellers by number of **completed sales** (\`RELEASED\` transactions), tie-broken by total revenue. Only \`ACTIVE\` seller accounts are included.

This is not paginated — it's a fixed top-N list; use \`limit\` to control how many to return.
        `,
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            description: "Number of top sellers to return (max 50).",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                top_sellers: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "686a1c4e3f9b2d0012ab3400" },
                      first_name: { type: "string", example: "Adeola" },
                      last_name: { type: "string", example: "Okafor" },
                      profile_photo: { type: "string", nullable: true, example: null },
                      is_verified_seller: { type: "boolean", example: true },
                      completed_sales: { type: "integer", example: 42 },
                      total_revenue: { type: "number", example: 4750000 },
                      review_average: { type: "number", example: 4.8 },
                      review_count: { type: "integer", example: 37 },
                    },
                  },
                },
              },
            },
            "Sellers ranked by completed sales.",
          ),
        },
      },
    },

    "/discovery/featured-listings": {
      get: {
        tags: ["Discovery"],
        summary: "Get featured listings",
        description:
          "Returns **ACTIVE** listings from the top 20 sellers (by completed sales — see `GET /discovery/top-sellers`), newest first. Supports the same cursor/page pagination as `GET /listings`.",
        parameters: [...paginationQueryParams],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                listings: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Listing" },
                },
              },
            },
            "Featured listing results with pagination.",
          ),
        },
      },
    },

    "/discovery/best-selling": {
      get: {
        tags: ["Discovery"],
        summary: "Get best-selling listings",
        description: `
Returns **ACTIVE** listings ranked by \`view_count\` (highest first) — a proxy for buyer interest, since each listing is unique, single-item inventory sold only once (there's no repeat-sale count to rank by).

**Only page-based pagination is supported here** (\`pagination_type=cursor\` is ignored) because the sort key is \`view_count\`, not \`_id\`.
        `,
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
            description: "Page number.",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
            description: "Number of items per page (max 50).",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                listings: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Listing" },
                },
              },
            },
            "Best-selling listing results, page-paginated.",
          ),
        },
      },
    },

    "/discovery/recent-from-verified-sellers": {
      get: {
        tags: ["Discovery"],
        summary: "Get recent listings from verified sellers",
        description:
          "Returns **ACTIVE** listings from **verified sellers only** (`is_verified_seller: true`), newest first. Supports the same cursor/page pagination as `GET /listings`. Equivalent to `GET /listings?verified_sellers_only=true`, provided as a dedicated endpoint for a \"verified sellers\" discovery surface.",
        parameters: [...paginationQueryParams],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                listings: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Listing" },
                },
              },
            },
            "Recent listing results from verified sellers, with pagination.",
          ),
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  OFFERS
    // ═══════════════════════════════════════════════════════════════
    "/offers/received": {
      get: {
        tags: ["Offers"],
        summary: "Get offers received (seller)",
        description:
          "Returns offers made on the authenticated seller's listings, newest first. Optionally filter by `status`.",
        security: BEARER,
        parameters: [
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["PENDING", "ACCEPTED", "COUNTERED", "DECLINED", "WITHDRAWN"],
            },
            description: "Filter by offer status.",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                offers: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Offer" },
                },
              },
            },
            "Offers received with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/offers/listings/{listingId}/mine": {
      get: {
        tags: ["Offers"],
        summary: "Get my offer thread for a listing",
        description:
          "Returns the full negotiation thread (offers and counter-offers) between the authenticated buyer and the listing's seller, oldest first.",
        security: BEARER,
        parameters: [
          {
            name: "listingId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                offers: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Offer" },
                },
              },
            },
            "Offer thread for the listing.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/offers/listings/{listingId}": {
      post: {
        tags: ["Offers"],
        summary: "Make an offer on a listing",
        description: `
Makes an offer on a listing that has \`allow_price_negotiation\` enabled. Rules:

- The listing must be **ACTIVE** and have \`allow_price_negotiation: true\`.
- A seller cannot make an offer on their own listing.
- The seller is notified via email and in the listing's conversation thread.
        `,
        security: BEARER,
        parameters: [
          {
            name: "listingId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: {
                  amount: {
                    type: "number",
                    minimum: 0,
                    exclusiveMinimum: true,
                    example: 230000,
                    description: "Offer amount in Naira (NGN). Must be greater than 0.",
                  },
                  note: {
                    type: "string",
                    maxLength: 500,
                    example: "Can you do ₦230,000? I'll pick up today.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { offer: { $ref: "#/components/schemas/Offer" } },
            },
            "Offer sent successfully. Seller is notified via email and chat.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Listing is not available for offers, or does not accept price negotiation.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/offers/{id}/accept": {
      patch: {
        tags: ["Offers"],
        summary: "Accept an offer (seller only)",
        description: `
Accepts a **PENDING** or **COUNTERED** offer on the seller's listing. This action:

1. Creates a new **Transaction** in \`PENDING_PAYMENT\` status at the offer's amount.
2. Sets the offer to \`ACCEPTED\` and declines all other pending/countered offers on the listing.
3. Notifies the buyer via email and in the listing's conversation thread.

Only the **seller** of the listing can accept offers.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Offer ID.",
            example: "686a1c4e3f9b2d0012ab34ee",
          },
        ],
        responses: {
          "201": created(
            {
              type: "object",
              properties: {
                transaction: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    amount: { type: "number" },
                    platform_fee: { type: "number" },
                    seller_amount: { type: "number" },
                    status: { type: "string", example: "PENDING_PAYMENT" },
                    created_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
            "Offer accepted. The buyer has been notified to complete payment.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "This offer is no longer available.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/offers/{id}/counter": {
      patch: {
        tags: ["Offers"],
        summary: "Counter an offer (seller only)",
        description:
          "Declines the given offer with status `COUNTERED` and creates a new offer (from seller to buyer) referencing it via `parent_offer_id`. Only the **seller** of the listing can counter.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Offer ID being countered.",
            example: "686a1c4e3f9b2d0012ab34ee",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: {
                  amount: {
                    type: "number",
                    minimum: 0,
                    exclusiveMinimum: true,
                    example: 245000,
                  },
                  note: { type: "string", maxLength: 500, example: "Best I can do is ₦245,000." },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { offer: { $ref: "#/components/schemas/Offer" } },
            },
            "Counter offer sent.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "This offer is no longer available.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/offers/{id}/decline": {
      patch: {
        tags: ["Offers"],
        summary: "Decline an offer (seller only)",
        description:
          "Declines a **PENDING** or **COUNTERED** offer on the seller's listing. Only the **seller** of the listing can decline.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Offer ID.",
            example: "686a1c4e3f9b2d0012ab34ee",
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: { type: "string", maxLength: 500, example: "Price is too low for this item." },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(null, "Offer declined."),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "This offer is no longer available.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/offers/{id}/withdraw": {
      patch: {
        tags: ["Offers"],
        summary: "Withdraw an offer (buyer only)",
        description:
          "Withdraws a **PENDING** or **COUNTERED** offer placed by the authenticated buyer.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Offer ID.",
            example: "686a1c4e3f9b2d0012ab34ee",
          },
        ],
        responses: {
          "200": ok(null, "Offer withdrawn successfully."),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Only pending offers can be withdrawn.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  TRANSACTIONS
    // ═══════════════════════════════════════════════════════════════
    "/transactions": {
      get: {
        tags: ["Transactions"],
        summary: "Get my transactions",
        description:
          "Returns the authenticated user's transactions. Use `role` to filter by whether you are the buyer or seller.",
        security: BEARER,
        parameters: [
          {
            name: "role",
            in: "query",
            schema: {
              type: "string",
              enum: ["buyer", "seller", "both"],
              default: "both",
            },
            description: "Filter transactions by your role.",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                transactions: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Transaction" },
                },
              },
            },
            "User's transactions with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/transactions/{id}": {
      get: {
        tags: ["Transactions"],
        summary: "Get a transaction",
        description:
          "Returns full details of a single transaction. Only accessible by the **buyer** or **seller** of that transaction.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                transaction: { $ref: "#/components/schemas/Transaction" },
              },
            },
            "Transaction details.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/transactions/{id}/checkout": {
      post: {
        tags: ["Transactions"],
        summary: "Start checkout (buyer)",
        description: `
Creates a **Nomba** checkout session for the transaction and returns a \`checkout_link\` the buyer should be redirected to in order to complete payment.

The platform confirms payment automatically via the webhook at \`POST /api/webhooks/payment\`.

- Only the **buyer** can call this.
- Transaction must be in \`PENDING_PAYMENT\` status.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                transaction_id: { type: "string" },
                checkout_link: {
                  type: "string",
                  format: "uri",
                  example: "https://checkout.nomba.com/pay/abc123",
                },
              },
            },
            "Checkout session created. Complete payment via the checkout link.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Payment has already been initiated or completed.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "502": errorEnvelope(502, "BAD_GATEWAY", "Payment provider unavailable, please try again."),
        },
      },
    },

    "/transactions/{id}/verify": {
      get: {
        tags: ["Transactions"],
        summary: "Verify checkout payment (buyer/seller)",
        description: `
Manually checks the payment status of a transaction's checkout session directly with **Nomba**, as a fallback for when the payment webhook has not yet arrived.

If the transaction is still \`PENDING_PAYMENT\` and Nomba confirms the payment succeeded, the transaction is moved to \`PAID\`, escrow is held, and the seller is notified — the same outcome as the webhook.

Nomba is queried differently depending on the server environment:
- **Development** (sandbox): filters the merchant's transactions by \`orderReference\` — see [Filter Parent Account Transactions](https://developer.nomba.com/nomba-api-reference/transactions/filter-parent-account-transactions).
- **Production**: looks up the checkout order directly by \`orderReference\` — see [Fetch Checkout Transaction](https://developer.nomba.com/nomba-api-reference/online-checkout/fetch-checkout-transaction).

- Only the **buyer** or **seller** can call this.
- Checkout must have been initiated (\`POST /transactions/{id}/checkout\`) first.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                transaction_id: { type: "string" },
                status: {
                  type: "string",
                  example: "PAID",
                  description:
                    "The transaction's status after verification (unchanged if payment has not succeeded yet).",
                },
              },
            },
            "Transaction status after verifying with Nomba.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Checkout has not been initiated for this transaction.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "502": errorEnvelope(502, "BAD_GATEWAY", "Payment provider unavailable, please try again."),
        },
      },
    },

    "/transactions/{id}/confirm-receipt": {
      post: {
        tags: ["Transactions"],
        summary: "Confirm receipt (buyer)",
        description: `
The buyer confirms they have received the item. This:

1. Sets the transaction status to \`RECEIPT_CONFIRMED\`.
2. Starts a **48-hour auto-release countdown** — if no dispute is raised, payment is automatically released to the seller.
3. Notifies the seller via email.

- Only the **buyer** can call this.
- Transaction must be in \`PAID\` status.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                transaction: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    status: { type: "string", example: "RECEIPT_CONFIRMED" },
                    auto_release_at: {
                      type: "string",
                      format: "date-time",
                      example: "2025-07-05T12:00:00.000Z",
                    },
                  },
                },
              },
            },
            "Receipt confirmed. 48-hour auto-release window started.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Item not paid for yet, or receipt already confirmed.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/transactions/{id}/release": {
      post: {
        tags: ["Transactions"],
        summary: "Release payment to seller (buyer)",
        description: `
The buyer manually releases the escrowed payment to the seller ahead of the 48-hour auto-release window.

- Only the **buyer** can call this.
- Transaction must be in \`RECEIPT_CONFIRMED\` status.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                transaction_id: { type: "string" },
                status: { type: "string", example: "RELEASED" },
                released_at: { type: "string", format: "date-time" },
              },
            },
            "Payment released to seller.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Can only release after confirming receipt.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/transactions/{id}/dispute": {
      post: {
        tags: ["Transactions"],
        summary: "Raise a dispute (buyer)",
        description: `
The buyer raises a dispute on a transaction, freezing the escrow payment until the TradeNG team resolves the issue.

- Only the **buyer** can raise a dispute.
- Transaction must be in \`PAID\` or \`RECEIPT_CONFIRMED\` status.
- Payment remains held until the dispute is resolved by the platform.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reason"],
                properties: {
                  reason: {
                    type: "string",
                    minLength: 10,
                    maxLength: 1000,
                    example:
                      "Item received was significantly different from the listing description.",
                  },
                  evidence_urls: {
                    type: "array",
                    items: { type: "string", format: "uri" },
                    maxItems: 6,
                    description: "Cloudinary URLs returned by `POST /uploads/images`.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: {
                transaction_id: { type: "string" },
                status: { type: "string", example: "DISPUTED" },
                dispute_id: { type: "string" },
              },
            },
            "Dispute raised. Platform team notified. Payment is held until resolved.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Disputes can only be raised on PAID or RECEIPT_CONFIRMED transactions.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      get: {
        tags: ["Transactions"],
        summary: "Get the dispute on a transaction",
        description:
          "Returns the dispute raised against the transaction, if any. Accessible by either the **buyer** or **seller**.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { dispute: { $ref: "#/components/schemas/Dispute" } },
            },
            "Dispute details.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": errorEnvelope(404, "NOT_FOUND", "No dispute exists for this transaction."),
        },
      },
    },

    "/transactions/{id}/reviews": {
      post: {
        tags: ["Reviews"],
        summary: "Leave a review for a transaction",
        description: `
Leaves a rating and optional comment for the other party (buyer or seller) on a completed transaction.

- Transaction must be in \`RELEASED\` status.
- Only the **buyer** or **seller** of the transaction can review, and each may review once.
        `,
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Transaction ID.",
            example: "686a1c4e3f9b2d0012ab3500",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["rating"],
                properties: {
                  rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
                  comment: {
                    type: "string",
                    maxLength: 1000,
                    example: "Fast shipping, item exactly as described.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { review: { $ref: "#/components/schemas/Review" } },
            },
            "Review submitted.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Reviews can only be left after payment has been released.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": errorEnvelope(409, "CONFLICT", "You have already reviewed this transaction."),
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  CATEGORIES
    // ═══════════════════════════════════════════════════════════════
    "/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories",
        description:
          "Returns all active categories, sorted alphabetically. Categories are seeded and managed by the TradeNG team — there is no public create/update endpoint.",
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                categories: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Category" },
                },
              },
            },
            "Active categories.",
          ),
        },
      },
    },

    "/categories/{id}": {
      get: {
        tags: ["Categories"],
        summary: "Get a category",
        description: "Returns a single active category by ID.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Category ID.",
            example: "686a1c4e3f9b2d0012ab3600",
          },
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { category: { $ref: "#/components/schemas/Category" } },
            },
            "Category details.",
          ),
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/categories/requests": {
      post: {
        tags: ["Categories"],
        summary: "Request a new category",
        description:
          "Submits a request for a new category that doesn't exist yet. The TradeNG team reviews requests and creates approved categories manually; the requester is notified once resolved.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "reason"],
                properties: {
                  name: {
                    type: "string",
                    minLength: 2,
                    maxLength: 60,
                    example: "Vintage Vinyl Records",
                  },
                  reason: {
                    type: "string",
                    minLength: 10,
                    maxLength: 500,
                    example: "There's no category for collectible vinyl records and turntables.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { category_request: { $ref: "#/components/schemas/CategoryRequest" } },
            },
            "Category request submitted. We'll review it and notify you once it's created.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/categories/requests/mine": {
      get: {
        tags: ["Categories"],
        summary: "Get my category requests",
        description:
          "Returns all category requests submitted by the authenticated user, newest first.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                category_requests: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CategoryRequest" },
                },
              },
            },
            "Category requests with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  UPLOADS
    // ═══════════════════════════════════════════════════════════════
    "/uploads/images": {
      post: {
        tags: ["Uploads"],
        summary: "Upload listing images",
        description:
          "Uploads up to 8 image files to Cloudinary and returns their URLs, for use in `Listing.images` or `Dispute.evidence_urls`.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["images"],
                properties: {
                  images: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                    maxItems: 8,
                    description: "Up to 8 image files (field name `images`).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: {
                images: {
                  type: "array",
                  items: { type: "string", format: "uri" },
                  example: ["https://res.cloudinary.com/tradeng/uploads/img1.jpg"],
                },
              },
            },
            "Images uploaded successfully.",
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "At least one image file is required."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "502": errorEnvelope(502, "BAD_GATEWAY", "Media upload failed, please retry."),
        },
      },
    },

    "/uploads/video": {
      post: {
        tags: ["Uploads"],
        summary: "Upload a listing video",
        description:
          "Uploads a single video file to Cloudinary and returns its URL, for use in `Listing.video`.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["video"],
                properties: {
                  video: {
                    type: "string",
                    format: "binary",
                    description: "A single video file (field name `video`).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: {
                video: {
                  type: "string",
                  format: "uri",
                  example: "https://res.cloudinary.com/tradeng/uploads/video1.mp4",
                },
              },
            },
            "Video uploaded successfully.",
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "A video file is required."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "502": errorEnvelope(502, "BAD_GATEWAY", "Media upload failed, please retry."),
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  WALLET
    // ═══════════════════════════════════════════════════════════════
    "/wallet": {
      get: {
        tags: ["Wallet"],
        summary: "Get my wallet balances",
        description:
          "Returns the authenticated user's available and escrow balances, computed from the wallet ledger.",
        security: BEARER,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { wallet: { $ref: "#/components/schemas/Wallet" } },
            },
            "Wallet balances.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/wallet/ledger": {
      get: {
        tags: ["Wallet"],
        summary: "Get my wallet ledger",
        description:
          "Returns the authenticated user's wallet ledger entries (escrow holds/releases, withdrawal holds/reversals), newest first.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                ledger: {
                  type: "array",
                  items: { $ref: "#/components/schemas/WalletLedgerEntry" },
                },
              },
            },
            "Wallet ledger with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/wallet/payout-banks": {
      get: {
        tags: ["Wallet"],
        summary: "Get my payout banks",
        description:
          "Returns the authenticated user's saved payout bank accounts, default first.",
        security: BEARER,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                payout_banks: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PayoutBank" },
                },
              },
            },
            "Payout banks.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Wallet"],
        summary: "Add a payout bank",
        description:
          "Adds a bank account for withdrawals. The first bank added for a user is automatically set as `is_default`.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["bank_name", "account_number", "account_name"],
                properties: {
                  bank_name: { type: "string", minLength: 2, maxLength: 100, example: "Guaranty Trust Bank" },
                  account_number: {
                    type: "string",
                    minLength: 10,
                    maxLength: 10,
                    example: "0123456789",
                  },
                  account_name: { type: "string", minLength: 2, maxLength: 100, example: "Adeola Bello" },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { payout_bank: { $ref: "#/components/schemas/PayoutBank" } },
            },
            "Payout bank added.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/wallet/payout-banks/{id}": {
      delete: {
        tags: ["Wallet"],
        summary: "Remove a payout bank",
        description: "Removes a saved payout bank belonging to the authenticated user.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Payout bank ID.",
            example: "686a1c4e3f9b2d0012ab3900",
          },
        ],
        responses: {
          "200": ok(null, "Payout bank removed."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/wallet/withdrawals": {
      get: {
        tags: ["Wallet"],
        summary: "Get my withdrawal requests",
        description:
          "Returns the authenticated user's withdrawal requests, newest first.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                withdrawals: {
                  type: "array",
                  items: { $ref: "#/components/schemas/WithdrawalRequest" },
                },
              },
            },
            "Withdrawal requests with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Wallet"],
        summary: "Request a withdrawal",
        description: `
Requests a withdrawal of \`amount\` from the available balance to a saved payout bank. This immediately places a \`WITHDRAWAL_HOLD\` on the wallet ledger; the withdrawal is completed manually by the TradeNG team.

- \`amount\` must be at least the platform minimum withdrawal amount.
- \`amount\` cannot exceed the current \`available_balance\`.
        `,
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount", "payout_bank_id"],
                properties: {
                  amount: {
                    type: "number",
                    minimum: 0,
                    exclusiveMinimum: true,
                    example: 100000,
                  },
                  payout_bank_id: { type: "string", example: "686a1c4e3f9b2d0012ab3900" },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { withdrawal: { $ref: "#/components/schemas/WithdrawalRequest" } },
            },
            "Withdrawal request submitted.",
          ),
          "400": errorEnvelope(
            400,
            "BAD_REQUEST",
            "Amount is below the minimum withdrawal amount, or exceeds available balance.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": errorEnvelope(404, "NOT_FOUND", "Payout bank not found."),
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  ORDERS
    // ═══════════════════════════════════════════════════════════════
    "/orders/buying": {
      get: {
        tags: ["Orders"],
        summary: "Get my orders as a buyer",
        description:
          "Returns a read-only, buyer-facing view of the authenticated user's transactions, each including a computed `timeline` of key lifecycle events.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                orders: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Order" },
                },
              },
            },
            "Buying orders with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/orders/selling": {
      get: {
        tags: ["Orders"],
        summary: "Get my orders as a seller",
        description:
          "Returns a read-only, seller-facing view of the authenticated user's transactions, each including a computed `timeline` of key lifecycle events.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                orders: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Order" },
                },
              },
            },
            "Selling orders with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  CONVERSATIONS
    // ═══════════════════════════════════════════════════════════════
    "/conversations": {
      get: {
        tags: ["Conversations"],
        summary: "Get my conversations",
        description:
          "Returns the authenticated user's conversations (as buyer or seller), most recently active first.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                conversations: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Conversation" },
                },
              },
            },
            "Conversations with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Conversations"],
        summary: "Start (or get) a conversation about a listing",
        description:
          "Gets or creates a conversation between the authenticated buyer and the listing's seller. A buyer cannot message their own listing.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["listing_id"],
                properties: {
                  listing_id: { type: "string", example: "686a1c4e3f9b2d0012ab34cd" },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { conversation: { $ref: "#/components/schemas/Conversation" } },
            },
            "Conversation ready.",
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "You cannot message yourself."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/conversations/{id}/messages": {
      get: {
        tags: ["Conversations"],
        summary: "Get messages in a conversation",
        description:
          "Returns messages in a conversation, newest first. Only accessible by conversation participants.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Conversation ID.",
            example: "686a1c4e3f9b2d0012ab3b00",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                messages: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Message" },
                },
              },
            },
            "Messages with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Conversations"],
        summary: "Send a message (REST fallback)",
        description:
          "Sends a text message in a conversation. This is a REST fallback for clients not connected via Socket.io — the message is also broadcast in real time to the `message:new` socket event.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Conversation ID.",
            example: "686a1c4e3f9b2d0012ab3b00",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["body"],
                properties: {
                  body: {
                    type: "string",
                    minLength: 1,
                    maxLength: 2000,
                    example: "Is this still available?",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            {
              type: "object",
              properties: { message: { $ref: "#/components/schemas/Message" } },
            },
            "Message sent.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/conversations/{id}/read": {
      patch: {
        tags: ["Conversations"],
        summary: "Mark a conversation as read",
        description:
          "Marks all messages from the other participant in the conversation as read.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Conversation ID.",
            example: "686a1c4e3f9b2d0012ab3b00",
          },
        ],
        responses: {
          "200": ok(null, "Conversation marked as read."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Get my notifications",
        description:
          "Returns the authenticated user's notifications, unread notifications first, then newest first.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                notifications: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Notification" },
                },
              },
            },
            "Notifications with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/notifications/unread-count": {
      get: {
        tags: ["Notifications"],
        summary: "Get unread notification count",
        description: "Returns the number of unread notifications for the authenticated user.",
        security: BEARER,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { unread_count: { type: "integer", example: 3 } },
            },
            "Unread notification count.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        description: "Marks all of the authenticated user's unread notifications as read.",
        security: BEARER,
        responses: {
          "200": ok(null, "All notifications marked as read."),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark a notification as read",
        description: "Marks a single notification belonging to the authenticated user as read.",
        security: BEARER,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Notification ID.",
            example: "686a1c4e3f9b2d0012ab3d00",
          },
        ],
        responses: {
          "200": ok(null, "Notification marked as read."),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  PROFILE
    // ═══════════════════════════════════════════════════════════════
    "/profile/me": {
      get: {
        tags: ["Profile"],
        summary: "Get my profile",
        description: "Returns the authenticated user's full profile.",
        security: BEARER,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { user: { $ref: "#/components/schemas/UserProfile" } },
            },
            "Profile details.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Profile"],
        summary: "Update my profile",
        description: "Partially updates the authenticated user's profile.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  first_name: { type: "string", minLength: 1, maxLength: 50 },
                  last_name: { type: "string", minLength: 1, maxLength: 50 },
                  phone_number: { type: "string", minLength: 7, maxLength: 20, example: "+2348012345678" },
                  about: { type: "string", maxLength: 500 },
                  address: { type: "string", maxLength: 300 },
                  profile_photo: {
                    type: "string",
                    format: "uri",
                    description: "Cloudinary URL returned by `POST /uploads/images`.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(
            {
              type: "object",
              properties: { user: { $ref: "#/components/schemas/UserProfile" } },
            },
            "Profile updated.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Profile"],
        summary: "Delete my account",
        description: "Marks the authenticated user's account as `DELETED`.",
        security: BEARER,
        responses: {
          "200": ok(null, "Account deleted."),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/profile/stats": {
      get: {
        tags: ["Profile"],
        summary: "Get my seller stats",
        description:
          "Returns summary statistics for the authenticated user as a seller: total listings, items sold, average rating, and total earnings.",
        security: BEARER,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                total_listings: { type: "integer", example: 12 },
                items_sold: { type: "integer", example: 8 },
                avg_rating: { type: "number", example: 4.6 },
                earnings: { type: "number", example: 950000 },
              },
            },
            "Seller stats.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/profile/trust-score": {
      get: {
        tags: ["Profile"],
        summary: "Get my trust score",
        description:
          "Returns a computed trust score (0–100) for the authenticated user based on review average, completed transaction volume, seller verification status, account age, and dispute rate.",
        security: BEARER,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                verification_status: {
                  type: "string",
                  enum: ["EMAIL_VERIFIED", "SELLER_VERIFIED"],
                  example: "EMAIL_VERIFIED",
                },
                review_average: { type: "number", example: 4.6 },
                review_count: { type: "integer", example: 14 },
                completed_transactions_count: { type: "integer", example: 22 },
                account_age_days: { type: "integer", example: 92 },
                dispute_rate: { type: "number", example: 0.02 },
                score: { type: "integer", example: 78 },
              },
            },
            "Trust score breakdown.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/profile/verify": {
      post: {
        tags: ["Profile"],
        summary: "Request seller verification",
        description:
          "Submits a request for seller verification, reviewed manually by the TradeNG team. Can only be requested once while pending.",
        security: BEARER,
        responses: {
          "200": ok(null, "Verification request submitted. We'll review and notify you."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": errorEnvelope(
            409,
            "CONFLICT",
            "You are already a verified seller, or a verification request is already pending review.",
          ),
        },
      },
    },

    "/profile/password": {
      patch: {
        tags: ["Profile"],
        summary: "Update my password",
        description: "Updates the authenticated user's password after verifying the current one.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["current_password", "new_password"],
                properties: {
                  current_password: { type: "string", example: "Secret123" },
                  new_password: {
                    type: "string",
                    minLength: 8,
                    example: "NewSecret123",
                    description:
                      "Must be at least 8 characters, contain one uppercase letter and one number.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(null, "Password updated successfully."),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": errorEnvelope(401, "UNAUTHORIZED", "Current password is incorrect."),
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/profile/notification-settings": {
      patch: {
        tags: ["Profile"],
        summary: "Update my notification settings",
        description:
          "Partially updates the authenticated user's email and in-app notification preferences.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email_general: { type: "boolean" },
                  email_offers: { type: "boolean" },
                  in_app_general: { type: "boolean" },
                  in_app_offers: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                notification_settings: { $ref: "#/components/schemas/NotificationSettings" },
              },
            },
            "Notification settings updated.",
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/profile/wishlist": {
      get: {
        tags: ["Profile"],
        summary: "Get my wishlist",
        description:
          "Returns listings the authenticated user has added to their wishlist, newest first.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                wishlist: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "686a1c4e3f9b2d0012ab3f00" },
                      listing: { $ref: "#/components/schemas/Listing" },
                    },
                  },
                },
              },
            },
            "Wishlist with pagination.",
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/profile/wishlist/{listingId}": {
      post: {
        tags: ["Profile"],
        summary: "Add a listing to my wishlist",
        description: "Adds a listing to the authenticated user's wishlist. Idempotent.",
        security: BEARER,
        parameters: [
          {
            name: "listingId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        responses: {
          "201": created({ nullable: true, example: null }, "Added to wishlist."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Profile"],
        summary: "Remove a listing from my wishlist",
        description: "Removes a listing from the authenticated user's wishlist. Idempotent.",
        security: BEARER,
        parameters: [
          {
            name: "listingId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Listing ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
        ],
        responses: {
          "200": ok(null, "Removed from wishlist."),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  REVIEWS
    // ═══════════════════════════════════════════════════════════════
    "/users/{userId}/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "Get reviews for a user",
        description:
          "Returns reviews received by a user (as buyer or seller), newest first. No authentication required.",
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User ID.",
            example: "686a1c4e3f9b2d0012ab34cd",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            {
              type: "object",
              properties: {
                reviews: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Review" },
                },
              },
            },
            "Reviews with pagination.",
          ),
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  SUPPORT
    // ═══════════════════════════════════════════════════════════════
    "/support/contact": {
      post: {
        tags: ["Support"],
        summary: "Contact support",
        description:
          "Submits a support enquiry. The message is persisted and forwarded to the TradeNG support team; the sender receives an email receipt. No authentication required.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "subject", "message"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 100, example: "Adeola Bello" },
                  email: {
                    type: "string",
                    format: "email",
                    example: "adeola@example.com",
                  },
                  subject: {
                    type: "string",
                    minLength: 3,
                    maxLength: 150,
                    example: "Question about a withdrawal",
                  },
                  message: {
                    type: "string",
                    minLength: 10,
                    maxLength: 2000,
                    example: "My withdrawal has been pending for 3 days, can you check on it?",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created({ nullable: true, example: null }, "Your message has been received. We'll get back to you shortly."),
          "400": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
  },

  tags: [
    {
      name: "Auth",
      description: "User registration, email verification, password reset, and authentication.",
    },
    {
      name: "Listings",
      description: "Create and manage marketplace listings — drafts, publishing, browsing, and direct purchase.",
    },
    {
      name: "Discovery",
      description:
        "Public, unauthenticated discovery surfaces: top sellers, seller-curated featured listings, best-selling listings, and recent listings from verified sellers only.",
    },
    {
      name: "Offers",
      description: "Negotiate a listing's price via an offer/counter-offer thread between buyer and seller.",
    },
    {
      name: "Transactions",
      description: "Escrow transaction lifecycle management — checkout, receipt confirmation, release, and disputes.",
    },
    {
      name: "Categories",
      description:
        "Browse marketplace categories and request new ones. Categories are seeded and managed by the TradeNG team — there is no public create/update endpoint.",
    },
    {
      name: "Uploads",
      description: "Upload listing images and video to Cloudinary ahead of creating or updating a listing.",
    },
    {
      name: "Wallet",
      description: "View wallet balances and ledger, manage payout banks, and request withdrawals.",
    },
    {
      name: "Orders",
      description: "Read-only buyer/seller order views over transactions, with a computed lifecycle timeline.",
    },
    {
      name: "Conversations",
      description:
        "Buyer–seller messaging tied to a listing. Real-time delivery also happens over Socket.io — see the **Realtime (Socket.io)** section above for the connection handshake and event contracts.",
    },
    {
      name: "Notifications",
      description:
        "In-app notifications for offers, payments, disputes, reviews, messages, and more. Delivered live over Socket.io as well as via the REST endpoints below — see the **Realtime (Socket.io)** section above for the `notification:new`/`notification:read`/`notification:read-all` event contracts.",
    },
    {
      name: "Profile",
      description: "Manage the authenticated user's profile, stats, trust score, verification, and wishlist.",
    },
    {
      name: "Reviews",
      description: "Leave and browse ratings and reviews left between buyers and sellers after a completed transaction.",
    },
    {
      name: "Support",
      description: "Contact the TradeNG support team.",
    },
  ],
};
