/**
 * Manual script to sync a specific cancelled booking from Square
 * 
 * Usage: npm run sync-booking -- <bookingId>
 * Example: npm run sync-booking -- q05ig8f7piy899
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

console.log('[SYNC BOOKING] Loaded environment from:', envPath);

import { retrieveBooking } from '../lib/square/bookings-api';
import { getJob } from '../lib/aws/dynamodb';
import { updateJob } from '../lib/aws/dynamodb';
import { WorkStatus } from '../lib/types';

async function syncCancelledBooking(bookingId: string) {
  console.log('[SYNC BOOKING] Starting sync for booking:', bookingId);

  try {
    // 1. Fetch booking from Square
    console.log('[SYNC BOOKING] Fetching booking from Square...');
    const squareBooking = await retrieveBooking(bookingId);
    
    if (!squareBooking) {
      console.error('[SYNC BOOKING] Booking not found in Square:', bookingId);
      return;
    }

    console.log('[SYNC BOOKING] Square booking status:', squareBooking.status);

    // 2. Check if booking is cancelled
    const status = squareBooking.status?.toUpperCase();
    const isCancelled = status === 'CANCELLED' || status === 'DECLINED' || status === 'NO_SHOW';

    if (!isCancelled) {
      console.log('[SYNC BOOKING] Booking is not cancelled. Current status:', squareBooking.status);
      return;
    }

    // 3. Find job in DynamoDB (use bookingId as jobId)
    console.log('[SYNC BOOKING] Looking for job in database...');
    const job = await getJob(bookingId);

    if (!job) {
      console.error('[SYNC BOOKING] Job not found in database:', bookingId);
      return;
    }

    console.log('[SYNC BOOKING] Current job status:', job.status);

    // 4. Update job to CANCELLED if not already
    if (job.status === WorkStatus.CANCELLED) {
      console.log('[SYNC BOOKING] Job is already marked as CANCELLED');
      return;
    }

    console.log('[SYNC BOOKING] Updating job to CANCELLED...');
    await updateJob(bookingId, {
      status: WorkStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      cancelledSource: 'square',
      cancellationReason: `Square booking status: ${squareBooking.status}`,
      updatedBy: 'manual-sync-script',
    });

    console.log('[SYNC BOOKING] ✅ Job successfully updated to CANCELLED');
    console.log('[SYNC BOOKING] Job ID:', bookingId);
    console.log('[SYNC BOOKING] Previous status:', job.status);
    console.log('[SYNC BOOKING] New status:', WorkStatus.CANCELLED);

  } catch (error: any) {
    console.error('[SYNC BOOKING] Error:', error.message);
    console.error('[SYNC BOOKING] Stack:', error.stack);
    throw error;
  }
}

// Get bookingId from command line args
const bookingId = process.argv[2];

if (!bookingId) {
  console.error('Usage: npm run sync-booking -- <bookingId>');
  console.error('Example: npm run sync-booking -- q05ig8f7piy899');
  process.exit(1);
}

syncCancelledBooking(bookingId)
  .then(() => {
    console.log('[SYNC BOOKING] Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[SYNC BOOKING] Failed:', error.message);
    process.exit(1);
  });
