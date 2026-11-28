# Artsheaven — AWS Deployment Guide

Audience: DevOps engineers deploying the Artsheaven platform to AWS for the
first time. It assumes familiarity with ECS, RDS, ElastiCache, ALB and IAM.

For the local stack, Dockerfile internals, migration rules and the full
security checklist, see [`deployment.md`](deployment.md). This guide covers
what is specific to AWS, and the code gaps you must know about before
production.

---

## 1. What you are deploying

The repository contains **four runtime processes** and three backing services.

| Component | Source | Runs as | Notes |
| --- | --- | --- | --- |
| **web** (storefront + `/admin` UI) | repo root (`src/`) | Node 22 server built by Vite/Nitro | Server-side rendered TanStack Start app. The admin panel is the `/admin` route of this same app. |
| **api** | `apps/api` | `node dist/main.js` | NestJS REST API on port `4000`, prefix `/api/v1`. |
| **worker** | `apps/api` | `node dist/worker.js` | BullMQ consumers (emails, inventory reservation release). No HTTP port. |
| **scheduler** | `apps/api` | `node dist/scheduler.js` | Cron jobs (reservation expiry every 5 min, retries, cleanup). No HTTP port. **Exactly one instance.** |
| PostgreSQL 16 | — | Amazon RDS | Source of truth. |
| Redis 7 | — | Amazon ElastiCache | Queues and cache; rebuildable. |
| Object storage | — | Amazon S3 | Customer uploads (private), product/banner images. |

The api, worker and scheduler all use **one Docker image**
(`apps/api/Dockerfile`) with different commands.

### Recommended AWS topology

```text
                 Route 53
        www.example.com   api.example.com
                 │               │
            ┌────┴───────────────┴────┐
            │  ALB (HTTPS, ACM cert)  │  public subnets
            └────┬───────────────┬────┘
      host: www  │               │ host: api
          ┌──────▼─────┐  ┌──────▼─────┐
          │ ECS: web   │  │ ECS: api   │    private subnets
          │ :3000      │  │ :4000      │    (Fargate)
          └────────────┘  └──────┬─────┘
                ECS: worker ─────┤
                ECS: scheduler ──┤
                                 │
              ┌──────────────────┼─────────────────┐
              ▼                  ▼                 ▼
        RDS PostgreSQL 16   ElastiCache Redis 7   S3 bucket
                                                  SES (SMTP)
```

- Region: `ap-south-1` (Mumbai). It is the default in the code, and both
  payment providers (Razorpay, Cashfree) are Indian.
- `example.com` is a placeholder throughout. Replace it with the real domain.
- Auth tokens travel in the `Authorization` header and request body, not in
  cookies. The web and api hosts therefore don't need to share a cookie
  domain. Only CORS has to be right (see §6).

---

## 2. Fix these before going to production

These were found while reviewing the code for this guide. Items 1–3 **will
break production** if deployed as-is, so raise them with the development team
first. Each needs a small code change. Nothing has been changed yet.

| # | Issue | Impact on AWS | Required fix (code) |
| --- | --- | --- | --- |
| 1 | Express `trust proxy` is not set in `apps/api/src/main.ts`. | Behind the ALB every request appears to come from the ALB's IP. The global rate limit (120 req/min per IP, `ThrottlerModule`) is then shared by **all users**, and they get HTTP 429 under normal traffic. | Add `app.set('trust proxy', 1)` (Nest Express app) before listening. |
| 2 | S3 client requires `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (`apps/api/src/uploads/uploads.service.ts`). If they're empty, it throws "Object storage is not configured". | An ECS **task role alone does not work**. Uploads fail. | Either inject IAM user keys from Secrets Manager (workaround, see §5), or change the code to fall back to the default AWS credential chain when keys are empty (preferred). |
| 3 | Redis clients have no TLS option (`common/redis`, `common/queue`, `worker/queue-workers.service.ts`). | ElastiCache with **in-transit encryption enabled will not connect**. | Either create ElastiCache with in-transit encryption **disabled** inside private subnets (workaround), or add a `REDIS_TLS` flag that passes `tls: {}` to ioredis/BullMQ (preferred). |
| 4 | Swagger UI is always served at `/api/v1/docs`. | Public API documentation in production. | Block it at the ALB (§7), or gate it on `NODE_ENV !== 'production'` in code. |
| 5 | `GET /api/v1/health` returns HTTP 200 even when the database is down (body says `"status":"degraded"`). | ALB/ECS health checks won't remove a task that has lost the database. | Acceptable to launch with. Add a CloudWatch alarm on 5xx. Ideally return 503 when degraded. |
| 6 | `APP_URL` is used for **both** the CORS allow-list (comma-separated) **and** the post-payment redirect URL (`payments.service.ts`). | A comma-separated list produces a broken payment redirect. | Set `APP_URL` to **one** origin, e.g. `https://www.example.com`. The admin UI is on the same origin, so one is enough. |
| 7 | The seed creates demo users (`admin@artsheaven.local` / `ChangeMe123!`). | Known credentials in production. | After seeding, change the admin password immediately or create a real admin and delete the demo users (§8.3). |

