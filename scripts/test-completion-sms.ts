/**
 * Test Twilio SMS Functionality
 * 
 * This script tests the completion SMS sending functionality.
 * 
 * Usage:
 *   Set environment variables:
 *     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID (or TWILIO_FROM_NUMBER)
 *     AWS_REGION, DYNAMODB_TABLE_NAME
 * 
 *   Run:
 *     npx tsx scripts/test-completion-sms.ts <jobId>
 */

import { sendCompletionSms } from '../lib/services/sms-service';

async function testCompletionSms() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('Usage: npx tsx scripts/test-completion-sms.ts <jobId>');
    process.exit(1);
  }

  console.log('Testing completion SMS for job:', jobId);
  console.log('Environment check:');
  console.log('  TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✓ Set' : '✗ Missing');
  console.log('  TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✓ Set' : '✗ Missing');
  console.log('  TWILIO_MESSAGING_SERVICE_SID:', process.env.TWILIO_MESSAGING_SERVICE_SID ? '✓ Set' : '(optional)');
  console.log('  TWILIO_FROM_NUMBER:', process.env.TWILIO_FROM_NUMBER ? '✓ Set' : '(optional)');
  console.log('');

  try {
    const result = await sendCompletionSms(jobId);
    
    console.log('✓ SMS send result:');
    console.log('  Sent:', result.sent);
    if (result.skipped) {
      console.log('  Skipped:', result.skipped);
      console.log('  Reason:', result.reason);
    }
    if (result.messageSid) {
      console.log('  Message SID:', result.messageSid);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error sending completion SMS:');
    console.error('  Message:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('  Stack:', error.stack);
    }
    process.exit(1);
  }
}

testCompletionSms();
