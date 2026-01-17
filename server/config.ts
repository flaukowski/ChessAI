import { z } from 'zod';

/**
 * Centralized configuration module with Zod validation.
 * All configuration values are validated at startup.
 */

// =============================================================================
// ENVIRONMENT SCHEMA VALIDATION
// =============================================================================

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),

  // Database
  DATABASE_URL: z.string().optional(),

  // Session
  SESSION_SECRET: z.string().min(32).optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),

  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  APP_URL: z.string().url().optional(),

  // Default Admin (optional)
  DEFAULT_ADMIN_EMAIL: z.string().email().optional(),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).optional(),
  DEFAULT_ADMIN_FIRST_NAME: z.string().optional(),
  DEFAULT_ADMIN_LAST_NAME: z.string().optional(),
});

// Validate environment variables
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    // Don't throw in development, just warn
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment configuration');
    }
  }
  return result.success ? result.data : envSchema.parse({});
};

const env = parseEnv();

// =============================================================================
// TOKEN CONFIGURATION
// =============================================================================

export const tokenConfig = {
  /** Access token expiry in milliseconds (15 minutes) */
  accessTokenExpiryMs: 15 * 60 * 1000,

  /** Refresh token expiry in milliseconds (7 days) */
  refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000,

  /** Email verification token expiry in milliseconds (24 hours) */
  emailVerificationExpiryMs: 24 * 60 * 60 * 1000,

  /** Password reset token expiry in milliseconds (1 hour) */
  passwordResetExpiryMs: 1 * 60 * 60 * 1000,

  /** ZKP challenge expiry in milliseconds (5 minutes) */
  zkpChallengeExpiryMs: 5 * 60 * 1000,
} as const;

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

export const securityConfig = {
  /** Bcrypt salt rounds for password hashing */
  saltRounds: 10,

  /** Maximum failed login attempts before lockout */
  maxLoginAttempts: 5,

  /** Account lockout duration in milliseconds (15 minutes) */
  lockoutDurationMs: 15 * 60 * 1000,

  /** Rate limit window in milliseconds (1 minute) */
  rateLimitWindowMs: 60 * 1000,

  /** Maximum requests per rate limit window */
  rateLimitMaxRequests: 10,

  /** Request body size limit */
  requestSizeLimit: '1mb',
} as const;

// =============================================================================
// AUDIO CONFIGURATION
// =============================================================================

export const audioConfig = {
  /** Default sample rate in Hz */
  sampleRate: 48000,

  /** Default buffer size for audio processing */
  bufferSize: 256,

  /** Maximum number of effects in a chain */
  maxEffectsPerChain: 20,

  /** Worklet processor path */
  workletPath: '/worklets/effect-processor.js',
} as const;

// =============================================================================
// SERVER CONFIGURATION
// =============================================================================

export const serverConfig = {
  /** Server port */
  port: env.PORT,

  /** Node environment */
  nodeEnv: env.NODE_ENV,

  /** Is production environment */
  isProduction: env.NODE_ENV === 'production',

  /** Is development environment */
  isDevelopment: env.NODE_ENV === 'development',

  /** Is test environment */
  isTest: env.NODE_ENV === 'test',

  /** Allowed CORS origins (comma-separated in env) */
  allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) || [],

  /** Application URL for links in emails */
  appUrl: env.APP_URL || `http://localhost:${env.PORT}`,
} as const;

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================

export const dbConfig = {
  /** Database connection URL */
  url: env.DATABASE_URL,

  /** Whether database is configured */
  isConfigured: Boolean(env.DATABASE_URL),
} as const;

// =============================================================================
// EMAIL CONFIGURATION
// =============================================================================

export const emailConfig = {
  /** SMTP host */
  host: env.SMTP_HOST,

  /** SMTP port */
  port: env.SMTP_PORT,

  /** SMTP username */
  user: env.SMTP_USER,

  /** SMTP password */
  pass: env.SMTP_PASS,

  /** From email address */
  from: env.SMTP_FROM,

  /** Whether email is configured */
  isConfigured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
} as const;

// =============================================================================
// UI/CLIENT CONFIGURATION
// =============================================================================

export const clientConfig = {
  /** Polling interval for status updates in milliseconds */
  pollingInterval: 2000,

  /** Maximum file size for audio uploads (50MB) */
  maxAudioFileSizeMb: 50,

  /** Supported audio formats */
  supportedAudioFormats: ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm'],
} as const;

// Export all config as a single object for convenience
export const config = {
  token: tokenConfig,
  security: securityConfig,
  audio: audioConfig,
  server: serverConfig,
  db: dbConfig,
  email: emailConfig,
  client: clientConfig,
} as const;

export default config;
