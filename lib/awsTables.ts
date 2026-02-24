/**
 * AWS Table Name Configuration
 * 
 * Centralizes all AWS resource naming with environment-based prefixes.
 * Ensures complete isolation between QA and Production environments.
 */

import { getAppEnvironment } from './env';

export interface AWSTableNames {
  // DynamoDB tables
  jobs: string;
  users: string;
  checklistTemplates: string;
  notifications: string;
  
  // S3 buckets
  photosBucket: string;
  
  // CloudWatch log groups
  logGroup: string;
}

/**
 * Get environment-specific resource prefix
 * 
 * QA: safari-detail-ops-qa-*
 * Prod: safari-detail-ops-prod-*
 */
function getResourcePrefix(): string {
  const env = getAppEnvironment();
  return `safari-detail-ops-${env}`;
}

/**
 * Build fully qualified resource name
 */
function buildResourceName(resourceName: string): string {
  // Handle case where env vars explicitly provide full table names
  if (resourceName.startsWith('safari-detail-ops-')) {
    return resourceName;
  }
  
  const prefix = getResourcePrefix();
  return `${prefix}-${resourceName}`;
}

/**
 * Get all AWS table/resource names for current environment
 * 
 * Reads from environment variables with fallback to standard naming.
 * All names are automatically prefixed with environment.
 */
export function getAWSTableNames(): AWSTableNames {
  return {
    // DynamoDB Tables
    jobs: buildResourceName(
      process.env.DYNAMODB_JOBS_TABLE || 'jobs'
    ),
    users: buildResourceName(
      process.env.DYNAMODB_USERS_TABLE || 'users'
    ),
    checklistTemplates: buildResourceName(
      process.env.DYNAMODB_CHECKLIST_TEMPLATES_TABLE || 'checklist-templates'
    ),
    notifications: buildResourceName(
      process.env.DYNAMODB_NOTIFICATIONS_TABLE || 'notifications'
    ),
    
    // S3 Buckets
    photosBucket: buildResourceName(
      process.env.S3_PHOTOS_BUCKET || 'photos'
    ),
    
    // CloudWatch Logs
    logGroup: buildResourceName('logs'),
  };
}

/**
 * Get table names as a summary object for diagnostics
 */
export function getTableNamesSummary(): Record<string, string> {
  const tables = getAWSTableNames();
  return {
    'DynamoDB Notifications': tables.notifications,
    'DynamoDB Jobs': tables.jobs,
    'DynamoDB Users': tables.users,
    'DynamoDB Checklist Templates': tables.checklistTemplates,
    'S3 Photos Bucket': tables.photosBucket,
    'CloudWatch Log Group': tables.logGroup,
  };
}
