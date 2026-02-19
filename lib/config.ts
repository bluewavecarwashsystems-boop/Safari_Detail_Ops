/**
 * Environment Configuration
 * 
 * Manages environment-aware configuration for safari-detail-ops project.
 * All AWS resources are namespaced with: safari-detail-ops-<env>-<resource>
 */

export type Environment = 'qa' | 'prod';

export interface Config {
  env: Environment;
  aws: {
    region: string;
    dynamodb: {
      jobsTable: string;
      usersTable: string;
    };
    s3: {
      photosBucket: string;
    };
  };
  square: {
    accessToken: string;
    webhookSignatureKey: string;
    environment: 'sandbox' | 'production';
    franklinLocationId: string | null;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logGroup: string;
  };
}

/**
 * Get environment from APP_ENV variable
 * In Phase A (defensive mode), returns 'qa' as fallback if missing
 * In Phase B+, will enforce strict validation
 */
function getEnvironment(): Environment {
  const env = process.env.APP_ENV?.toLowerCase();
  if (env !== 'qa' && env !== 'prod') {
    // Phase A: defensive - return 'qa' as safe default
    // TODO Phase B: throw new Error(`Invalid APP_ENV: ${env}. Must be 'qa' or 'prod'.`);
    console.warn(`APP_ENV not set or invalid (${env}). Defaulting to 'qa' for Phase A.`);
    return 'qa';
  }
  return env;
}

/**
 * Build resource name with project namespace
 * Handles case where resource name is already fully qualified
 */
function getResourceName(resourceName: string): string {
  const env = getEnvironment();
  const prefix = `safari-detail-ops-${env}-`;
  
  // If resource name already starts with the prefix, return as-is
  if (resourceName.startsWith('safari-detail-ops-')) {
    console.log(`[config] Resource '${resourceName}' already prefixed, returning as-is`);
    return resourceName;
  }
  
  // Otherwise, add the prefix
  const result = `${prefix}${resourceName}`;
  console.log(`[config] Building resource name: '${resourceName}' + env '${env}' = '${result}'`);
  return result;
}

/**
 * Get application configuration
 * Phase A: Defensive mode - returns safe defaults if env vars missing
 */
export function getConfig(): Config {
  const env = getEnvironment();
  
  return {
    env,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      dynamodb: {
        jobsTable: getResourceName(process.env.DYNAMODB_JOBS_TABLE || 'jobs'),
        usersTable: getResourceName(process.env.DYNAMODB_USERS_TABLE || 'users'),
      },
      s3: {
        photosBucket: getResourceName(process.env.S3_PHOTOS_BUCKET || 'photos'),
      },
    },
    square: {
      accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
      webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
      environment: (process.env.SQUARE_ENV === 'production' ? 'production' : 'sandbox'),
      franklinLocationId: process.env.FRANKLIN_SQUARE_LOCATION_ID || null,
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      logGroup: getResourceName('logs'),
    },
  };
}

/**
 * Validate required configuration
 */
export function validateConfig(config: Config, requiredFields: string[]): void {
  const missing: string[] = [];
  
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj: any, key) => obj?.[key], config);
    if (!value) {
      missing.push(field);
    }
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}
