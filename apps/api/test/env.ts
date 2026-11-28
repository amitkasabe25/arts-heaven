/**
 * Defaults for database-backed e2e tests.
 *
 * These tests REQUIRE a running PostgreSQL and Redis. Start them with
 * `docker compose -f infrastructure/docker-compose.yml up -d postgres redis`
 * (or point DATABASE_URL / REDIS_* at managed instances) before running
 * `npm run test:e2e`. Never point these tests at a production database:
 * they TRUNCATE every table except Prisma's migration ledger.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/artsheaven_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-with-at-least-16-chars';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-with-at-least-16-chars';
process.env.JWT_EMAIL_VERIFY_SECRET ??= 'e2e-email-secret-with-at-least-16-chars';
process.env.JWT_PASSWORD_RESET_SECRET ??= 'e2e-reset-secret-with-at-least-16-chars';
process.env.APP_URL ??= 'http://localhost:5173';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';
process.env.REDIS_DB ??= '15'; // keep test jobs away from development queues
process.env.BCRYPT_ROUNDS ??= '8';
process.env.RAZORPAY_KEY_ID ??= 'rzp_test_e2e';
process.env.RAZORPAY_KEY_SECRET ??= 'e2e-razorpay-secret-with-16-chars';
process.env.RAZORPAY_WEBHOOK_SECRET ??= 'e2e-razorpay-webhook-secret';
