/**
 * Check Job SMS Status
 * 
 * Diagnostic script to check if a job is ready for SMS and view SMS status
 * 
 * Usage:
 *   npx tsx scripts/check-job-sms-status.ts <jobId>
 */

import { getJob } from '../lib/aws/dynamodb';

async function checkJobSmsStatus() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('Usage: npx tsx scripts/check-job-sms-status.ts <jobId>');
    process.exit(1);
  }

  console.log('🔍 Checking job SMS status...\n');

  try {
    const job = await getJob(jobId);

    if (!job) {
      console.error('❌ Job not found:', jobId);
      process.exit(1);
    }

    console.log('📋 Job Details:');
    console.log('  Job ID:', job.jobId);
    console.log('  Status:', job.status);
    console.log('  Customer Name:', job.customerName);
    console.log('  Customer Phone:', job.customerPhone || '(missing)');
    console.log('  Customer Email:', job.customerEmail || '(missing)');
    console.log('');

    console.log('📱 SMS Status:');
    console.log('  SMS Sent At:', job.completionSmsSentAt || '(not sent)');
    console.log('  SMS SID:', job.completionSmsSid || '(not sent)');
    console.log('');

    console.log('✅ SMS Readiness Check:');
    
    if (job.status !== 'WORK_COMPLETED') {
      console.log('  ⚠️  Status is not WORK_COMPLETED (currently:', job.status + ')');
      console.log('      SMS only sends when transitioning TO WORK_COMPLETED');
    } else {
      console.log('  ✓ Status is WORK_COMPLETED');
    }

    if (!job.customerPhone) {
      console.log('  ❌ No customer phone number');
    } else if (!job.customerPhone.startsWith('+')) {
      console.log('  ⚠️  Phone format issue:', job.customerPhone);
      console.log('      Expected E.164 format (e.g., +16155551234)');
    } else {
      console.log('  ✓ Valid phone format:', job.customerPhone);
    }

    if (job.completionSmsSentAt) {
      console.log('  ℹ️  SMS already sent at', job.completionSmsSentAt);
      console.log('      (Idempotency prevents duplicate sends)');
    } else {
      console.log('  ○ SMS not yet sent');
    }

    console.log('');
    console.log('💡 Recommendation:');
    if (!job.customerPhone) {
      console.log('  Add a customer phone number to this job, then mark it complete again.');
    } else if (job.completionSmsSentAt) {
      console.log('  SMS was already sent. Check Twilio logs or customer\'s phone.');
    } else if (job.status !== 'WORK_COMPLETED') {
      console.log('  Mark the job status as WORK_COMPLETED to trigger SMS.');
    } else {
      console.log('  Job appears ready. Try running: npx tsx scripts/test-completion-sms.ts ' + jobId);
    }

  } catch (error: any) {
    console.error('❌ Error checking job:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkJobSmsStatus();
