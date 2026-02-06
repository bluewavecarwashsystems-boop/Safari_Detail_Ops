/**
 * Square Webhooks - Bookings Endpoint - Phase A Stub
 * 
 * GET/POST /api/square/webhooks/bookings
 * 
 * Phase A: Minimal endpoint scaffolding for webhook URL validation.
 * Returns fast 200 "OK" response so Square can validate the endpoint later.
 * 
 * - NO signature validation yet
 * - NO Square integration yet
 * - Defensive: never crashes on empty/invalid JSON
 * - Logs headers + body length (NOT content/secrets)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Disable body parsing so we can read raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Read raw body from request stream (handles empty body safely)
 */
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', (err) => {
      console.error('Error reading request body:', err);
      resolve(''); // Defensive: return empty string on error
    });
    
    // Timeout protection
    setTimeout(() => {
      resolve(data);
    }, 5000);
  });
}

/**
 * Safe logging helper - logs metadata without exposing secrets
 */
function logRequest(method: string, headers: any, bodyLength: number): void {
  const safeHeaders = { ...headers };
  
  // Remove sensitive headers from logs
  delete safeHeaders['x-square-signature'];
  delete safeHeaders['authorization'];
  delete safeHeaders['cookie'];
  
  console.log('[Phase A Webhook Stub]', {
    method,
    timestamp: new Date().toISOString(),
    headers: safeHeaders,
    bodyLength,
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const method = req.method || 'UNKNOWN';
    
    // Phase A: Accept both GET and POST for testing
    if (method !== 'GET' && method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    
    // Read body (won't crash if empty)
    const rawBody = await getRawBody(req);
    const bodyLength = rawBody.length;
    
    // Log request metadata (not content)
    logRequest(method, req.headers, bodyLength);
    
    // Phase A: Always return 200 OK quickly
    // This allows Square to validate the webhook URL
    res.status(200).send('OK');
    
  } catch (error) {
    // Phase A: Never crash - always return 200 OK
    console.error('[Phase A Webhook Stub] Error (recovering):', error);
    res.status(200).send('OK');
  }
}
