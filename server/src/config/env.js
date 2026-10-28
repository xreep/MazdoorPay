import 'dotenv/config';
import { z } from 'zod';
import { passwordSchema } from '@mazdoorpay/shared';

// An empty value (as in .env.example) means not set.
const optionalPassword = z.preprocess((v) => (v === '' ? undefined : v), passwordSchema.optional());

const intFrom = (fallback) => z.coerce.number().int().positive().default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: intFrom(5055),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: intFrom(7),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  BCRYPT_COST: intFrom(12),
  LOGIN_MAX_ATTEMPTS: intFrom(5),
  LOGIN_LOCKOUT_MINUTES: intFrom(15),
  RATE_LIMIT_MAX: intFrom(300),
  AUTH_RATE_LIMIT_MAX: intFrom(30),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  QR_SECRET: z.string().min(16, 'QR_SECRET must be at least 16 characters'),
  // Passwords of the shared demo accounts; kept out of the code so they can be changed.
  DEMO_PASSWORD: optionalPassword,
  DEMO_ADMIN_PASSWORD: optionalPassword,
});

const productionRules = (env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  for (const key of ['JWT_ACCESS_SECRET', 'QR_SECRET']) {
    if ((env[key] ?? '').length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} must be at least 32 characters in production`,
      });
    }
  }
  for (const key of ['DEMO_PASSWORD', 'DEMO_ADMIN_PASSWORD']) {
    if (env[key] !== undefined && env[key].length < 12) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} must be at least 12 characters in production`,
      });
    }
  }
  if (env.MONGODB_URI?.includes('<user>')) {
    ctx.addIssue({
      code: 'custom',
      path: ['MONGODB_URI'],
      message: 'MONGODB_URI still has the <user> placeholder',
    });
  }
};

export function loadConfig(source = process.env) {
  const parsed = schema.superRefine(productionRules).safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const env = parsed.data;
  return {
    env: env.NODE_ENV,
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    mongoUri: env.MONGODB_URI,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    jwtAccessTtl: env.JWT_ACCESS_TTL,
    refreshTtlDays: env.REFRESH_TTL_DAYS,
    frontendOrigins: env.FRONTEND_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    bcryptCost: env.BCRYPT_COST,
    loginMaxAttempts: env.LOGIN_MAX_ATTEMPTS,
    lockoutMinutes: env.LOGIN_LOCKOUT_MINUTES,
    rateLimitMax: env.RATE_LIMIT_MAX,
    authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,
    qrSecret: env.QR_SECRET,
    trustProxy: env.TRUST_PROXY,
    demoPassword: env.DEMO_PASSWORD,
    demoAdminPassword: env.DEMO_ADMIN_PASSWORD,
  };
}

export const config = loadConfig();
