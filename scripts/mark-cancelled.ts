/**
 * Manual script to mark a job as cancelled (without fetching from Square)
 * 
 * Use this when a booking has been cancelled in Square but the webhook didn't fire
 * 
 * Usage: npm run mark-cancelled -- <jobId>
 * Example: npm run mark-cancelled -- q05ig8f7piy899
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

import { getJob, getJobByBookingId, updateJob } from '../lib/aws/dynamodb';
import { WorkStatus } from '../lib/types';

async function markJobAsCancelled(jobId: string) {
  console.log('[MARK CANCELLED] Starting for booking/job:', jobId);

  try {
    // 1. Find job in DynamoDB (try by jobId first, then by bookingId)
    console.log('[MARK CANCELLED] Looking for job in database...');
    let job = await getJob(jobId);
    
    if (!job) {
      console.log('[MARK CANCELLED] Not found by jobId, trying bookingId...');
      job = await getJobByBookingId(jobId);
    }

    if (!job) {
      console.error('[MARK CANCELLED] ❌ Job not found in database:', jobId);
      console.error('[MARK CANCELLED] Tried searching by both jobId and bookingId');
      console.error('[MARK CANCELLED] Make sure the booking ID is correct');
      return;
    }

    console.log('[MARK CANCELLED] Found job:', {
      jobId: job.jobId,
      customerName: job.customerName,
      serviceType: job.serviceType,
      currentStatus: job.status,
      appointmentTime: job.appointmentTime,
    });

    // 2. Check if already cancelled
    if (job.status === WorkStatus.CANCELLED) {
      console.log('[MARK CANCELLED] ℹ️  Job is already marked as CANCELLED');
      console.log('[MARK CANCELLED] Cancelled at:', job.cancelledAt);
      console.log('[MARK CANCELLED] Cancelled source:', job.cancelledSource);
      return;
    }

    // 3. Confirm with user (just log, proceed)
    console.log('[MARK CANCELLED] About to mark job as CANCELLED...');
    console.log('[MARK CANCELLED] Previous status:', job.status);

    // 4. Update job to CANCELLED
    await updateJob(job.jobId, {
      status: WorkStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      cancelledSource: 'manual',
      cancellationReason: 'Manually marked as cancelled - booking was cancelled in Square but webhook did not fire',
      updatedBy: 'manual-mark-cancelled-script',
    });

    console.log('[MARK CANCELLED] ✅ Job successfully updated to CANCELLED');
    console.log('[MARK CANCELLED] Job ID:', job.jobId);
    console.log('[MARK CANCELLED] Booking ID:', job.bookingId);
    console.log('[MARK CANCELLED] Customer:', job.customerName);
    console.log('[MARK CANCELLED] Previous status:', job.status);
    console.log('[MARK CANCELLED] New status:', WorkStatus.CANCELLED);
    console.log('[MARK CANCELLED] Refresh the Ops dashboard to see the change');

  } catch (error: any) {
    console.error('[MARK CANCELLED] ❌ Error:', error.message);
    console.error('[MARK CANCELLED] Stack:', error.stack);
    throw error;
  }
}

// Get jobId from command line args
const jobId = process.argv[2];

if (!jobId) {
  console.error('❌ Usage: npm run mark-cancelled -- <bookingId>');
  console.error('Example: npm run mark-cancelled -- q05ig8f7piy899');
  process.exit(1);
}

markJobAsCancelled(jobId)
  .then(() => {
    console.log('[MARK CANCELLED] Done. Check the Ops dashboard at:');
    console.log(`https://ops.thesafaricarwash.com/en`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('[MARK CANCELLED] Failed:', error.message);
    process.exit(1);
  });