> Also note: the database-backed e2e test suites have **never been run**
> (see [`testing.md`](testing.md)). Run them against a staging environment
> before taking real orders.

---

## 3. AWS resources to provision

Sizes are reasonable starting points for launch traffic, not measured
requirements. Adjust after load testing.

| Resource | Configuration |
| --- | --- |
| **VPC** | 2+ AZs. Public subnets (ALB, NAT gateway), private subnets (ECS, RDS, ElastiCache). |
| **ECR** | Repositories `artsheaven-api` and `artsheaven-web`. Enable image scanning, tag immutability. |
| **RDS PostgreSQL 16** | `db.t4g.small`+, Multi-AZ for production, encrypted storage, automated backups ≥ 7 days (30 recommended), PITR on, deletion protection on. Database `artsheaven`, dedicated app user. |
| **ElastiCache Redis 7** | `cache.t4g.small`, 1 primary + 1 replica, AUTH token set. **In-transit encryption off** until issue #3 is fixed. Persistence is not required: queues are rebuildable. |
| **S3** | One bucket, e.g. `artsheaven-prod-assets`. Block public access, SSE-S3 or KMS, versioning on, HTTPS-only bucket policy, CORS rule (§6.3). |
| **SES** | Verify the sending domain (DKIM/SPF/DMARC), request production access, create SMTP credentials. |
| **ACM** | Certificate for `www.example.com` and `api.example.com` in the ALB's region. |
| **ALB** | HTTPS :443 listener (HTTP :80 → redirect to 443). Host-based rules → `web` and `api` target groups. |
| **ECS (Fargate)** | One cluster, four services (table below). |
| **Secrets Manager** | All secrets in §5. |
| **CloudWatch** | Log groups per service, alarms (§9). |

### ECS services

| Service | Image | Command | Port | Desired count | Health check |
| --- | --- | --- | --- | --- | --- |
| `web` | `artsheaven-web` | `node .output/server/index.mjs` | 3000 | 2 | ALB: `GET /` → 200 |
| `api` | `artsheaven-api` | `node dist/main.js` (default) | 4000 | 2 | ALB: `GET /api/v1/health` → 200 |
| `worker` | `artsheaven-api` | `node dist/worker.js` | — | 1–2 | none (no port). Watch logs/queue depth. |
| `scheduler` | `artsheaven-api` | `node dist/scheduler.js` | — | **exactly 1** | none. Never scale above 1, or cron jobs run twice. |

Starting size: 0.5 vCPU / 1 GB for each service. Set `SKIP_MIGRATIONS=1` on
**all four services** and run migrations as a separate one-off task (§8.1).
The image's entrypoint otherwise runs `prisma migrate deploy` on every
container start.

### Security groups

| SG | Inbound |
| --- | --- |
| `alb-sg` | 443, 80 from `0.0.0.0/0` |
| `web-sg` | 3000 from `alb-sg` |
| `api-sg` | 4000 from `alb-sg` (worker/scheduler share this SG, no inbound needed) |
| `rds-sg` | 5432 from `api-sg` (and a bastion/SSM host if used) |
| `redis-sg` | 6379 from `api-sg` |

Outbound from ECS: S3 (use a VPC gateway endpoint), SES SMTP (587),
Razorpay/Cashfree HTTPS APIs, ECR/CloudWatch/Secrets Manager (NAT or VPC
endpoints).

---

## 4. Build the images

Always build from the **repository root**.

### 4.1 API image (exists: `apps/api/Dockerfile`)

```bash
ACCOUNT=123456789012; REGION=ap-south-1; TAG=$(git rev-parse --short HEAD)
REG=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REG

docker build -f apps/api/Dockerfile -t $REG/artsheaven-api:$TAG .
docker push $REG/artsheaven-api:$TAG
```

The image runs as non-root user `app`, exposes `4000`, and its entrypoint
runs migrations unless `SKIP_MIGRATIONS=1`.

### 4.2 Web image (no Dockerfile in the repo yet)

