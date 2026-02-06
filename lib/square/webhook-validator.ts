/**
 * Square Webhook Signature Validation
 * 
 * Validates webhook signatures from Square to ensure authenticity.
 * Reference: https://developer.squareup.com/docs/webhooks/step3validate
 */

import * as crypto from 'crypto';

/**
 * Validate Square webhook signature
 * 
 * @param body - Raw request body as string
 * @param signature - Signature from X-Square-Signature or X-Square-Hmacsha256-Signature header
 * @param signatureKey - Square webhook signature key from dashboard
 * @param url - Full webhook URL (including https://)
 * @returns true if signature is valid, false otherwise
 */
export function validateWebhookSignature(
  body: string,
  signature: string,
  signatureKey: string,
  url: string
): boolean {
  try {
    // Concatenate the URL and the body with no delimiter
    const payload = url + body;
    
    // Generate HMAC-SHA256 hash
    const hmac = crypto.createHmac('sha256', signatureKey);
    hmac.update(payload);
    const hash = hmac.digest('base64');
    
    // Quick length check before timing-safe comparison
    if (signature.length !== hash.length) {
      return false;
    }
    
    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hash)
    );
  } catch (error) {
    console.error('[WEBHOOK VALIDATION ERROR]', error);
    return false;
  }
}

/**
 * Extract signature from request headers
 * 
 * @param headers - Request headers object
 * @returns Signature string or null if not found
 */
export function extractSignature(headers: any): string | null {
  // Try both header names (Square uses different names in different contexts)
  const signature = 
    headers['x-square-hmacsha256-signature'] || 
    headers['x-square-signature'];
  
  return signature || null;
}

/**
 * Build full webhook URL from request
 * 
 * @param host - Host header from request
 * @param path - Request path
 * @returns Full URL string
 */
export function buildWebhookUrl(host: string, path: string): string {
  // Determine protocol (use https in production, http for localhost)
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}${path}`;
}
