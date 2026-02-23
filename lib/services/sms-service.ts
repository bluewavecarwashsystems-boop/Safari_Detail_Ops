/**
 * SMS Service
 * 
 * Handles SMS notifications for job lifecycle events.
 */

import { sendSms } from '../twilio';
import * as dynamodb from '../aws/dynamodb';
import type { Job } from '../types';

/**
 * Send completion SMS to customer when job is marked as WORK_COMPLETED
 * 
 * @param jobId - Job ID
 * @returns Object containing success status and message SID if sent
 */
export async function sendCompletionSms(jobId: string): Promise<{
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  messageSid?: string;
}> {
  // Fetch job from database
  const job = await dynamodb.getJob(jobId);

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Check if SMS was already sent (idempotency)
  if (job.completionSmsSentAt) {
    console.log('[SMS SERVICE] Completion SMS already sent', {
      jobId,
      sentAt: job.completionSmsSentAt,
      messageSid: job.completionSmsSid,
    });
    return {
      sent: false,
      skipped: true,
      reason: 'already_sent',
    };
  }

  // Validate customer phone
  if (!job.customerPhone) {
    console.warn('[SMS SERVICE] No customer phone number', { jobId });
    return {
      sent: false,
      skipped: true,
      reason: 'no_phone',
    };
  }

  // Normalize phone number if needed (basic validation)
  const phone = job.customerPhone.trim();
  if (!phone.startsWith('+')) {
    console.error('[SMS SERVICE] Invalid phone format (must be E.164)', {
      jobId,
      phone: job.customerPhone,
    });
    throw new Error(
      `Invalid phone number format: ${job.customerPhone}. Expected E.164 format (e.g., +1615xxxxxxx)`
    );
  }

  // Build message with optional customer name
  const customerName = job.customerName || '';
  const greeting = customerName ? `${customerName.split(' ')[0]}, ` : '';
  
  const messageBody = `${greeting}Safari Detail Ops: Your vehicle is complete and ready. Questions? Call (615) 431-2770.`;

  try {
    // Send SMS via Twilio
    const messageSid = await sendSms(phone, messageBody);

    console.log('[SMS SERVICE] Completion SMS sent successfully', {
      jobId,
      phone,
      messageSid,
    });

    // Update job record with SMS metadata
    await dynamodb.updateJob(jobId, {
      completionSmsSentAt: new Date().toISOString(),
      completionSmsSid: messageSid,
    });

    return {
      sent: true,
      messageSid,
    };
  } catch (error: any) {
    console.error('[SMS SERVICE] Failed to send completion SMS', {
      jobId,
      phone,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