The frontend's Vite config (`@lovable.dev/vite-tanstack-config`) builds for
**Cloudflare Workers by default**. For AWS, build it as a Node server by
setting `NITRO_PRESET=node-server`. Two build-time requirements:

- `NODE_ENV=production` **must** be set during the build. Without it the SSR
  bundle uses the development JSX runtime and every page returns HTTP 500
  (`jsxDEV is not a function`).
- `VITE_API_BASE_URL` is **baked in at build time**. Build one image per
  environment (staging vs production). Changing it at runtime has no effect.

This was verified locally: with both variables set, `/`, `/shop`, `/cart`
and `/admin` all render with HTTP 200 from `node .output/server/index.mjs`.

Suggested `Dockerfile.web` for the repo root. **It has not been built or
tested yet**, so validate it in staging:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV NODE_ENV=production \
    NITRO_PRESET=node-server \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npx vite build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/.output ./.output
RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Add a `.dockerignore` at the root that excludes at least `node_modules`,
`.output`, `.env*`, `apps/` and `.git`, so local env files never enter the
image.

```bash
docker build -f Dockerfile.web \
  --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 \
  -t $REG/artsheaven-web:$TAG .
docker push $REG/artsheaven-web:$TAG
```

> **Lovable:** this repo syncs with Lovable, which hosts the frontend on its
> own infrastructure. If the business keeps the storefront on Lovable, deploy
> only the api/worker/scheduler to AWS and set `APP_URL` to the Lovable
> domain. Agree on this with the product owner before building the web stack.

---

## 5. Secrets and environment variables

Store secrets in **Secrets Manager** and reference them from the ECS task
definitions (`secrets` block). Plain config goes in `environment`. Never create
an `.env` file in an image or on a host. The authoritative list with
validation is `apps/api/src/common/config/env.validation.ts`.

### api / worker / scheduler (same set for all three)

