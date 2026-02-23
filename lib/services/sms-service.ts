/**
 * SMS Service
 * 
 * Handles SMS notifications for job lifecycle events.
 */

import { sendSms } from '../twilio';
import * as dynamodb from '../aws/dynamodb';
import type { Job } from '../types';

/**
 * Normalize US phone number to E.164 format
 * 
 * @param phone - Phone number in various formats
 * @returns E.164 formatted phone number (+1XXXXXXXXXX)
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it's 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's 11 digits and starts with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it already starts with +, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Otherwise, assume US and add +1
  if (digits.length > 0) {
    return `+1${digits}`;
  }
  
  return phone;
}

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

  // Normalize phone number to E.164 format (handles various formats)
  const phone = normalizePhoneNumber(job.customerPhone.trim());
  
  // Validate E.164 format after normalization
  if (!phone.startsWith('+') || phone.length < 12) {
    console.error('[SMS SERVICE] Failed to normalize phone to E.164', {
      jobId,
      originalPhone: job.customerPhone,
      normalizedPhone: phone,
    });
    throw new Error(
      `Invalid phone number format: ${job.customerPhone}. Could not normalize to E.164 format (e.g., +1615xxxxxxx)`
    );
  }

  // Build message with optional customer name
  const customerName = job.customerName || '';
  const greeting = customerName ? `${customerName.split(' ')[0]}, ` : '';
  
  const messageBody = `${greeting}your vehicle is complete and ready for pickup.\nThank you for choosing Safari Car Wash.\nFor any questions, please call 615-794-2410.`;

  try {
    // Send SMS via Twilio
    const messageSid = await sendSms(phone, messageBody);

    console.log('[SMS SERVICE] Completion SMS sent successfully', {
      jobId,
      originalPhone: job.customerPhone,
      normalizedPhone: phone,
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
      originalPhone: job.customerPhone,
      normalizedPhone: phone,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
