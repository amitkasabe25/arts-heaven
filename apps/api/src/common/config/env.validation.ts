import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api/v1'),
  // Comma-separated list of allowed browser origins (main.ts splits on commas).
  APP_URL: z.string().min(1).default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_EMAIL_VERIFY_SECRET: z.string().default('email-verify-secret-change-me'),
  JWT_PASSWORD_RESET_SECRET: z.string().default('password-reset-secret-change-me'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(16).default(12),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().int().default(0),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_S3_BUCKET: z.string().default('artsheaven-dev'),
  AWS_S3_PUBLIC_BASE_URL: z.string().optional().default(''),
  /** `s3` for presigned uploads, `local` for development without cloud credentials. */
  UPLOAD_DRIVER: z.enum(['s3', 'local']).default('s3'),
  UPLOAD_LOCAL_DIR: z.string().default('./uploads'),
  UPLOAD_PUBLIC_BASE_URL: z.string().optional().default(''),
  PAYMENT_DEFAULT_PROVIDER: z.enum(['razorpay', 'cashfree', 'cod']).default('razorpay'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  CASHFREE_CLIENT_ID: z.string().optional().default(''),
  CASHFREE_CLIENT_SECRET: z.string().optional().default(''),
  CASHFREE_API_VERSION: z.string().default('2023-12-12'),
  CASHFREE_ENVIRONMENT: z.enum(['TEST', 'PRODUCTION']).default('TEST'),
  PAYMENT_WEBHOOK_URL: z.string().default('http://localhost:4000/api/v1/webhooks'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Artsheaven <no-reply@artsheaven.local>'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  // Tests supply short secrets; keep validation meaningful without blocking unit tests.
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