| Variable | Production value | Secret? |
| --- | --- | --- |
| `NODE_ENV` | `production` | no |
| `API_PORT` | `4000` | no |
| `API_PREFIX` | `api/v1` | no |
| `APP_URL` | `https://www.example.com` (**single origin**, see issue #6) | no |
| `API_URL` | `https://api.example.com/api/v1` | no |
| `DATABASE_URL` | `postgresql://USER:PASS@<rds-endpoint>:5432/artsheaven?schema=public&sslmode=require` | **yes** |
| `JWT_ACCESS_SECRET` | 32+ random bytes (`openssl rand -base64 48`) | **yes** |
| `JWT_REFRESH_SECRET` | different 32+ random bytes | **yes** |
| `JWT_EMAIL_VERIFY_SECRET` | different random value (defaults to an insecure placeholder if unset) | **yes** |
| `JWT_PASSWORD_RESET_SECRET` | different random value (defaults to an insecure placeholder if unset) | **yes** |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `7d` | no |
| `BCRYPT_ROUNDS` | `12` | no |
| `REDIS_HOST` | ElastiCache primary endpoint | no |
| `REDIS_PORT` | `6379` | no |
| `REDIS_PASSWORD` | ElastiCache AUTH token | **yes** |
| `REDIS_DB` | `0` | no |
| `UPLOAD_DRIVER` | `s3` (default). Never `local` on Fargate: the disk is ephemeral. | no |
| `AWS_REGION` | `ap-south-1` | no |
| `AWS_S3_BUCKET` | `artsheaven-prod-assets` | no |
| `AWS_S3_PUBLIC_BASE_URL` | CloudFront/S3 URL for public images, if used | no |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | keys of a dedicated IAM user with the policy in §6.3 (required until issue #2 is fixed) | **yes** |
| `PAYMENT_DEFAULT_PROVIDER` | `razorpay`, `cashfree` or `cod` | no |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | from Razorpay dashboard | **yes** |
| `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` | from Cashfree dashboard | **yes** |
| `CASHFREE_ENVIRONMENT` | `TEST` in staging, `PRODUCTION` after sign-off | no |
| `CASHFREE_API_VERSION` | `2023-12-12` | no |
| `PAYMENT_WEBHOOK_URL` | `https://api.example.com/api/v1/webhooks` | no |
| `SMTP_HOST` / `SMTP_PORT` | `email-smtp.ap-south-1.amazonaws.com` / `587` | no |
| `SMTP_USER` / `SMTP_PASS` | SES SMTP credentials | **yes** |
| `MAIL_FROM` | `Artsheaven <no-reply@example.com>` (SES-verified) | no |
| `SKIP_MIGRATIONS` | `1` on long-running services | no |

The API refuses to start if `DATABASE_URL` is missing or the JWT access or
refresh secrets are shorter than 16 characters.

### web

| Variable | When | Value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | **build time** (`--build-arg`) | `https://api.example.com/api/v1` |
| `NODE_ENV` | build + runtime | `production` |
| `PORT` / `HOST` | runtime | `3000` / `0.0.0.0` |

### IAM roles

- **Task execution role** (all services): `AmazonECSTaskExecutionRolePolicy` plus
  `secretsmanager:GetSecretValue` (and `kms:Decrypt` if using a CMK) on the
  Artsheaven secrets only.
- **Task role** (api/worker/scheduler): nothing is needed today, because S3
  uses static keys (issue #2). Once that's fixed, attach the S3 policy in §6.3
  here and delete the IAM user.

---

## 6. Integrations

### 6.1 CORS

The API only accepts browser requests from the origins in `APP_URL`. A wrong
value shows up as "admin/customer can't log in" with a CORS error in the
browser console. Verify it after deploy:

```bash
curl -s -i -X OPTIONS https://api.example.com/api/v1/auth/login \
  -H "Origin: https://www.example.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
# expect: Access-Control-Allow-Origin: https://www.example.com
```

### 6.2 Payment webhooks

Register these URLs in each provider's dashboard. The ALB must forward the raw
body unchanged, because the API verifies signatures against it. Don't put a
WAF body-transform or rate rule on these paths.

| Provider | URL | Events |
| --- | --- | --- |
| Razorpay | `https://api.example.com/api/v1/webhooks/razorpay` | `payment.captured`, `payment.failed`, `refund.processed` |
| Cashfree | `https://api.example.com/api/v1/webhooks/cashfree` | `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `REFUND_STATUS_WEBHOOK` |

After a payment, customers are redirected to `${APP_URL}/order/<orderNumber>`.

### 6.3 S3

Browsers upload directly to S3 with presigned `PUT` URLs, so the bucket needs
a CORS rule:

```json
[
  {
    "AllowedOrigins": ["https://www.example.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

IAM policy for the API (attach to the IAM user now, or to the task role after
issue #2 is fixed):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::artsheaven-prod-assets"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::artsheaven-prod-assets/customers/*",
        "arn:aws:s3:::artsheaven-prod-assets/products/*",
        "arn:aws:s3:::artsheaven-prod-assets/banners/*"
      ]
    }
  ]
}
```

Keep `customers/` private. If product/banner images should be public, serve
them through CloudFront with Origin Access Control rather than a public bucket.

### 6.4 Email (SES)

Use the SES SMTP interface. Messages are sent by the **worker**, so if
emails don't arrive, check the worker logs, not the api logs.

---

## 7. Load balancer rules

| Priority | Condition | Action |
| --- | --- | --- |
| 1 | Host `api.example.com` **and** path `/api/v1/docs*` | Fixed response 404 (hides Swagger, issue #4) |
| 2 | Host `api.example.com` | Forward → `api-tg` (port 4000) |
| 3 | Host `www.example.com` | Forward → `web-tg` (port 3000) |
| default | — | Fixed response 404 |

- Target group health checks: `api-tg` → `/api/v1/health`; `web-tg` → `/`.
  Healthy threshold 2, interval 15 s.
- Idle timeout: 60 s (default) is fine.
- Optionally redirect the apex `example.com` → `www.example.com`.

---

## 8. First deployment, step by step

Do this in **staging first**, with payment providers in TEST mode.

### 8.1 Run migrations (one-off ECS task)

Run the api task definition once with the default entrypoint. Set
`SKIP_MIGRATIONS` unset (or `0`) and override the command so the container
exits after migrating:

```bash
aws ecs run-task --cluster artsheaven --launch-type FARGATE \
  --task-definition artsheaven-api \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-PRIVATE],securityGroups=[sg-API],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["true"],"environment":[{"name":"SKIP_MIGRATIONS","value":"0"}]}]}'
```

The entrypoint runs `npx prisma migrate deploy`, then `exec true`, and the
task exits. Check the CloudWatch log for success. Repeat this step on every
release that contains new migrations, **before** updating the services.

### 8.2 Seed the database (once, fresh database only)

The seed creates categories, ~28 products, customization schemas, coupons,
shipping rules, settings, banners and two demo users. It is idempotent, but
run it **once**, never as part of every deploy.

Run it as a one-off task with command
`["npx","ts-node","prisma/seed.ts"]` and `SKIP_MIGRATIONS=1`. `ts-node` is
present in the image, but the runtime stage doesn't include `tsconfig.json`,
so **this path is untested**. If it fails, run the seed from a CI job or a
bastion with a repository checkout:

```bash
cd apps/api && npm ci && DATABASE_URL='<prod url>' npm run prisma:seed
```

### 8.3 Secure the admin account

Immediately after seeding:

1. Log in at `https://www.example.com/admin` with `admin@artsheaven.local` /
   `ChangeMe123!`.
