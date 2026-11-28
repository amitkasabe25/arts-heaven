# Artsheaven Platform — Implementation Plan

## Phase 1: Repository analysis

### What exists today

- **Frontend**: TanStack Start (file-based routing in `src/routes`), React 19, Vite 8, TypeScript, Tailwind 4, shadcn/ui primitives in `src/components/ui`, site components in `src/components/site`. `@tanstack/react-query` is already wired in `src/router.tsx` and `src/routes/__root.tsx`.
  - TanStack Router is already correctly implemented and is the routing layer that must be preserved — replacing it with React Router would break the app. The requirement "preserve existing frontend technology choices if already implemented correctly" takes precedence.
- **Data**: `src/lib/catalog.ts` holds all products, categories, occasions, orders, FAQs and analytics as in-code seeds. `src/lib/store.tsx` persists the entire catalogue, cart, wishlist, orders, gift options, profile and preferences to `localStorage` under `artsheaven:v1:*`. `src/lib/pricing.ts` contains client-side money rules (free delivery threshold, wraps, slots, two coupons). `src/lib/images.ts` maps image keys to bundled assets.
- **Customer workflows**: shop/category/product pages, product detail with size selection + personalisation text, pincode check, local wishlist, build-your-own box, cart with wraps/card/coupon, checkout form (simulated payment with a 900 ms timeout), order detail page.
- **Admin**: no admin routes exist yet. `src/routes/__root.tsx` already hides the header/footer on paths beginning with `/admin`, so an admin route tree can be added without touching the storefront shell.
- **Mock/static areas to replace progressively**: catalogue, categories, pricing/coupons, delivery checks, orders/order history, reviews (hard-coded sample reviews), profile/addresses.

### Constraints and decisions

1. **Branch**: work is on `feature/nestjs-platform`. The uncommitted frontend files on `main` are carried along and left untouched unless integration explicitly requires a change.
2. **Layout**: keep the storefront at the repository root (no file migration). Add `apps/api` (NestJS), `packages/shared` (contract types), `docs`, `infrastructure`. An admin UI will be added as `/admin` routes in the existing React app so it reuses the same shadcn design system.
3. **Runtime available**: Node 26, npm 11, PHP/Composer (unused), Docker CLI installed but the daemon is **not running**, no local PostgreSQL/Redis binaries. Therefore integration tests that need a live database cannot be executed here; they are written and documented, and unit tests with mocked repositories are executed. This is reported honestly rather than claimed as passing.
4. **Money**: Prisma `Decimal(12,2)`, INR, converted with `Prisma.Decimal`; no floats in persisted monetary fields. Client-supplied prices are never accepted.
5. **Auth**: short-lived JWT access token + rotating hashed refresh tokens in `Session`; bcryptjs password hashing; RBAC loaded from the database via guards — roles/permissions from the client are ignored.
6. **Critical invariants**: checkout is transactional and idempotent; stock reservation rows expire; payment status is only changed by verified provider callbacks/server verification; webhook events are deduplicated by provider event id; order items store immutable snapshots.
7. **Customization**: schema-driven (`ProductCustomizationSchema` -> `ProductCustomizationField`) with server-side validation. No per-category hardcoded handlers.
8. **Storage**: S3 via presigned URLs; private objects for customer uploads; image keys generated server-side.

## Phase map

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Repository analysis, plan | Complete |
| 2 | NestJS foundation, Prisma schema, config, auth, RBAC, common infrastructure | Complete |
| 3 | Categories, products, variants, images, customization engine, uploads | Complete |
| 4 | Cart, checkout, coupons, shipping | Complete |
| 5 | Orders, payments (Razorpay/Cashfree), webhooks, refunds | Complete |
| 6 | Inventory, notifications, admin APIs, reporting | Complete |
| 7 | Storefront API client + progressive integration, admin UI | Complete |
| 8 | Tests, security review, builds | Complete (DB-backed e2e pending live services) |
| 9 | Docker, env examples, deployment docs | Complete |

## API contract

All `/api/v1` responses use:

```json
{ "success": true, "message": "Product fetched successfully", "data": {}, "meta": {} }
```

Errors use the same envelope with `success: false` and `data: null`.

## Risks

- A live PostgreSQL/Redis instance is needed for end-to-end verification. Docker Desktop must be started and `docker compose up -d` run from `infrastructure/` (or a managed Postgres/Redis used).
- AWS/payment credentials are external. Integrations are implemented against sandbox/test configuration and documented; no credentials are committed.
- The existing checkout UI collects raw card fields. Those fields must never be sent to this API; the backend only accepts a payment method/provider and returns provider checkout/session data.
