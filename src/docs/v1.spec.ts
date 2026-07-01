// OpenAPI 3.0 specification for TradeNG API v1

const envelope = (dataSchema: object | null, description: string) => ({
  type: "object",
  description,
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string", example: "Success" },
    data: dataSchema ?? { nullable: true, example: null },
    pagination: { nullable: true, example: null, oneOf: [{ $ref: "#/components/schemas/PagePagination" }, { $ref: "#/components/schemas/CursorPagination" }] },
    code: { type: "integer", example: 200 },
    status: { type: "string", example: "OK" },
    error_stack: { type: "string", nullable: true, example: null },
    error_log_time: { type: "string", nullable: true, example: null },
    api_version: { type: "string", example: "v1" },
  },
});

const errorEnvelope = (code: number, statusText: string, description: string, includeErrors = false) => ({
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
                    message: { type: "string", example: "Invalid email address" },
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
  content: { "application/json": { schema: envelope(dataSchema, description) } },
});

const created = (dataSchema: object, description = "Created") => ({
  description,
  content: { "application/json": { schema: { ...envelope(dataSchema, description), properties: { ...envelope(dataSchema, description).properties, code: { type: "integer", example: 201 }, status: { type: "string", example: "CREATED" } } } } },
});

const AUTH_HEADER = { BearerAuth: [] };
const BEARER = [AUTH_HEADER];

const paginationQueryParams = [
  {
    name: "pagination_type",
    in: "query",
    schema: { type: "string", enum: ["cursor", "page"], default: "cursor" },
    description: "Pagination mode. Use `page` for offset-based or `cursor` for cursor-based (default).",
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
    description: "Opaque cursor from the previous response's `pagination.next_cursor` — only used when `pagination_type=cursor`.",
  },
];

