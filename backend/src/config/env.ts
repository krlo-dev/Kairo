import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 32 bytes hex (64 chars)'),
  CSRF_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().optional().default(''),

  ML_APP_ID: z.string().optional().default(''),
  ML_CLIENT_SECRET: z.string().optional().default(''),
  ML_REDIRECT_URI: z.string().url().optional(),

  AE_APP_KEY: z.string().optional().default(''),
  AE_APP_SECRET: z.string().optional().default(''),
  AE_TRACKING_ID: z.string().optional().default(''),

  WA_TOKEN: z.string().optional().default(''),
  WA_PHONE_ID: z.string().optional().default(''),
  WA_BUSINESS_ID: z.string().optional().default(''),
  WA_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
  WA_APP_SECRET: z.string().optional().default(''),

  MP_ACCESS_TOKEN: z.string().optional().default(''),
  MP_PUBLIC_KEY: z.string().optional().default(''),
  MP_WEBHOOK_SECRET: z.string().optional().default(''),

  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_DEFAULT: z.string().email().default('hola@kairo.com.co'),
  RESEND_FROM_ALERTS: z.string().email().default('alertas@kairo.com.co'),

  SENTRY_DSN: z.string().optional().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOGTAIL_TOKEN: z.string().optional().default(''),

  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(120),

  METRICS_TOKEN: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
