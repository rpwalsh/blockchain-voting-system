import Joi from 'joi';

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  trustProxy: boolean;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieSecret: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
};

export function loadConfig(): AppConfig {
  const rawNodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const nodeEnv: AppConfig['nodeEnv'] =
    rawNodeEnv === 'production' ? 'production' : rawNodeEnv === 'test' ? 'test' : 'development';

  const schema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default(nodeEnv),
    PORT: Joi.number().integer().min(1).max(65535).default(3000),
    TRUST_PROXY: Joi.string().valid('true', 'false').default('false'),

    DATABASE_URL: Joi.string().uri().required(),

    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRES_IN: Joi.string().default('24h'),

    COOKIE_SECRET: Joi.string().min(32).required(),

    CORS_ORIGIN: Joi.string().allow('').default(''),

    RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(900000),
    RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100),
  }).unknown(true);

  const { value, error } = schema.validate(process.env, { abortEarly: false, convert: true });
  if (error) {
    const msg = error.details.map(d => d.message).join('; ');
    throw new Error(`Invalid environment configuration: ${msg}`);
  }

  const corsOrigins = String(value.CORS_ORIGIN || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  // Hard production guardrails (prevent the well-known placeholder from shipping).
  if (nodeEnv === 'production') {
    if (value.JWT_SECRET.includes('change-this-in-production')) {
      throw new Error('Invalid JWT_SECRET: placeholder value is not allowed in production');
    }
    if (value.COOKIE_SECRET.includes('change-this-in-production')) {
      throw new Error('Invalid COOKIE_SECRET: placeholder value is not allowed in production');
    }
  }

  return {
    nodeEnv,
    port: Number(value.PORT),
    trustProxy: String(value.TRUST_PROXY) === 'true',
    databaseUrl: String(value.DATABASE_URL),
    jwtSecret: String(value.JWT_SECRET),
    jwtExpiresIn: String(value.JWT_EXPIRES_IN),
    cookieSecret: String(value.COOKIE_SECRET),
    corsOrigins,
    rateLimitWindowMs: Number(value.RATE_LIMIT_WINDOW_MS),
    rateLimitMaxRequests: Number(value.RATE_LIMIT_MAX_REQUESTS),
  };
}
