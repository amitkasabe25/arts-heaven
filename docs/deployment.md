# Deployment guide

Applies to the NestJS API in `apps/api`, the Prisma schema in
`apps/api/prisma/schema.prisma`, and the local stack in `infrastructure/`.
No real credentials belong in this repository — use the placeholders from
`apps/api/.env.example` and inject production values from a secret store.

## Prerequisites

- Node 22+ and npm 11+ (Node 22-alpine is used in the container).
- Docker Desktop / Engine with Compose v2, running for local work.
- AWS S3 bucket for customer uploads (private by default) and sandbox payment
  accounts for checkout development.

## Local development

1. Start Docker Desktop, then create local env files (never commit them):

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp .env.example .env.local
   ```

   The API defaults already match the compose stack, except that inside Docker
   the database host is `db` and Redis host is `redis` — the compose file
   overrides these for the `api` service automatically. The root `.env.local`
   only needs `VITE_API_BASE_URL` (defaults to
   `http://localhost:4000/api/v1`).

2. Bring up PostgreSQL 16, Redis 7, Mailpit and build the API image:

   ```bash
   docker compose -f infrastructure/docker-compose.yml up -d --build
   docker compose -f infrastructure/docker-compose.yml ps
   ```

   Published ports: API `4000`, PostgreSQL `5432`, Redis `6379`, Mailpit UI
   `8025`, Mailpit SMTP internal `1025`. Data lives in the named volumes
   `postgres_data` and `redis_data`.

3. Generate the Prisma client and apply the checked-in initial migration
   (`prisma/migrations/0001_init/migration.sql`):

   ```bash
   cd apps/api
   npx prisma generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```

   For local schema changes use `npx prisma migrate dev --name <change>`. The
   seed is idempotent and safe to re-run. It creates the eight categories,
   28 products, customization schemas, coupons, shipping data, settings,
   banners and two demo users.

4. Start the API in watch mode (outside Docker, using the `.env` you created):

   ```bash
   npm run start:dev
   ```

5. Start the storefront from the repository root if needed:

   ```bash
   npm install
   npm run dev        # Vite on http://localhost:5173
   ```

6. Verify and sign in to the admin UI:

   ```bash
   curl http://localhost:4000/api/v1/health
   curl http://localhost:4000/api/v1/docs
   # Mailpit UI: http://localhost:8025
   # Admin UI: http://localhost:5173/admin
   # Seed login: admin@artsheaven.local / ChangeMe123!
   ```

   The seeded admin password is for local development only. Change it or
   remove the demo account before deploying anywhere shared.

Useful compose commands:

```bash
docker compose -f infrastructure/docker-compose.yml logs -f api db redis mailpit
docker compose -f infrastructure/docker-compose.yml restart api
docker compose -f infrastructure/docker-compose.yml down            # keep volumes
docker compose -f infrastructure/docker-compose.yml down -v         # DESTROY local data
```

## Docker image

Build from the **repository root** — the Dockerfile intentionally copies
individual `apps/api` paths so a local `.env` is never baked into a layer:

```bash
docker build -f apps/api/Dockerfile -t artsheaven-api:local .
```

The multi-stage build is `deps` → `build` → `production`:

1. `deps`: Node 22-alpine + `openssl`, `npm ci` (all dependencies retained so the
   Prisma CLI is available at runtime).
2. `build`: `npx prisma generate` then `npm run build`.
3. `production`: non-root `app` user, compiled `dist/`, Prisma schema/migrations,
   `node_modules`, and `docker-entrypoint.sh`.

The entrypoint runs `npx prisma migrate deploy` and then `exec`s the CMD
(`node dist/main.js`). Set `SKIP_MIGRATIONS=1` for one-off jobs or when a sidecar
already applied migrations. If you copy the script onto a Windows host, keep the
`#!/bin/sh` line and LF endings — the image applies `chmod 755` during build.

## Production deployment

1. Provision PostgreSQL 16 and Redis 7 (managed services preferred) and create
   the `artsheaven` database/user with a strong, secret-store-managed password.
2. Store every secret in your secret manager; inject as environment variables at
   deploy time. Do not create `apps/api/.env` on production hosts.
3. Build and push an immutable image tag, then deploy with a rolling strategy:

   ```bash
   docker build -f apps/api/Dockerfile -t registry.example.com/artsheaven-api:$GIT_SHA .
   docker push registry.example.com/artsheaven-api:$GIT_SHA
   docker run -d --name artsheaven-api --restart unless-stopped \
     --env-file /run/secrets/artsheaven-api.env \
     -p 4000:4000 registry.example.com/artsheaven-api:$GIT_SHA
   ```

   Replace the sample registry with your own. In Kubernetes/Cloud Run, use the
   same image and inject env vars from Secrets; do not publish PostgreSQL or
   Redis directly.
4. Put the API behind TLS (reverse proxy/load balancer) with health checks on
   `GET /api/v1/health`, and restrict egress to S3, SMTP and payment providers.
5. Run the seed **once** on a fresh database with an operator kubectl/docker
   exec; never on every deploy. Rotate the two demo passwords immediately or
   delete the demo users in production.
