# API reference

Base URL (local): `http://localhost:4000/api/v1`
Interactive Swagger UI: `http://localhost:4000/api/v1/docs`
Health: `GET /api/v1/health`

Every endpoint below is relative to `/api/v1` and is implemented in the NestJS
app under `apps/api`. The frontend uses only these APIs; prices, discounts,
roles, stock and payment state are always computed or verified by the server.

## Response envelope

`ResponseInterceptor` wraps controller results. Successful responses:

```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": { "id": "prod_blush-garden-rose-bouquet", "name": "Blush Garden Rose Bouquet" },
  "meta": {}
}
```

Paginated results use the same envelope with a populated `meta`:

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 28, "totalPages": 2 }
}
```

Failures are normalised by `AllExceptionsFilter`:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "code": "VALIDATION_ERROR",
  "errors": { "email": ["email must be an email"] }
}
```

`code` and `errors` are optional; clients should branch on HTTP status first.
`204 No Content` responses (for example `DELETE /addresses/:id`) have no body.

## Authentication and authorization

- Bearer JWT access token: `Authorization: Bearer <accessToken>`. Access tokens
  are short-lived (`JWT_ACCESS_TTL=15m`).
- Refresh token: send the opaque rotating token to `POST /auth/refresh`. Only a
  hash is stored in `Session`; the old row is revoked and replaced, so replaying
  an old token fails.
- Customer flow: `POST /auth/register` → `POST /auth/verify-email` →
  `POST /auth/login`. Password reset uses `POST /auth/forgot-password` then
  `POST /auth/reset-password`.
- Staff sign in through `POST /auth/admin/login`; the endpoint accepts only
  accounts with a staff role. `GET /auth/staff-check` confirms staff access.
- Roles and permissions come from the database (`Role`, `Permission`), seeded
  from `apps/api/src/roles/roles.constants.ts`. Guards use `@Roles(...)` and
  `@Permissions(...)`; client-supplied roles are ignored.
- `@Public()` routes need no token. Checkout routes use `OptionalAuthGuard` and
  accept either a bearer token or `X-Guest-Token`.
- Guest clients send `X-Guest-Token: <uuid>` on cart requests. After login,
  `POST /cart/merge` folds the guest cart into the user cart. A guest token
  alone is never accepted for an account-scoped resource.
