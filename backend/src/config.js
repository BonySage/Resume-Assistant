// Single source of truth for configuration. Every module reads settings from
// here instead of process.env, so defaults and validation live in one place.
// backend/.env is loaded by Node itself (`--env-file-if-exists` in the npm
// scripts); in Docker, docker-compose passes the variables in.

const env = process.env;

const nodeEnv = env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';

export const config = {
  env: nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(env.PORT) || 3000,
  // Comma-separated exact origins, e.g. "http://localhost:5173,https://forma.example.com"
  clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: env.TRUST_PROXY === 'true' ? 1 : Number(env.TRUST_PROXY) || false,
  databaseUrl: env.DATABASE_URL,
  migrationDatabaseUrl: env.MIGRATION_DATABASE_URL,
  appDbPassword: env.APP_DB_PASSWORD,
  jwtSecret: env.JWT_SECRET || (isProduction ? '' : DEV_JWT_SECRET),
  // Session cookie is HTTPS-only in production (NFR-2.2).
  cookieSecure: isProduction,
  anthropicApiKey: env.ANTHROPIC_API_KEY || '',
  anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  // Request body size for JSON APIs. File uploads go through multer, not this.
  jsonLimit: '1mb',
};

// Problems that should stop the server (errors) or just be pointed out (warnings).
export function checkConfig(c = config) {
  const errors = [];
  const warnings = [];
  if (!c.databaseUrl) errors.push('DATABASE_URL is not set — see backend/.env.example.');
  if (c.isProduction && (
    !c.jwtSecret ||
    c.jwtSecret === DEV_JWT_SECRET ||
    c.jwtSecret.length < 32 ||
    /^(change-me|your-key|secret|password|replace|example|test)/i.test(c.jwtSecret)
  )) {
    errors.push('JWT_SECRET must be a unique random value of at least 32 characters in production.');
  } else if (c.jwtSecret === DEV_JWT_SECRET) {
    warnings.push('JWT_SECRET is not set — using an insecure development secret.');
  }
  if (c.isProduction && (
    !c.appDbPassword ||
    c.appDbPassword.length < 32 ||
    /^(replace|example|password|change-me|test)/i.test(c.appDbPassword)
  )) {
    errors.push('APP_DB_PASSWORD must be a unique random value of at least 32 characters in production.');
  }
  const clientOrigins = c.clientOrigins || [];
  if (c.isProduction && (!clientOrigins.length || clientOrigins.some((origin) => !origin.startsWith('https://')))) {
    errors.push('CLIENT_ORIGIN must contain only HTTPS origins in production.');
  }
  if (!c.anthropicApiKey || c.anthropicApiKey === 'your-key-here') {
    warnings.push('ANTHROPIC_API_KEY is not set — resume/job parsing and bullet generation will fail until it is configured.');
  }
  return { errors, warnings };
}
