# Testing

## Unit tests (no external services)

From `apps/api`:

```bash
npm install
npx prisma generate
npm run typecheck
npm test
```

The unit suite covers money arithmetic, the order state machine, coupon rules,
idempotency claims, Razorpay/Cashfree signature verification and webhook
deduplication with mocked providers. It does not need PostgreSQL or Redis.

## Database-backed end-to-end tests

Supertest suites under `apps/api/test/*.e2e-spec.ts` boot the **real** NestJS
application (guards, pipes, interceptors, Prisma, BullMQ producers) against a
real database. They cover:

| Suite | What it proves |
| --- | --- |
| `auth.e2e-spec.ts` | registration, login, `me`, refresh rotation and reuse rejection, staff gating |
| `catalogue.e2e-spec.ts` | public catalogue reads, admin-only writes, pagination envelope |
| `cart-checkout.e2e-spec.ts` | guest cart lifecycle, server-side pricing, idempotent order placement, stock/coupon side effects |
| `payments.e2e-spec.ts` | provider order creation, verification, amount checks, webhook signature/dedupe (Razorpay HTTP adapter stubbed) |
| `admin.e2e-spec.ts` | RBAC, dashboard, order state machine, status history, audit logs |
| `inventory.e2e-spec.ts` | stock adjustments, audit trail, oversell protection, reservation expiry |

### Required services

- PostgreSQL 16 with a dedicated **test** database
- Redis 7 (BullMQ producers; DB 15 is used by default to avoid clobbering dev queues)

```bash
# from the repository root
docker compose -f infrastructure/docker-compose.yml up -d postgres redis

# create the test database once
docker compose -f infrastructure/docker-compose.yml exec postgres \
  createdb -U postgres artsheaven_test

# from apps/api
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/artsheaven_test?schema=public' \
  npx prisma migrate deploy
npm run test:e2e
```

Environment defaults live in `apps/api/test/env.ts`; override them with real
environment variables when using managed services or non-default ports.

> ⚠️ **`test:e2e` TRUNCATEs every table except `_prisma_migrations`.** Never
> point `DATABASE_URL` at a development or production database.

The suites were authored for this branch but **have not been executed in the
environment where they were written**: the local Docker daemon and PostgreSQL/
Redis binaries were unavailable. Run them in CI or on a machine with both
services before treating them as green. Do not report them as passing otherwise.

## Frontend checks

From the repository root:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test
```

Lint currently reports only pre-existing `react-refresh/only-export-components`
warnings from shadcn/ui primitives and `src/lib/store.tsx`; there are no errors.
