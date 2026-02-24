#!/usr/bin/env tsx
/**
 * Provision Production DynamoDB Tables for Safari Detail Ops
 * 
 * This script creates production DynamoDB tables by cloning the structure
 * from QA tables. Ensures complete environment isolation.
 * 
 * SAFETY FEATURES:
 * - Requires APP_ENV=prod environment variable
 * - Interactive confirmation before creating tables
 * - Validates QA tables exist before attempting replication
 * - Dry-run mode available for testing
 * 
 * Usage:
 *   # Dry run to preview actions
 *   APP_ENV=prod npx tsx scripts/provision-prod-tables.ts --dry-run
 * 
 *   # Create production tables (requires confirmation)
 *   APP_ENV=prod npx tsx scripts/provision-prod-tables.ts
 * 
 *   # Force creation without confirmation
 *   APP_ENV=prod npx tsx scripts/provision-prod-tables.ts --force
 */

import { DynamoDBClient, ListTablesCommand, DescribeTableCommand, CreateTableCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import * as readline from 'readline';

const REGION = 'us-east-1';
const QA_PREFIX = 'safari-detail-ops-qa';
const PROD_PREFIX = 'safari-detail-ops-prod';

const TABLES = [
  { name: 'jobs', qaTable: `${QA_PREFIX}-jobs`, prodTable: `${PROD_PREFIX}-jobs` },
  { name: 'users', qaTable: `${QA_PREFIX}-users`, prodTable: `${PROD_PREFIX}-users` },
  { name: 'checklist-templates', qaTable: `${QA_PREFIX}-checklist-templates`, prodTable: `${PROD_PREFIX}-checklist-templates` },
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message: string) {
  log(`\n${message}\n`, 'cyan');
}

function logSuccess(message: string) {
  log(`[OK] ${message}`, 'green');
}

function logWarning(message: string) {
  log(`[WARNING] ${message}`, 'yellow');
}

function logError(message: string) {
  log(`[ERROR] ${message}`, 'red');
}

function logInfo(message: string) {
  log(`  ${message}`, 'gray');
}

async function promptConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("\nType 'CREATE PRODUCTION TABLES' to confirm: ", (answer) => {
      rl.close();
      resolve(answer === 'CREATE PRODUCTION TABLES');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');

  logHeader('================================================================');
  logHeader('  Safari Detail Ops - Production Table Provisioning');
  logHeader('================================================================');

  // SAFETY CHECK 1: Verify APP_ENV=prod
  logHeader('Safety Check 1: Environment Validation');
  if (process.env.APP_ENV !== 'prod') {
    logError('SAFETY ABORT: APP_ENV must be set to "prod"');
    logInfo('Current APP_ENV: ' + (process.env.APP_ENV || 'not set'));
    logInfo('Run: $env:APP_ENV="prod"; npx tsx scripts/provision-prod-tables.ts');
    process.exit(1);
  }
  logSuccess('Environment validated: APP_ENV=prod');

  // SAFETY CHECK 2: Confirm mode
  logHeader('Safety Check 2: Confirmation Flag');
  if (isDryRun) {
    logWarning('DRY RUN MODE: No tables will be created');
  } else {
    logSuccess('Live mode enabled');
  }

  // Initialize DynamoDB client
  const client = new DynamoDBClient({ region: REGION });

  try {
    // Verify AWS credentials
    logHeader('Verifying AWS Credentials');
    const listCommand = new ListTablesCommand({});
    await client.send(listCommand);
    logSuccess('AWS credentials validated');

    // Verify QA tables exist
    logHeader('Verifying QA Tables Exist');
    const missingTables: string[] = [];
    for (const table of TABLES) {
      try {
        const describeCommand = new DescribeTableCommand({ TableName: table.qaTable });
        await client.send(describeCommand);
        logSuccess(`Found: ${table.qaTable}`);
      } catch (error) {
        logError(`Missing: ${table.qaTable}`);
        missingTables.push(table.qaTable);
      }
    }

    if (missingTables.length > 0) {
      logError('\nABORT: Cannot proceed - missing QA tables');
      logInfo('Missing tables: ' + missingTables.join(', '));
      logInfo('Create QA tables first before provisioning production');
      process.exit(1);
    }

    // Check if prod tables already exist
    logHeader('Checking Production Tables Status');
    const existingTables: string[] = [];
    for (const table of TABLES) {
      try {
        const describeCommand = new DescribeTableCommand({ TableName: table.prodTable });
        await client.send(describeCommand);
        logWarning(`Already exists: ${table.prodTable}`);
        existingTables.push(table.prodTable);
      } catch (error) {
        logInfo(`Not found: ${table.prodTable} (will be created)`);
      }
    }

    if (existingTables.length > 0) {
      logWarning('\nSome production tables already exist:');
      existingTables.forEach(t => logInfo(`  - ${t}`));
      if (!isDryRun && !isForce) {
        log('\nDo you want to skip existing tables and create missing ones? (yes/no)', 'yellow');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const response = await new Promise<string>((resolve) => {
          rl.question('', (answer) => {
            rl.close();
            resolve(answer);
          });
        });
        if (response.toLowerCase() !== 'yes') {
          logInfo('\nOperation cancelled');
          process.exit(0);
        }
      }
    }

    // FINAL CONFIRMATION
    if (!isDryRun && !isForce) {
      logHeader('WARNING - FINAL CONFIRMATION');
      logWarning('You are about to create PRODUCTION DynamoDB tables:');
      TABLES.forEach(table => {
        if (!existingTables.includes(table.prodTable)) {
          logInfo(`  - ${table.prodTable}`);
        }
      });
      logInfo(`\nRegion: ${REGION}`);

      const confirmed = await promptConfirmation();
      if (!confirmed) {
        logInfo('\nOperation cancelled');
        process.exit(0);
      }
    }

    if (isForce) {
      logWarning('FORCING table creation (confirmation bypassed)');
    }

    // Create production tables
    logHeader('Creating Production Tables');

    for (const table of TABLES) {
      if (existingTables.includes(table.prodTable)) {
        logInfo(`Skipping: ${table.prodTable} (already exists)`);
        continue;
      }

      log(`\nProcessing: ${table.name}`, 'cyan');

      if (isDryRun) {
        logInfo(`[DRY RUN] Would describe QA table: ${table.qaTable}`);
        logInfo(`[DRY RUN] Would create production table: ${table.prodTable}`);
        continue;
      }

      // Get QA table description
      logInfo(`Reading schema from: ${table.qaTable}`);
      const describeCommand = new DescribeTableCommand({ TableName: table.qaTable });
      const qaTableDescription = await client.send(describeCommand);

      if (!qaTableDescription.Table) {
        logError(`Failed to get table description for ${table.qaTable}`);
        continue;
      }

      const qaTable = qaTableDescription.Table;

      // Build create table parameters
      const createParams: any = {
        TableName: table.prodTable,
        KeySchema: qaTable.KeySchema,
        AttributeDefinitions: qaTable.AttributeDefinitions,
        BillingMode: qaTable.BillingModeSummary?.BillingMode || 'PAY_PER_REQUEST',
      };

      // Add provisioned throughput if needed
      if (createParams.BillingMode === 'PROVISIONED' && qaTable.ProvisionedThroughput) {
        createParams.ProvisionedThroughput = {
          ReadCapacityUnits: qaTable.ProvisionedThroughput.ReadCapacityUnits,
          WriteCapacityUnits: qaTable.ProvisionedThroughput.WriteCapacityUnits,
        };
      }

      // Add Global Secondary Indexes if they exist
      if (qaTable.GlobalSecondaryIndexes && qaTable.GlobalSecondaryIndexes.length > 0) {
        createParams.GlobalSecondaryIndexes = qaTable.GlobalSecondaryIndexes.map((gsi: any) => {
          const newGsi: any = {
            IndexName: gsi.IndexName,
            KeySchema: gsi.KeySchema,
            Projection: gsi.Projection,
          };
          if (createParams.BillingMode === 'PROVISIONED' && gsi.ProvisionedThroughput) {
            newGsi.ProvisionedThroughput = {
              ReadCapacityUnits: gsi.ProvisionedThroughput.ReadCapacityUnits,
              WriteCapacityUnits: gsi.ProvisionedThroughput.WriteCapacityUnits,
            };
          }
          return newGsi;
        });
      }

      // Create table
      logInfo(`Creating table: ${table.prodTable}`);
      try {
        const createCommand = new CreateTableCommand(createParams);
        await client.send(createCommand);
        logSuccess(`Table created: ${table.prodTable}`);

        // Wait for table to be active
        logInfo('Waiting for table to become active...');
        await waitUntilTableExists(
          { client, maxWaitTime: 120, minDelay: 2, maxDelay: 5 },
          { TableName: table.prodTable }
        );
        logSuccess(`Table is now active: ${table.prodTable}`);
      } catch (error: any) {
        logError(`Failed to create table: ${table.prodTable}`);
        logInfo(`Error: ${error.message}`);
        continue;
      }
    }

    // Summary
    if (isDryRun) {
      logHeader('================================================================');
      logSuccess('DRY RUN COMPLETE');
      logInfo('  No tables were created. Review the output above.');
    } else {
      logHeader('================================================================');
      logSuccess('PROVISIONING COMPLETE');
      logInfo('  Production tables have been created.');
    }

    logHeader('Next Steps:');
    logInfo('1. Verify tables in AWS Console');
    logInfo('2. Update Vercel production environment variables:');
    logInfo('     - APP_ENV=prod');
    logInfo('     - SQUARE_ENVIRONMENT=production');
    logInfo('     - DYNAMODB_JOBS_TABLE=jobs');
    logInfo('     - DYNAMODB_USERS_TABLE=users');
    logInfo('     - DYNAMODB_CHECKLIST_TEMPLATES_TABLE=checklist-templates');
    logInfo('3. Deploy to production');
    logInfo('4. Test health endpoint: https://ops.thesafaricarwash.com/api/health');
    logHeader('================================================================\n');

  } catch (error: any) {
    logError(`\nFatal error: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
