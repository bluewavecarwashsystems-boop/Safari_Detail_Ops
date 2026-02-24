/**
 * Environment Configuration with Production Safety
 * 
 * Centralizes all environment variable access with strict validation
 * and runtime assertions to prevent production/QA data crossover.
 */

export type AppEnvironment = 'qa' | 'prod';
export type SquareEnvironment = 'sandbox' | 'production';

export interface EnvironmentConfig {
  // App environment
  appEnv: AppEnvironment;
  
  // Square configuration
  square: {
    environment: SquareEnvironment;
    accessToken: string;
    webhookSignatureKey: string;
    locationId: string | null;
    teamMemberId: string | null;
  };
  
  // AWS configuration  
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  
  // Feature flags
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Get and validate environment configuration
 * Throws error if critical configuration is missing or invalid
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  // Get app environment
  const appEnv = getAppEnvironment();
  
  // Get Square environment
  const squareEnv = getSquareEnvironment();
  
  // CRITICAL: Validate environment consistency
  validateEnvironmentConsistency(appEnv, squareEnv);
  
  // Get required values
  const config: EnvironmentConfig = {
    appEnv,
    square: {
      environment: squareEnv,
      accessToken: getRequiredEnvVar('SQUARE_ACCESS_TOKEN'),
      webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
      locationId: process.env.FRANKLIN_SQUARE_LOCATION_ID || null,
      teamMemberId: process.env.SQUARE_TEAM_MEMBER_ID || null,
    },
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: getRequiredEnvVar('AWS_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnvVar('AWS_SECRET_ACCESS_KEY'),
    },
    isDevelopment: appEnv === 'qa',
    isProduction: appEnv === 'prod',
  };
  
  return config;
}

/**
 * Get app environment from APP_ENV variable
 * Defaults to 'qa' if not set (fail-safe)
 */
export function getAppEnvironment(): AppEnvironment {
  const env = process.env.APP_ENV?.toLowerCase();
  
  if (env === 'prod' || env === 'production') {
    return 'prod';
  }
  
  if (env === 'qa' || env === 'development' || env === 'dev') {
    return 'qa';
  }
  
  // Default to qa as safe fallback
  console.warn(`[ENV] APP_ENV not set or invalid (${env}). Defaulting to 'qa'.`);
  return 'qa';
}

/**
 * Get Square environment from SQUARE_ENVIRONMENT or SQUARE_ENV
 * Defaults to 'sandbox' if not set (fail-safe)
 */
function getSquareEnvironment(): SquareEnvironment {
  const env = (process.env.SQUARE_ENVIRONMENT || process.env.SQUARE_ENV || '').toLowerCase();
  
  if (env === 'production' || env === 'prod') {
    return 'production';
  }
  
  if (env === 'sandbox' || env === 'qa' || env === 'dev' || env === 'development') {
    return 'sandbox';
  }
  
  // Default to sandbox as safe fallback
  console.warn(`[ENV] SQUARE_ENVIRONMENT not set or invalid (${env}). Defaulting to 'sandbox'.`);
  return 'sandbox';
}

/**
 * CRITICAL: Validate environment consistency
 * 
 * Production Safety Rule:
 * - If APP_ENV=prod, then SQUARE_ENVIRONMENT MUST be 'production'
 * - If APP_ENV=qa, then SQUARE_ENVIRONMENT MUST be 'sandbox'
 * 
 * This prevents accidentally using production Square with QA data or vice versa.
 */
function validateEnvironmentConsistency(
  appEnv: AppEnvironment,
  squareEnv: SquareEnvironment
): void {
  if (appEnv === 'prod' && squareEnv !== 'production') {
    throw new Error(
      `FATAL: Environment mismatch! APP_ENV='prod' but SQUARE_ENVIRONMENT='${squareEnv}'. ` +
      `Production app MUST use Square production environment. ` +
      `Set SQUARE_ENVIRONMENT=production before deploying to production.`
    );
  }
  
  if (appEnv === 'qa' && squareEnv !== 'sandbox') {
    console.warn(
      `[ENV] Warning: APP_ENV='qa' but SQUARE_ENVIRONMENT='${squareEnv}'. ` +
      `QA environment should typically use Square sandbox. ` +
      `If this is intentional, you can ignore this warning.`
    );
  }
}

/**
 * Get required environment variable or throw error
 */
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  
  if (!value) {
    throw new Error(
      `FATAL: Required environment variable '${name}' is not set. ` +
      `Check your Vercel environment configuration.`
    );
  }
  
  return value;
}

/**
 * Safely get environment variable with fallback
 */
export function getEnvVar(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getAppEnvironment() === 'prod';
}

/**
 * Check if running in QA/development
 */
export function isDevelopment(): boolean {
  return getAppEnvironment() === 'qa';
}