- Admin login seeded by `npm run prisma:seed` is
  `admin@artsheaven.local` / `ChangeMe123!`. **Change or remove this user before
  any non-local deployment.**

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@artsheaven.local","password":"ChangeMe123!"}'
```

## Idempotency and concurrency headers

| Header | Used by | Meaning |
| --- | --- | --- |
| `X-Idempotency-Key` | `POST /checkout/place`, `POST /payments/create`, `POST /payments/:id/refund` | Client-generated UUID. The server claims `scope:key` with a fingerprint of the request body. Replay with the same key and payload returns the original result; a different payload returns `409`. |
| `X-Guest-Token` | `/cart*`, checkout quote/place, guest order lookup | Stable UUID generated once per browser. Guest order lookup requires a matching token; an order number alone is insufficient. |

Never generate a new idempotency key when retrying the same logical action.

## Errors

| HTTP | `code` (when set) | Typical meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | DTO validation failed; see `errors`. Also used for coupon/customisation rules. |
| 401 | `INVALID_CREDENTIALS`, `INVALID_TOKEN` | Wrong credentials, missing/expired token, disabled account. |
| 403 | `FORBIDDEN` | Role or permission check failed. |
| 404 | `NOT_FOUND` | Unknown slug, id, pincode or order number. |
| 409 | `IDEMPOTENCY_CONFLICT` | Reused key with a different payload; also stock/coupon races. |
| 422 | `CUSTOMIZATION_INVALID` | Customisation values failed schema-driven validation. |
| 429 | `RATE_LIMITED` | Global 120 req/min; auth and coupon validation have tighter limits. |
| 500 | — | Unexpected failure; details are logged, never returned. |

`message` values are human-readable — never branch on message text.

## Pagination, filtering and sorting

`PaginationQueryDto` accepts `page` (default `1`), `limit` (default `20`, max
`100`) and `order` (`asc`/`desc`, default `desc`). Some routes add `search`,
`status` or catalogue filters. Unknown query keys are rejected.

```bash
GET /products?page=2&limit=20&order=asc
GET /admin/orders?page=1&limit=50&status=PROCESSING
```

## Endpoint reference

### Public / storefront

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Database status, uptime, timestamp. |
| GET | `/docs` | Swagger UI. |
| POST | `/auth/register` | Rate limited: 5/min. |
| POST | `/auth/verify-email` | Body: `{ token }`. |
| POST | `/auth/login` | Returns access + refresh tokens and user summary. |
| POST | `/auth/admin/login` | Staff-only variant of login. |
| POST | `/auth/refresh` | Rotates the refresh token; 30/min. |
| POST | `/auth/forgot-password` | Always succeeds to avoid account enumeration. |
| POST | `/auth/reset-password` | Body: `{ token, password }`. |
| GET | `/categories` | Visible categories; optional `?parentId=`. |
| GET | `/categories/:slug` | Category detail. |
| GET | `/products` | Paginated catalogue with attributes and active variants. |
| GET | `/products/:slug` | Product with images, variants and customisation schemas. |
| GET | `/products/:slug/reviews` | Approved reviews only. |
| GET | `/product-customization/schemas` | Public schema definitions; filter by product/category. |
| GET | `/banners` | Active public banners. |
| GET | `/store-settings/public` | `{ key: value }` map containing only `public.*` keys. |
| POST | `/coupons/validate` | `{ code, subtotal }` → authoritative discount preview; throttled. Promo copy from settings is display-only. |
| POST | `/checkout/quote` | Server-side totals; accepts bearer or `X-Guest-Token`. Never trusts client prices. |
| GET | `/checkout/slots` | Active delivery slots. |
| GET | `/checkout/wraps` | Active gift wraps. |
| GET | `/checkout/serviceability/:pincode` | Zone lookup from `DeliveryZone.pincodePrefixes`. |
| POST | `/checkout/serviceability` | `{ pincode, subtotal? }`; same zone rules. |
| POST | `/webhooks/razorpay` | Raw body preserved for HMAC-SHA256 verification. |
| POST | `/webhooks/cashfree` | Signature header verification. |

### Customer (bearer token, except guest cart/checkout)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/auth/me` | `{ id, email, name, roles, permissions }`. |
| POST | `/auth/logout` | Revokes the supplied refresh token. |
| POST | `/auth/change-password` | Requires current password. |
| GET | `/auth/staff-check` | Staff-only bootstrap check for the admin UI. |
| PATCH | `/users/me/profile` | `{ name?, phone? }`. |
| GET | `/addresses` | Own addresses only. |
| POST | `/addresses` | `label`, `name`, `phone`, `addressLine`, `city`, `state?`, `pincode`. |
| PATCH | `/addresses/:id` | Own addresses only. |
| PATCH | `/addresses/:id/default` | Clears the previous default in one transaction. |
| DELETE | `/addresses/:id` | `204 No Content`. |
| GET | `/cart` | Accepts `X-Guest-Token`. |
| POST | `/cart/items` | `{ productId?, variantId?, quantity, customizations? }`. |
| PATCH | `/cart/items/:id` | Quantity/customisation changes re-price the line. |
| DELETE | `/cart/items/:id` | Removes a line. |
| PATCH | `/cart/coupon` | Sets or clears the coupon server-side. |
| POST | `/cart/merge` | Guest cart → user cart after login. |
| DELETE | `/cart` | Clears the active cart. |
| POST | `/checkout/place` | **Requires `X-Idempotency-Key`**; bearer or `X-Guest-Token`. Transactional. |
| GET | `/orders` | Own orders, paginated. |
| GET | `/orders/:number` | Own order or guest order with matching `X-Guest-Token`. |
| POST | `/orders/:number/cancel` | Allowed only while the order state permits cancellation. |
| POST | `/payments/create` | **Requires `X-Idempotency-Key`**. Returns provider checkout/session data. |
| POST | `/payments/verify` | Verifies Razorpay signature or re-queries Cashfree; never trusts client status. |
| GET | `/payments/:id` | Own payment status. |
| POST | `/products/:slug/reviews` | Verified-purchase flag computed server-side. |
| GET | `/reviews/me` | Current user's reviews. |
| POST | `/uploads/presign` | Returns a presigned PUT URL for a private S3 object with a server-generated key. |
| POST | `/uploads/local` | Admin-only multipart upload (`file`, `ownerType`) for local development; returns a public `/uploads/...` URL. |
| POST | `/uploads/complete` | Registers the uploaded object as an `UploadedAsset`. |
| DELETE | `/uploads/:id` | Removes an uploaded asset. |

### Admin / staff

