/**
 * Twilio Client
 * 
 * Provides a reusable Twilio client for sending SMS messages.
 */

import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;

/**
 * Get or create Twilio client
 */
export function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(
        'Missing Twilio credentials: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required'
      );
    }

    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
}

/**
 * Send an SMS using Twilio
 * 
 * @param to - Recipient phone number (E.164 format, e.g., +1615xxxxxxx)
 * @param body - Message body
 * @returns Twilio message SID
 */
export async function sendSms(
  to: string,
  body: string
): Promise<string> {
  const client = getTwilioClient();

  // Validate phone number format (basic E.164 check)
  if (!to || !to.startsWith('+')) {
    throw new Error(`Invalid phone number format: ${to}. Expected E.164 format (e.g., +1615xxxxxxx)`);
  }

  // Get from number or messaging service SID
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!messagingServiceSid && !fromNumber) {
    throw new Error(
      'Missing Twilio configuration: Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER required'
    );
  }

  const messageOptions: any = {
    to,
    body,
  };

  // Prefer messaging service over from number
  if (messagingServiceSid) {
    messageOptions.messagingServiceSid = messagingServiceSid;
  } else {
    messageOptions.from = fromNumber;
  }

  const message = await client.messages.create(messageOptions);

  return message.sid;
}
