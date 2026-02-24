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
      checklistTemplatesTable: string;
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
    teamMemberId: string | null;
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
    // SECURITY: Don't log full resource names containing potential sensitive info
    return resourceName;
  }
  
  // Otherwise, add the prefix
  const result = `${prefix}${resourceName}`;
  return result;
}

/**
 * Redact sensitive configuration for logging
 * SECURITY: Never log tokens, keys, or credentials
 */
function redactSensitiveConfig(config: Config): any {
  return {
    env: config.env,
    aws: {
      region: config.aws.region,
      dynamodb: config.aws.dynamodb,
      s3: config.aws.s3,
    },
    square: {
      environment: config.square.environment,
      franklinLocationId: config.square.franklinLocationId,
      teamMemberId: config.square.teamMemberId,
      accessToken: config.square.accessToken ? '[REDACTED]' : '[NOT SET]',
      webhookSignatureKey: config.square.webhookSignatureKey ? '[REDACTED]' : '[NOT SET]',
    },
    logging: config.logging,
  };
}

/**
 * Get application configuration
 * Phase A: Defensive mode - returns safe defaults if env vars missing
 * Production Safety: Validates environment consistency
 */
export function getConfig(): Config {
  const env = getEnvironment();
  
  // Get Square environment
  const squareEnv = (process.env.SQUARE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production';
  
  // CRITICAL: Production safety check
  // If APP_ENV=prod, SQUARE_ENVIRONMENT must be production
  if (env === 'prod' && squareEnv !== 'production') {
    const errorMsg = 
      `FATAL CONFIGURATION ERROR: Environment mismatch!\n` +
      `  APP_ENV='prod' but SQUARE_ENV='${process.env.SQUARE_ENV}'\n` +
      `  Production deployment MUST use Square production environment.\n` +
      `  Set SQUARE_ENV=production in Vercel production environment.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  return {
    env,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      dynamodb: {
        jobsTable: getResourceName(process.env.DYNAMODB_JOBS_TABLE || 'jobs'),
        usersTable: getResourceName(process.env.DYNAMODB_USERS_TABLE || 'users'),
        checklistTemplatesTable: getResourceName(process.env.DYNAMODB_CHECKLIST_TEMPLATES_TABLE || 'checklist-templates'),
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
      teamMemberId: process.env.SQUARE_TEAM_MEMBER_ID || null,
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