export const v1Spec = {
  openapi: "3.0.3",
  info: {
    title: "TradeNG API",
    version: "1.0.0",
    description: `
## Overview

TradeNG is a peer-to-peer escrow marketplace where sellers list items, buyers place bids, and payments are held in escrow until the buyer confirms receipt.

## Base URL

All v1 endpoints are prefixed with \`/api/v1\`.

## Authentication

Protected endpoints require a **Bearer JWT** in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Tokens are obtained from \`POST /auth/login\` or \`POST /auth/verify-email\` and are valid for **7 days** by default.

## Response Envelope

Every response — success or error — is wrapped in a consistent envelope:

\`\`\`json
{
  "success": true,
  "message": "Human-readable message",
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

## Escrow Flow

\`\`\`
Seller creates listing → Buyer places bid → Seller accepts bid
→ Buyer initiates payment (records payment_ref)
→ Payment gateway webhooks /api/webhooks/payment
→ Platform confirms payment (status: PAID)
→ Seller ships item
→ Buyer confirms receipt (status: RECEIPT_CONFIRMED)
→ Buyer releases payment OR auto-releases after 48h (status: RELEASED)
→ Seller receives funds
\`\`\`
    `,
    contact: { name: "TradeNG Support", email: "support@tradeng.com" },
  },
  servers: [
    { url: "/api/v1", description: "Current server (v1)" },
  ],
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
          next_cursor: { type: "string", nullable: true, example: "686a1c4e3f9b2d0012ab34cd" },
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
      UserPublic: {
        allOf: [
          { $ref: "#/components/schemas/UserSummary" },
          {
            type: "object",
            properties: {
              email: { type: "string", format: "email", example: "adeola@example.com" },
              status: { type: "string", enum: ["ACTIVE", "UNVERIFIED", "SUSPENDED"], example: "ACTIVE" },
              created_at: { type: "string", format: "date-time", example: "2025-07-01T10:00:00.000Z" },
            },
          },
        ],
      },

      // ─── Listing ─────────────────────────────────────────────────
      Listing: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab34cd" },
          title: { type: "string", example: "iPhone 14 Pro Max – Midnight" },
          description: { type: "string", example: "Used for 6 months, no scratches. Comes with original box." },
          condition: { type: "string", enum: ["NEW", "USED"], example: "USED" },
          start_price: { type: "number", example: 250000 },
          ends_at: { type: "string", format: "date-time", nullable: true, example: "2025-08-01T00:00:00.000Z" },
          status: { type: "string", enum: ["ACTIVE", "ENDED", "SOLD", "CANCELLED"], example: "ACTIVE" },
          seller: { $ref: "#/components/schemas/UserSummary" },
          created_at: { type: "string", format: "date-time", example: "2025-07-01T10:00:00.000Z" },
        },
      },
      ListingWithBids: {
        allOf: [
          { $ref: "#/components/schemas/Listing" },
          {
            type: "object",
            properties: {
              top_bids: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", example: "686a1c4e3f9b2d0012ab34ee" },
                    amount: { type: "number", example: 270000 },
                    created_at: { type: "string", format: "date-time" },
                    bidder: { $ref: "#/components/schemas/UserSummary" },
                  },
                },
              },
            },
          },
        ],
      },

      // ─── Bid ─────────────────────────────────────────────────────
      Bid: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab34ee" },
          amount: { type: "number", example: 270000 },
          status: { type: "string", enum: ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"], example: "PENDING" },
          created_at: { type: "string", format: "date-time", example: "2025-07-02T08:00:00.000Z" },
          bidder: { $ref: "#/components/schemas/UserSummary" },
          listing: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              condition: { type: "string", enum: ["NEW", "USED"] },
              status: { type: "string" },
            },
          },
        },
      },

      // ─── Transaction ─────────────────────────────────────────────
      Transaction: {
        type: "object",
        properties: {
          id: { type: "string", example: "686a1c4e3f9b2d0012ab3500" },
          amount: { type: "number", example: 270000 },
          platform_fee: { type: "number", example: 13500, description: "5% platform commission deducted from the sale price." },
          seller_amount: { type: "number", example: 256500, description: "Amount the seller receives after the platform fee." },
          status: {
            type: "string",
            enum: ["PENDING_PAYMENT", "PAID", "RECEIPT_CONFIRMED", "RELEASED", "DISPUTED", "REFUNDED"],
            example: "PENDING_PAYMENT",
          },
          payment_ref: { type: "string", nullable: true, example: "PAY-20250701-ABC123" },
          receipt_confirmed_at: { type: "string", format: "date-time", nullable: true, example: null },
          auto_release_at: { type: "string", format: "date-time", nullable: true, example: null, description: "Payment auto-releases to seller 48 hours after receipt confirmation if no dispute is raised." },
          released_at: { type: "string", format: "date-time", nullable: true, example: null },
          created_at: { type: "string", format: "date-time", example: "2025-07-02T09:00:00.000Z" },
          listing: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              condition: { type: "string", enum: ["NEW", "USED"] },
            },
          },
          buyer: { $ref: "#/components/schemas/UserSummary" },
          seller: { $ref: "#/components/schemas/UserSummary" },
        },
      },
    },

    // ─── Reusable error responses ─────────────────────────────────
    responses: {
      Unauthorized: errorEnvelope(401, "UNAUTHORIZED", "Authentication token is missing or invalid."),
      Forbidden: errorEnvelope(403, "FORBIDDEN", "You do not have permission to perform this action."),
      NotFound: errorEnvelope(404, "NOT_FOUND", "The requested resource was not found."),
      Conflict: errorEnvelope(409, "CONFLICT", "Resource already exists or state conflict."),
      ValidationError: errorEnvelope(400, "BAD_REQUEST", "Validation error", true),
      InternalError: errorEnvelope(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred."),
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
                  first_name: { type: "string", minLength: 1, maxLength: 50, example: "Adeola" },
                  last_name: { type: "string", minLength: 1, maxLength: 50, example: "Bello" },
                  email: { type: "string", format: "email", example: "adeola@example.com" },
                  password: {
                    type: "string",
                    minLength: 8,
                    example: "Secret123",
                    description: "Must be at least 8 characters, contain one uppercase letter and one number.",
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
            "Account created — OTP sent to email."
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "409": errorEnvelope(409, "CONFLICT", "An account with this email already exists."),
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
                  email: { type: "string", format: "email", example: "adeola@example.com" },
                  otp: { type: "string", minLength: 6, maxLength: 6, pattern: "^\\d{6}$", example: "847261" },
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
                token: { type: "string", description: "JWT token — include in `Authorization: Bearer <token>` header.", example: "eyJhbGciOi..." },
                user: { $ref: "#/components/schemas/UserPublic" },
              },
            },
            "Email verified — JWT token returned."
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
        description: "Invalidates any existing unused OTPs for the account and sends a fresh 6-digit code to the email address. Only works if the account is still **UNVERIFIED**.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email", example: "adeola@example.com" },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(null, "New OTP sent to email."),
          "400": { $ref: "#/components/responses/ValidationError" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": errorEnvelope(409, "CONFLICT", "Email is already verified — login instead."),
        },
      },
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        description: "Authenticates an active user and returns a JWT token valid for 7 days.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "adeola@example.com" },
                  password: { type: "string", example: "Secret123" },
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
            "Login successful — JWT token returned."
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": errorEnvelope(401, "UNAUTHORIZED", "Invalid email or password."),
          "403": errorEnvelope(403, "FORBIDDEN", "Account is unverified or suspended."),
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
        description: "Returns a paginated list of listings. Defaults to showing **ACTIVE** listings. Supports full-text search via `q`.",
        parameters: [
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Full-text search term across title and description.",
            example: "iPhone",
          },
          {
            name: "condition",
            in: "query",
            schema: { type: "string", enum: ["NEW", "USED"] },
            description: "Filter by item condition.",
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["ACTIVE", "ENDED", "SOLD", "CANCELLED"], default: "ACTIVE" },
            description: "Filter by listing status.",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            { type: "object", properties: { listings: { type: "array", items: { $ref: "#/components/schemas/Listing" } } } },
            "Listing results with pagination."
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
        },
      },
      post: {
        tags: ["Listings"],
        summary: "Create a listing",
        description: "Creates a new item listing. The authenticated user becomes the **seller**. `start_price` sets the minimum bid floor.",
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description", "condition", "start_price"],
                properties: {
                  title: { type: "string", minLength: 3, maxLength: 120, example: "iPhone 14 Pro Max – Midnight" },
                  description: {
                    type: "string",
                    minLength: 10,
                    maxLength: 2000,
                    example: "Used for 6 months, no scratches. Comes with original box and all accessories.",
                  },
                  condition: { type: "string", enum: ["NEW", "USED"], example: "USED" },
                  start_price: { type: "number", minimum: 0, exclusiveMinimum: true, example: 250000, description: "Minimum bid floor in Naira (NGN). Must be greater than 0." },
                  ends_at: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                    example: "2025-08-01T00:00:00.000Z",
                    description: "Optional ISO 8601 datetime when the listing stops accepting bids. Must be in the future.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            { type: "object", properties: { listing: { $ref: "#/components/schemas/Listing" } } },
            "Listing created."
          ),
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/listings/mine": {
      get: {
        tags: ["Listings"],
        summary: "Get my listings",
        description: "Returns all listings created by the authenticated seller, in reverse chronological order.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            { type: "object", properties: { listings: { type: "array", items: { $ref: "#/components/schemas/Listing" } } } },
            "Seller's listings with pagination."
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/listings/{id}": {
      get: {
        tags: ["Listings"],
        summary: "Get a listing",
        description: "Returns full details of a single listing including the top 5 highest active bids.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Listing ID (MongoDB ObjectId).", example: "686a1c4e3f9b2d0012ab34cd" },
        ],
        responses: {
          "200": ok(
            { type: "object", properties: { listing: { $ref: "#/components/schemas/ListingWithBids" } } },
            "Listing details with top bids."
          ),
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Listings"],
        summary: "Update a listing",
        description: "Partially updates an **ACTIVE** listing. Only the seller can update their own listing. `start_price` cannot be changed after creation.",
        security: BEARER,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Listing ID.", example: "686a1c4e3f9b2d0012ab34cd" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", minLength: 3, maxLength: 120, example: "iPhone 14 Pro Max – Midnight (Updated)" },
                  description: { type: "string", minLength: 10, maxLength: 2000 },
                  condition: { type: "string", enum: ["NEW", "USED"] },
                  ends_at: { type: "string", format: "date-time", nullable: true, example: "2025-09-01T00:00:00.000Z" },
                },
              },
            },
          },
        },
        responses: {
          "200": ok(
            { type: "object", properties: { listing: { $ref: "#/components/schemas/Listing" } } },
            "Listing updated."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Only active listings can be updated."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Listings"],
        summary: "Cancel a listing",
        description: "Cancels an **ACTIVE** listing. Sets the status to `CANCELLED`. Only the seller can cancel their own listing.",
        security: BEARER,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Listing ID.", example: "686a1c4e3f9b2d0012ab34cd" },
        ],
        responses: {
          "200": ok(null, "Listing cancelled."),
          "400": errorEnvelope(400, "BAD_REQUEST", "Only active listings can be cancelled."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIDS
    // ═══════════════════════════════════════════════════════════════
    "/bids/mine": {
      get: {
        tags: ["Bids"],
        summary: "Get my bids",
        description: "Returns all bids placed by the authenticated buyer, newest first, with listing details.",
        security: BEARER,
        parameters: paginationQueryParams,
        responses: {
          "200": ok(
            { type: "object", properties: { bids: { type: "array", items: { $ref: "#/components/schemas/Bid" } } } },
            "Buyer's bids with pagination."
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/bids/listings/{listingId}/bids": {
      get: {
        tags: ["Bids"],
        summary: "Get bids for a listing",
        description: "Returns all **PENDING** bids for a listing, sorted by amount descending (highest first). No authentication required.",
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" }, description: "Listing ID.", example: "686a1c4e3f9b2d0012ab34cd" },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            { type: "object", properties: { bids: { type: "array", items: { $ref: "#/components/schemas/Bid" } } } },
            "Bids for the listing."
          ),
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Bids"],
        summary: "Place a bid",
        description: `
Places a bid on a listing. Rules:

- The listing must be **ACTIVE** and not past its \`ends_at\` date.
- A seller cannot bid on their own listing.
- The bid **amount must be strictly higher** than the current highest bid, or higher than \`start_price\` if no bids exist yet.
        `,
        security: BEARER,
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" }, description: "Listing ID.", example: "686a1c4e3f9b2d0012ab34cd" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: {
                  amount: { type: "number", minimum: 0, exclusiveMinimum: true, example: 270000, description: "Bid amount in Naira (NGN). Must exceed the current highest bid or start price." },
                },
              },
            },
          },
        },
        responses: {
          "201": created(
            { type: "object", properties: { bid: { $ref: "#/components/schemas/Bid" } } },
            "Bid placed successfully. Seller is notified via email."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Bid amount too low, listing ended, or bidding not active."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": errorEnvelope(403, "FORBIDDEN", "Sellers cannot bid on their own listings."),
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/bids/listings/{listingId}/bids/{bidId}/accept": {
      post: {
        tags: ["Bids"],
        summary: "Accept a bid (seller only)",
        description: `
Accepts a specific bid on the seller's listing. This action:

1. Creates a new **Transaction** in \`PENDING_PAYMENT\` status.
2. Sets the listing status to \`SOLD\`.
3. Sets the accepted bid to \`ACCEPTED\`.
4. Rejects all other pending bids on the listing.
5. Notifies the winning buyer via email with the transaction ID.

Only the **seller** of the listing can accept bids.
        `,
        security: BEARER,
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" }, description: "Listing ID.", example: "686a1c4e3f9b2d0012ab34cd" },
          { name: "bidId", in: "path", required: true, schema: { type: "string" }, description: "Bid ID.", example: "686a1c4e3f9b2d0012ab34ee" },
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
            "Bid accepted. Transaction created."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Listing is not active or bid is not pending."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/bids/{bidId}/withdraw": {
      delete: {
        tags: ["Bids"],
        summary: "Withdraw a bid",
        description: "Withdraws a **PENDING** bid placed by the authenticated buyer. The listing must still be **ACTIVE**.",
        security: BEARER,
        parameters: [
          { name: "bidId", in: "path", required: true, schema: { type: "string" }, description: "Bid ID.", example: "686a1c4e3f9b2d0012ab34ee" },
        ],
        responses: {
          "200": ok(null, "Bid withdrawn successfully."),
          "400": errorEnvelope(400, "BAD_REQUEST", "Only pending bids on active listings can be withdrawn."),
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
        description: "Returns the authenticated user's transactions. Use `role` to filter by whether you are the buyer or seller.",
        security: BEARER,
        parameters: [
          {
            name: "role",
            in: "query",
            schema: { type: "string", enum: ["buyer", "seller", "both"], default: "both" },
            description: "Filter transactions by your role.",
          },
          ...paginationQueryParams,
        ],
        responses: {
          "200": ok(
            { type: "object", properties: { transactions: { type: "array", items: { $ref: "#/components/schemas/Transaction" } } } },
            "User's transactions with pagination."
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/transactions/{id}": {
      get: {
        tags: ["Transactions"],
        summary: "Get a transaction",
        description: "Returns full details of a single transaction. Only accessible by the **buyer** or **seller** of that transaction.",
        security: BEARER,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Transaction ID.", example: "686a1c4e3f9b2d0012ab3500" },
        ],
        responses: {
          "200": ok(
            { type: "object", properties: { transaction: { $ref: "#/components/schemas/Transaction" } } },
            "Transaction details."
          ),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/transactions/{id}/initiate-payment": {
      post: {
        tags: ["Transactions"],
        summary: "Initiate payment (buyer)",
        description: `
Records the buyer's **payment reference** (from their bank transfer or payment provider) against the transaction. After calling this endpoint, the buyer should complete payment using their payment provider with the given reference.

The platform listens for payment confirmation via the webhook at \`POST /api/webhooks/payment\`.

- Only the **buyer** can call this.
- Transaction must be in \`PENDING_PAYMENT\` status.
        `,
        security: BEARER,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Transaction ID.", example: "686a1c4e3f9b2d0012ab3500" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["payment_ref"],
                properties: {
                  payment_ref: {
                    type: "string",
                    minLength: 1,
                    example: "PAY-20250701-ABC123",
                    description: "Unique payment reference from your bank or payment provider.",
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
                transaction_id: { type: "string" },
                payment_ref: { type: "string" },
                amount: { type: "number" },
                listing_title: { type: "string" },
                instructions: { type: "string" },
              },
            },
            "Payment reference recorded. Complete payment via your payment provider."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Payment has already been initiated or completed."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/transactions/confirm-payment": {
      post: {
        tags: ["Transactions"],
        summary: "Confirm payment (admin/internal)",
        description: `
**Internal / admin endpoint.** Confirms that a payment with the given reference has been received by the platform, updating the transaction status to \`PAID\` and notifying the seller to ship the item.

In production this is triggered automatically by the payment webhook (\`POST /api/webhooks/payment\`). This endpoint exists as a manual override.
        `,
        security: BEARER,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["payment_ref"],
                properties: {
                  payment_ref: { type: "string", example: "PAY-20250701-ABC123" },
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
                transaction_id: { type: "string" },
                status: { type: "string", example: "PAID" },
              },
            },
            "Payment confirmed. Seller notified to ship item."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Transaction is not in PENDING_PAYMENT state or payment_ref missing."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
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
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Transaction ID.", example: "686a1c4e3f9b2d0012ab3500" },
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
                    auto_release_at: { type: "string", format: "date-time", example: "2025-07-05T12:00:00.000Z" },
                  },
                },
              },
            },
            "Receipt confirmed. 48-hour auto-release window started."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Item not paid for yet, or receipt already confirmed."),
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
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Transaction ID.", example: "686a1c4e3f9b2d0012ab3500" },
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
            "Payment released to seller."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Can only release after confirming receipt."),
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
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Transaction ID.", example: "686a1c4e3f9b2d0012ab3500" },
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
                    example: "Item received was significantly different from the listing description.",
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
                transaction_id: { type: "string" },
                status: { type: "string", example: "DISPUTED" },
                reason: { type: "string" },
              },
            },
            "Dispute raised. Platform team notified."
          ),
          "400": errorEnvelope(400, "BAD_REQUEST", "Disputes can only be raised on PAID or RECEIPT_CONFIRMED transactions."),
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },

  tags: [
    { name: "Auth", description: "User registration, email verification, and authentication." },
    { name: "Listings", description: "Create and manage marketplace listings." },
    { name: "Bids", description: "Place, browse, and manage bids on listings." },
    { name: "Transactions", description: "Escrow transaction lifecycle management." },
  ],
};