All routes below require a bearer token plus the role/permission shown in
Swagger. Staff UI uses `GET /auth/staff-check` and one permission-gated
`/admin` storefront route.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/dashboard` | Revenue/orders snapshot. |
| GET | `/admin/dashboard/payments` | Payment breakdown. |
| GET | `/admin/dashboard/low-stock` | Low-stock products. |
| GET | `/admin/dashboard/failed-payments` | Failed payment list. |
| GET | `/admin/products` | Paginated product list for admin table. |
| POST | `/categories` | Create category. |
| POST | `/categories/reorder` | Reorder visible categories. |
| PATCH / DELETE | `/categories/:slug` | Update or soft-delete category. |
| GET | `/admin/categories` | Admin category list. |
| POST | `/products` | Create product. |
| GET / PATCH / DELETE | `/products/:slug` | Read or manage product. |
| POST | `/products/:id/images` | Add image key/URL. |
| POST | `/products/:id/images/reorder` | Reorder images. |
| PATCH / DELETE | `/products/:id/images/:imageId` | Manage image. |
| POST | `/products/:id/variants` | Add variant. |
| PATCH / DELETE | `/products/:id/variants/:variantId` | Manage variant. |
| PATCH | `/products/:id/related` | Set related products. |
| GET / POST | `/product-customization/schemas` | List/create schema. |
| PATCH / DELETE | `/product-customization/schemas/:id` | Manage schema. |
| POST | `/product-customization/schemas/:id/fields` | Add field. |
| PATCH / DELETE | `/product-customization/fields/:id` | Manage field. |
| GET / POST | `/coupons` | List/create coupons. |
| PATCH / DELETE | `/coupons/:id` | Manage coupon. |
| GET | `/admin/shipping/zones` | List delivery zones. |
| POST | `/admin/shipping/zones` | Create zone. |
| PATCH / DELETE | `/admin/shipping/zones/:id` | Manage zone. |
| POST | `/admin/shipping/slots` | Create delivery slot. |
| POST | `/admin/shipping/wraps` | Create gift wrap. |
| GET | `/admin/orders` | Paginated orders; `?status=`. |
| GET | `/admin/orders/:id` | Order detail. |
| GET | `/admin/orders/:id/timeline` | Status history. |
| PATCH | `/admin/orders/:id/status` | Append `OrderStatusHistory`. |
| PATCH | `/admin/orders/:id/notes` | Internal notes. |
| GET | `/admin/inventory` | Inventory levels. |
| GET | `/admin/inventory/low-stock` | Low-stock report. |
| POST | `/admin/inventory/:id/adjust` | Adjustment with ledger row. |
| GET | `/admin/payments` | Payment list. |
| POST | `/payments/:id/refund` | **Requires `X-Idempotency-Key`**. |
| GET | `/admin/reviews` | Review moderation queue. |
| PATCH | `/admin/reviews/:id` | Approve/reject review. |
| GET | `/admin/notifications` | Notification log. |
| GET / POST | `/admin/banners` | List/create banners. |
| PATCH / DELETE | `/admin/banners/:id` | Manage banner. |
| GET / POST | `/admin/store-settings` | List/create settings. |
| PATCH / DELETE | `/admin/store-settings/:key` | Manage setting. Only `public.*` keys reach the storefront. |
| GET | `/audit-logs` | Audit log, paginated. |
| GET | `/users` | User/staff list. |
| POST | `/users/staff` | Create staff account. |
| PATCH | `/users/:id/active` | Enable/disable account. |
| GET | `/roles` | Roles. |
| GET | `/roles/permissions` | Permission catalogue. |

## Webhook setup

1. `main.ts` registers `express.json({ verify })` and stores the exact raw body
   on `req.rawBody`. Signature verification uses those bytes — re-stringifying
   parsed JSON changes whitespace and breaks signatures.
2. Verify `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET`, or the Cashfree
   signature header with `CASHFREE_CLIENT_SECRET`. Reject invalid signatures
   with `400`; do not enqueue work.
3. Insert `PaymentWebhookEvent` with `signatureVerified: true` and the provider
   event id. The `(provider, externalId)` unique constraint makes duplicate
   deliveries harmless — a duplicate is acknowledged and skipped.
4. Only after verification and dedupe: move `Payment.status`, append order
   status history and enqueue notifications. Provider amounts/currencies are
   compared to stored `Payment.amount`/`Order.total`.
5. Acknowledge quickly with `2xx`. Slow work runs through BullMQ queues.
6. Configure the provider dashboard URL to `PAYMENT_WEBHOOK_URL`
   (`http://localhost:4000/api/v1/webhooks` locally; public HTTPS in
   production). Keep webhook secrets in a secret store, never in the repo.
