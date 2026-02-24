/**
 * Check job status script
 * 
 * Usage: npm run check-job -- <jobId>
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

import { getJob, getJobByBookingId } from '../lib/aws/dynamodb';

async function checkJob(jobId: string) {
  console.log('[CHECK JOB] Looking for job:', jobId);
  console.log('─────────────────────────────────────────');

  try {
    // Try finding by jobId first
    let job = await getJob(jobId);
    
    if (!job) {
      console.log('[CHECK JOB] Not found by jobId, trying bookingId...');
      job = await getJobByBookingId(jobId);
    }

    if (!job) {
      console.error('[CHECK JOB] ❌ Job NOT found in database');
      console.error('[CHECK JOB] This booking does not exist in Safari Detail Ops');
      console.error('[CHECK JOB] The webhook may have failed when the booking was created');
      return;
    }

    console.log('[CHECK JOB] ✅ Job FOUND in database');
    console.log('─────────────────────────────────────────');
    console.log('Job ID:', job.jobId);
    console.log('Booking ID:', job.bookingId);
    console.log('Customer:', job.customerName);
    console.log('Phone:', job.customerPhone || 'N/A');
    console.log('Email:', job.customerEmail || 'N/A');
    console.log('Service:', job.serviceType);
    console.log('Appointment:', job.appointmentTime);
    console.log('Current Status:', job.status);
    console.log('Payment Status:', job.payment?.status || 'N/A');
    console.log('Payment Amount:', job.payment?.amountCents ? `$${(job.payment.amountCents / 100).toFixed(2)}` : 'N/A');
    
    if (job.cancelledAt) {
      console.log('─────────────────────────────────────────');
      console.log('⚠️  ALREADY CANCELLED:');
      console.log('Cancelled At:', job.cancelledAt);
      console.log('Cancelled Source:', job.cancelledSource);
      console.log('Cancellation Reason:', job.cancellationReason);
    } else {
      console.log('─────────────────────────────────────────');
      console.log('✅ Job is ACTIVE and ready for cancellation test');
      console.log('When you cancel in Square:');
      console.log('  1. Square will send a webhook to the ops system');
      console.log('  2. The job status should update to CANCELLED automatically');
      console.log('  3. The job will appear in the "Cancelled" section on the board');
      console.log('  4. The job will be dimmed with an orange CANCELLED badge');
    }
    
    console.log('─────────────────────────────────────────');

  } catch (error: any) {
    console.error('[CHECK JOB] ❌ Error:', error.message);
    throw error;
  }
}

const jobId = process.argv[2];

if (!jobId) {
  console.error('Usage: npm run check-job -- <jobId>');
  process.exit(1);
}

checkJob(jobId)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