6. Deploy app instances one at a time. Migrations run from the first starting
   container; keep schema changes expand/contract so old and new pods can
   coexist during a rollout.

## Migrations

```bash
# Development — create and apply a migration
cd apps/api
npx prisma migrate dev --name add_customization_field

# Inspect state
npx prisma migrate status

# Production / containers — apply checked-in migrations only
npx prisma migrate deploy
# or, against the compose stack:
docker compose -f infrastructure/docker-compose.yml exec api npx prisma migrate deploy
```

Rules:

- `migrate dev` is for local development only; it may reset the database.
- `migrate deploy` never resets data and is the only command the production
  entrypoint runs.
- Back up before every production migration. Never edit an applied migration;
  add a new forward migration instead.
- Destructive changes (drop/rename column, tighten nullability) need an
  expand → backfill → contract sequence across two releases.
- If a migration fails mid-way, inspect `._prisma_migrations`, fix the root
  cause, and use `prisma migrate resolve --applied/--rolled-back <name>` only
  after confirming database state.

## Backup and restore

Logical backup of PostgreSQL (custom, compressed format):

```bash
docker compose -f infrastructure/docker-compose.yml exec -T db \
  pg_dump -U artsheaven -Fc artsheaven > artsheaven-$(date +%Y%m%d-%H%M).dump
```

Restore into the existing database (destructive — `--clean` drops objects):

```bash
docker compose -f infrastructure/docker-compose.yml exec -T db \
  pg_restore --clean --if-exists --no-owner --no-privileges -U artsheaven -d artsheaven \
  < artsheaven-20261121-0900.dump
```

Safer restore drill into a scratch database:

```bash
docker compose -f infrastructure/docker-compose.yml exec db \
  createdb -U artsheaven artsheaven_restore_test
docker compose -f infrastructure/docker-compose.yml exec -T db \
  pg_restore --no-owner --no-privileges -U artsheaven -d artsheaven_restore_test \
  < artsheaven-20261121-0900.dump
```

- Take automated daily backups in production and retain at least 30 days; test
  a restore every month. Copy backups off the database host.
- For point-in-time recovery use managed PostgreSQL PITR/WAL archiving; the
  `pg_dump` above is a logical backup, not a substitute for PITR.
- Redis has AOF persistence in the named `redis_data` volume. Queues are
  rebuildable; do not treat Redis as the source of truth.
- Enable S3 versioning and a lifecycle policy for customer uploads; a database
  restore alone does not restore deleted objects.

## Queue worker and scheduler

`QueueModule` defines producers for `artsheaven-notifications` and
`artsheaven-inventory` (BullMQ, Redis). Default job options are 5 attempts with
5-second exponential backoff. Two standalone entrypoints consume those queues
and run the scheduled sweeps:

- `src/worker.ts` → `dist/worker.js` starts BullMQ consumers for notification
  delivery and inventory reservation expiry/release.
- `src/scheduler.ts` → `dist/scheduler.js` runs `@nestjs/schedule` cron jobs for
  reservation expiry (every 5 minutes), failed-notification retries (hourly),
  abandoned-payment expiry and data cleanup (daily).

The API process (`dist/main.js`) hosts neither consumers nor cron jobs by
design — run all three processes in production:

```bash
# HTTP API
node dist/main.js

# Dedicated queue worker (notification delivery + inventory jobs)
node dist/worker.js

# Dedicated scheduler (expire reservations, retry notifications, cleanup)
node dist/scheduler.js
```

The equivalent development scripts are `npm run worker` and `npm run scheduler`
(`--entryFile worker` / `--entryFile scheduler`); production variants are
`npm run worker:prod` and `npm run scheduler:prod`.

Run workers with `SKIP_MIGRATIONS=1` if you reuse the API image/entrypoint.
Handlers must be idempotent (check `PaymentWebhookEvent`, `Notification.status`,
`StockReservation.status`) because BullMQ retries deliver the same job again.
Scale workers by queue name, and monitor failed/delayed job counts.

## S3 IAM policy outline

Replace `artsheaven-dev` with the real bucket; grant this to the API role only.
Customer uploads stay private; public catalogue images are served by the CDN or
public bucket prefix and referenced as `/images/...` in seed data.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucketForPresign",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::artsheaven-dev"
    },
    {
      "Sid": "ObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": [
        "arn:aws:s3:::artsheaven-dev/customers/*",
        "arn:aws:s3:::artsheaven-dev/products/*",
        "arn:aws:s3:::artsheaven-dev/banners/*"
      ]
    }
  ]
}
```

Additional controls: enforce HTTPS-only bucket policy (`aws:SecureTransport`),
enable server-side encryption (SSE-S3 or KMS), block public access on the
`customers/` prefix, and keep `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in the
secret store (prefer OIDC/IRSA over long-lived keys).

## Payments: sandbox configuration