2. Create a real admin with a company email and strong password and give it the
   `SUPER_ADMIN` role, or change the demo password.
3. Delete or disable both demo users.

Staff roles: `SUPER_ADMIN`, `STORE_MANAGER`, `ORDER_MANAGER`,
`INVENTORY_MANAGER` (`apps/api/src/roles/roles.constants.ts`). Give staff
the narrowest role that fits.

### 8.4 Start the services

Create or update the four ECS services (§3) with the new image tags. Use a
rolling deployment (minimum healthy 100 %, maximum 200 %) with the deployment
circuit breaker and rollback enabled.

### 8.5 Smoke test

```bash
curl -s https://api.example.com/api/v1/health      # "status":"ok","database":"up"
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/api/v1/docs   # 404
curl -s -o /dev/null -w "%{http_code}\n" https://www.example.com/              # 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.example.com/admin         # 200
```

Then, in a browser:

- [ ] Storefront lists products; product page loads images.
- [ ] Admin login works at `/admin` (no CORS error in the browser console).
- [ ] A customer can register and receives the email (worker + SES working).
- [ ] A test-mode payment completes, the webhook arrives, and the order shows
      as paid in the admin panel.
- [ ] A customization image upload succeeds (S3 + bucket CORS working).
- [ ] Rapid page loads from two different networks are not rate-limited
      together (issue #1 fixed).

---

## 9. Operations

### Logging and alarms

Send each ECS service to its own CloudWatch log group (`awslogs` driver,
30-day retention). Minimum alarms:

| Alarm | Source |
| --- | --- |
| ALB 5xx rate > 1 % for 5 min | ALB `HTTPCode_Target_5XX_Count` |
| Unhealthy hosts > 0 | target group `UnHealthyHostCount` |
| RDS CPU > 80 %, free storage < 20 %, connections near max | RDS |
| Redis memory > 80 %, evictions > 0 | ElastiCache |
| Scheduler/worker running count ≠ desired | ECS `RunningTaskCount` (Container Insights) |
| Log pattern `Invalid environment configuration` or webhook signature failures | CloudWatch Logs metric filters |

### Backups

- RDS automated backups + PITR (≥ 30 days recommended). Test a restore into a
  scratch instance monthly.
- S3 versioning plus a lifecycle rule to expire old non-current versions.
- Redis does not need backups. Queues are rebuildable, and Postgres is the
  source of truth.

### Routine release

1. Build and push both images with the new git SHA tag.
2. If the release has new migrations, run the migration task (§8.1). Schema
   changes must be backward-compatible (expand → contract), because old and new
   tasks run side by side during a rollout.
3. Update the ECS services. Order: `api` → `worker` → `scheduler` → `web`.

### Rollback

Redeploy the previous image tag on each service. Migrations are **not** rolled
back automatically, and Prisma has no down-migrations. That's why destructive
schema changes must be split across releases. To recover data, restore RDS to
a point in time (new instance), then repoint `DATABASE_URL`.

### Scaling

- `api` and `web`: stateless, so scale on CPU (target 60 %) via ECS Service
  Auto Scaling.
- `worker`: scale on queue depth if emails/jobs back up.
- `scheduler`: **always 1**.

---

## 10. Pre-launch checklist

- [ ] Issues #1–#3 in §2 fixed in code (or workarounds deliberately applied and documented).
- [ ] Swagger blocked at the ALB.
- [ ] All secrets in Secrets Manager. No `.env` in images (`docker history` clean).
- [ ] `APP_URL` is the single production storefront origin.
- [ ] Demo users removed. Real admin created.
- [ ] Payment providers switched from TEST to live keys only after a successful
      staging run. Webhook URLs updated to production.
- [ ] SES out of sandbox. Sender domain verified.
- [ ] RDS Multi-AZ, deletion protection, backups and PITR on.
- [ ] S3 public access blocked. CORS rule set. Versioning on.
- [ ] Alarms created and routed to the on-call channel.
- [ ] DB-backed e2e suites (`apps/api`, `npm run test:e2e`) run green against
      staging infrastructure (they have never been run so far).
