/**
 * List recent jobs to see what's in the system
 */

import { config } from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

import { listJobs } from '../lib/aws/dynamodb';

async function listRecentJobs() {
  console.log('[LIST JOBS] Fetching recent jobs from database...');
  console.log('═════════════════════════════════════════════════════════════');

  try {
    const result = await listJobs({ limit: 20 });
    
    if (result.jobs.length === 0) {
      console.log('❌ NO JOBS FOUND in the database');
      console.log('This suggests webhooks are not creating jobs at all');
      return;
    }

    console.log(`✅ Found ${result.jobs.length} jobs\n`);
    
    result.jobs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((job, index) => {
        console.log(`${index + 1}. ${job.customerName || 'Unknown'}`);
        console.log(`   Job ID: ${job.jobId}`);
        console.log(`   Booking ID: ${job.bookingId || 'N/A'}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Service: ${job.serviceType}`);
        console.log(`   Appointment: ${job.appointmentTime}`);
        console.log(`   Created: ${job.createdAt}`);
        console.log(`   Created By: ${job.createdBy || 'webhook'}`);
        console.log('');
      });

    console.log('═════════════════════════════════════════════════════════════');
    console.log(`Total: ${result.jobs.length} jobs`);
    
  } catch (error: any) {
    console.error('[LIST JOBS] Error:', error.message);
    throw error;
  }
}

listRecentJobs()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
