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
    };
    s3: {
      photosBucket: string;
    };
  };
  square: {
    accessToken: string;
    webhookSignatureKey: string;
    environment: 'sandbox' | 'production';
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logGroup: string;
  };
}

/**
 * Get environment from APP_ENV variable
 */
function getEnvironment(): Environment {
  const env = process.env.APP_ENV?.toLowerCase();
  if (env !== 'qa' && env !== 'prod') {
    throw new Error(`Invalid APP_ENV: ${env}. Must be 'qa' or 'prod'.`);
  }
  return env;
}

/**
 * Build resource name with project namespace
 */
function getResourceName(resourceName: string): string {
  const env = getEnvironment();
  return `safari-detail-ops-${env}-${resourceName}`;
}

/**
 * Get application configuration
 */
export function getConfig(): Config {
  const env = getEnvironment();
  
  return {
    env,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      dynamodb: {
        jobsTable: getResourceName(process.env.DYNAMODB_JOBS_TABLE || 'jobs'),
      },
      s3: {
        photosBucket: getResourceName(process.env.S3_PHOTOS_BUCKET || 'photos'),
      },
    },
    square: {
      accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
      webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
      environment: (process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox'),
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