| Provider | Environment variables | Sandbox notes |
| --- | --- | --- |
| Razorpay | `PAYMENT_DEFAULT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Use test key IDs from the Razorpay test-mode dashboard. Subscribe to `payment.captured`, `payment.failed`, `refund.processed`. Test card `4111 1111 1111 1111` with any future expiry/CVV in test mode. |
| Cashfree | `PAYMENT_DEFAULT_PROVIDER=cashfree`, `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_API_VERSION=2023-12-12`, `CASHFREE_ENVIRONMENT=TEST` | Use TEST client credentials. Subscribe to `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `REFUND_STATUS_WEBHOOK`. |

Both providers use `PAYMENT_WEBHOOK_URL` (`http://localhost:4000/api/v1/webhooks`
locally; public HTTPS URL in production). Webhook secrets are mandatory in
production — see [`api.md`](api.md#webhook-setup). Raw card fields must never
reach this API: the backend returns provider checkout/session data only.

For local callback testing, expose the API through a tunnel and set the provider
dashboard URLs to:

```text
https://<tunnel-host>/api/v1/webhooks/razorpay
https://<tunnel-host>/api/v1/webhooks/cashfree
```

The webhook handlers verify signatures against the exact raw request body,
deduplicate provider event ids, and only then change payment/order state.
Never mark an order paid from a browser callback; `POST /payments/verify` and
the webhook handlers are the only trusted paths.

## Environment variable checklist

Copy [`apps/api/.env.example`](../apps/api/.env.example) as the starting point.
Values in the example are placeholders; production values come from a secret store.

| Variable | Dev default | Production action |
| --- | --- | --- |
| `VITE_API_BASE_URL` (root `.env.local`) | `http://localhost:4000/api/v1` | Public HTTPS API URL baked into the storefront build. |
| `NODE_ENV` | `development` | `production` |
| `API_PORT` | `4000` | Match container/port config. |
| `API_PREFIX` | `api/v1` | Keep stable for clients. |
| `APP_URL` | `http://localhost:5173` | Comma-separated HTTPS storefront origins. |
| `API_URL` | `http://localhost:4000/api/v1` | Public HTTPS API URL. |
| `DATABASE_URL` | local `artsheaven` | Managed Postgres URL; strong secret. |
| `JWT_ACCESS_SECRET` | placeholder | **Rotate**, 32+ random bytes, secret store. |
| `JWT_REFRESH_SECRET` | placeholder | **Rotate**, different value from access secret. |
| `JWT_ACCESS_TTL` | `15m` | Keep short. |
| `JWT_REFRESH_TTL` | `7d` | Shorter for staff accounts if required. |
| `JWT_EMAIL_VERIFY_SECRET` / `JWT_PASSWORD_RESET_SECRET` | placeholder | **Rotate**, independent values. |
| `BCRYPT_ROUNDS` | `12` | 12–14; benchmark login latency. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | `localhost`/`6379`/empty/`0` | Managed Redis host, TLS/auth credentials. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_PUBLIC_BASE_URL` | `ap-south-1`, `artsheaven-dev`, empty | Production bucket and CDN base URL. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | empty | Prefer OIDC/IRSA; never commit. |
| `PAYMENT_DEFAULT_PROVIDER` | `razorpay` | Choose enabled provider. |
| `RAZORPAY_*`, `CASHFREE_*` | empty | Live/test credentials and webhook secrets from secret store. |
| `CASHFREE_ENVIRONMENT` | `TEST` | `PRODUCTION` only after sign-off. |
| `PAYMENT_WEBHOOK_URL` | localhost | Public HTTPS endpoint. |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` (Mailpit in compose) | Production SMTP/SES endpoint. |
| `SMTP_USER` / `SMTP_PASS` | empty | Secret store. |
| `MAIL_FROM` | `no-reply@artsheaven.local` | Verified production sender. |

## Production security checklist

- [ ] TLS everywhere; HSTS and secure cookies; reverse proxy hides internal ports.
- [ ] CORS restricted to explicit storefront/admin origins (never `*` with credentials).
- [ ] All secrets rotated, stored in a secret manager, and excluded from images
      and git; demo users/passwords removed or rotated.
- [ ] Helmets/security headers enabled (already applied in `main.ts`) and Swagger
      disabled or protected behind staff auth in production.
- [ ] Rate limits verified at the edge and in `ThrottlerModule` (120/min global,
      tighter auth limits); webhook endpoints not rate-limited by mistake.
- [ ] Webhook signatures verified against `rawBody`; event dedupe enabled;
      provider secrets rotated on a schedule.
- [ ] RBAC permissions audited from `roles.constants.ts`; admin endpoints require
      `@Roles`/`@Permissions`; audit logs retained.
- [ ] Database least privilege, TLS connections, encrypted backups with tested
      restore, PITR enabled.
- [ ] S3 objects private by default, presigned URLs short-lived, bucket policy
      enforces HTTPS and encryption.
- [ ] Container runs as non-root, read-only root filesystem where possible, no
      Docker socket, minimal base image, pinned image digest.
- [ ] No raw card data in requests/logs; payment errors never leak provider secrets.
- [ ] Monitoring/alerting for 5xx rate, webhook verification failures, failed
      queue jobs, stale stock reservations and disk usage.
- [ ] Migration and rollback runbooks reviewed; deploy is rolling with health checks.
