/**
 * Data Migration Script: JobStatus to WorkStatus
 * 
 * Migrates jobs from old JobStatus enum values (pending, in_progress, completed, cancelled)
 * to new WorkStatus enum values (SCHEDULED, IN_PROGRESS, WORK_COMPLETED, etc.)
 * 
 * Usage:
 *   npx tsx scripts/migrate-job-status.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../lib/config';
import { WorkStatus, JobStatus } from '../lib/types';

/**
 * Map old JobStatus values to new WorkStatus values
 */
const STATUS_MIGRATION_MAP: Record<string, WorkStatus> = {
  // Old -> New
  'pending': WorkStatus.SCHEDULED,
  'in_progress': WorkStatus.IN_PROGRESS,
  'completed': WorkStatus.WORK_COMPLETED,
  'cancelled': WorkStatus.NO_SHOW_PENDING_CHARGE, // Assuming cancelled means no-show
};

/**
 * Check if status value is an old JobStatus that needs migration
 */
function isOldStatus(status: string): boolean {
  return status in STATUS_MIGRATION_MAP;
}

/**
 * Migrate job status from old to new enum
 */
function migrateStatus(oldStatus: string): WorkStatus | null {
  return STATUS_MIGRATION_MAP[oldStatus] || null;
}

/**
 * Main migration function
 */
async function migrateJobStatuses(dryRun: boolean = false): Promise<void> {
  const config = getConfig();
  
  console.log('='.repeat(60));
  console.log('Job Status Migration: JobStatus → WorkStatus');
  console.log('='.repeat(60));
  console.log(`Environment: ${config.env.toUpperCase()}`);
  console.log(`Table: ${config.aws.dynamodb.jobsTable}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update jobs)'}`);
  console.log('='.repeat(60));
  console.log('');

  // Initialize DynamoDB client
  const client = new DynamoDBClient({ region: config.aws.region });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
  });

  // Scan all jobs
  console.log('Scanning DynamoDB for jobs with old status values...');
  let scannedCount = 0;
  let migratedCount = 0;
  let errorCount = 0;
  const jobsToMigrate: Array<{ jobId: string; oldStatus: string; newStatus: WorkStatus }> = [];

  try {
    let lastEvaluatedKey: any = undefined;
    
    do {
      const scanResult = await docClient.send(new ScanCommand({
        TableName: config.aws.dynamodb.jobsTable,
        ExclusiveStartKey: lastEvaluatedKey,
      }));

      const items = scanResult.Items || [];
      scannedCount += items.length;

      // Check each job for old status
      for (const item of items) {
        const jobId = item.jobId;
        const status = item.status as string;

        if (isOldStatus(status)) {
          const newStatus = migrateStatus(status);
          
          if (newStatus) {
            jobsToMigrate.push({
              jobId,
              oldStatus: status,
              newStatus,
            });
            
            console.log(`  Found: Job ${jobId}`);
            console.log(`    Old status: ${status}`);
            console.log(`    New status: ${newStatus}`);
            console.log('');
          }
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

  } catch (error: any) {
    console.error('Error scanning DynamoDB:', error.message);
    process.exit(1);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('Scan Complete');
  console.log('='.repeat(60));
  console.log(`Total jobs scanned: ${scannedCount}`);
  console.log(`Jobs requiring migration: ${jobsToMigrate.length}`);
  console.log('');

  if (jobsToMigrate.length === 0) {
    console.log('✅ No jobs need migration. All jobs are using WorkStatus enum.');
    return;
  }

  // Perform migration
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Run without --dry-run to perform migration');
    return;
  }

  console.log('Starting migration...');
  console.log('');

  for (const job of jobsToMigrate) {
    try {
      await docClient.send(new UpdateCommand({
        TableName: config.aws.dynamodb.jobsTable,
        Key: { jobId: job.jobId },
        UpdateExpression: 'SET #status = :newStatus, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':newStatus': job.newStatus,
          ':updatedAt': new Date().toISOString(),
        },
      }));

      migratedCount++;
      console.log(`  ✅ Migrated: ${job.jobId}`);
      console.log(`     ${job.oldStatus} → ${job.newStatus}`);
      console.log('');
    } catch (error: any) {
      errorCount++;
      console.error(`  ❌ Failed: ${job.jobId}`);
      console.error(`     Error: ${error.message}`);
      console.log('');
    }
  }

  // Final summary
  console.log('='.repeat(60));
  console.log('Migration Complete');
  console.log('='.repeat(60));
  console.log(`Successfully migrated: ${migratedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('');

  if (errorCount > 0) {
    console.log('⚠️  Some jobs failed to migrate. Check errors above.');
    process.exit(1);
  } else {
    console.log('✅ All jobs successfully migrated to WorkStatus enum!');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run migration
migrateJobStatuses(dryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
