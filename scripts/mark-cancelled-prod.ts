/**
 * Manual script to mark a job as cancelled in PRODUCTION database
 * 
 * Usage: npm run mark-cancelled-prod -- <jobId>
 * Example: npm run mark-cancelled-prod -- i7nzfwxicf53cl
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

// Override to use PRODUCTION tables
process.env.DYNAMODB_JOBS_TABLE = 'safari-detail-ops-prod-jobs';
process.env.APP_ENV = 'prod';
process.env.SQUARE_ENV = 'production'; // Required for config validation

import { getJob, getJobByBookingId, updateJob } from '../lib/aws/dynamodb';
import { WorkStatus } from '../lib/types';

async function markJobAsCancelled(jobId: string) {
  console.log('[MARK CANCELLED PROD] Starting for booking/job:', jobId);
  console.log('[MARK CANCELLED PROD] Using PRODUCTION database');
  console.log('─────────────────────────────────────────');

  try {
    // 1. Find job in DynamoDB (try by jobId first, then by bookingId)
    console.log('[MARK CANCELLED PROD] Looking for job in production database...');
    let job = await getJob(jobId);
    
    if (!job) {
      console.log('[MARK CANCELLED PROD] Not found by jobId, trying bookingId...');
      job = await getJobByBookingId(jobId);
    }

    if (!job) {
      console.error('[MARK CANCELLED PROD] ❌ Job not found in production database:', jobId);
      console.error('[MARK CANCELLED PROD] Tried searching by both jobId and bookingId');
      return;
    }

    console.log('[MARK CANCELLED PROD] Found job:', {
      jobId: job.jobId,
      bookingId: job.bookingId,
      customerName: job.customerName,
      serviceType: job.serviceType,
      currentStatus: job.status,
    });

    // 2. Check if already cancelled
    if (job.status === WorkStatus.CANCELLED) {
      console.log('[MARK CANCELLED PROD] ℹ️  Job is already marked as CANCELLED');
      console.log('[MARK CANCELLED PROD] Cancelled at:', job.cancelledAt);
      return;
    }

    // 3. Update job to CANCELLED
    console.log('[MARK CANCELLED PROD] Updating job to CANCELLED...');
    await updateJob(job.jobId, {
      status: WorkStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      cancelledSource: 'manual',
      cancellationReason: 'Manually marked as cancelled - booking was cancelled in Square',
      updatedBy: 'manual-mark-cancelled-prod-script',
    });

    console.log('─────────────────────────────────────────');
    console.log('[MARK CANCELLED PROD] ✅ SUCCESS!');
    console.log('[MARK CANCELLED PROD] Job marked as CANCELLED in PRODUCTION');
    console.log('[MARK CANCELLED PROD] Job ID:', job.jobId);
    console.log('[MARK CANCELLED PROD] Customer:', job.customerName);
    console.log('[MARK CANCELLED PROD] Previous status:', job.status);
    console.log('[MARK CANCELLED PROD] New status:', WorkStatus.CANCELLED);
    console.log('─────────────────────────────────────────');
    console.log('[MARK CANCELLED PROD] 🎨 Expected UI changes:');
    console.log('  ✓ Job moves to "Cancelled" section at bottom of board');
    console.log('  ✓ Orange "CANCELLED" badge appears');
    console.log('  ✓ Card is dimmed/grayed out');
    console.log('  ✓ Service name has strikethrough');
    console.log('  ✓ Action buttons disabled');
    console.log('─────────────────────────────────────────');
    console.log('[MARK CANCELLED PROD] Refresh the page to see changes:');
    console.log('Board: https://ops.thesafaricarwash.com/en');
    console.log(`Job: https://ops.thesafaricarwash.com/en/jobs/${job.jobId}`);

  } catch (error: any) {
    console.error('[MARK CANCELLED PROD] ❌ Error:', error.message);
    console.error('[MARK CANCELLED PROD] Stack:', error.stack);
    throw error;
  }
}

const jobId = process.argv[2];

if (!jobId) {
  console.error('❌ Usage: npm run mark-cancelled-prod -- <bookingId>');
  console.error('Example: npm run mark-cancelled-prod -- i7nzfwxicf53cl');
  process.exit(1);
}

markJobAsCancelled(jobId)
  .then(() => {
    console.log('[MARK CANCELLED PROD] Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[MARK CANCELLED PROD] Failed:', error.message);
    process.exit(1);
  });
