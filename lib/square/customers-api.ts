/**
 * Square Customers API Client
 * 
 * Fetches customer details from Square Customers API.
 */

import { getConfig } from '../config';

/**
 * Customer details from Square API
 */
export interface SquareCustomer {
  id: string;
  given_name?: string;
  family_name?: string;
  email_address?: string;
  phone_number?: string;
  company_name?: string;
  nickname?: string;
}

/**
 * Fetch customer details from Square Customers API
 * 
 * @param customerId - Square customer ID
 * @returns Customer details or null if not found
 */
export async function fetchCustomerDetails(customerId: string): Promise<SquareCustomer | null> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    console.warn('[SQUARE API] No access token configured, skipping customer fetch');
    return null;
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/customers/${customerId}`;
    
    console.log('[SQUARE API] Fetching customer', { customerId });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[SQUARE API] Customer not found', { customerId });
        return null;
      }
      
      const errorText = await response.text();
      console.error('[SQUARE API] Customer fetch failed', {
        customerId,
        status: response.status,
        error: errorText,
      });
      
      return null;
    }

    const data = await response.json();
    const customer = data.customer as SquareCustomer;
    
    console.log('[SQUARE API] Customer fetched', {
      customerId,
      hasName: !!(customer.given_name || customer.family_name),
      hasEmail: !!customer.email_address,
      hasPhone: !!customer.phone_number,
    });
    
    return customer;
  } catch (error: any) {
    console.error('[SQUARE API] Customer fetch error', {
      customerId,
      error: error.message,
    });
    
    return null;
  }
}

/**
 * Format customer name from Square customer object
 * 
 * @param customer - Square customer object
 * @returns Formatted name or 'Unknown Customer'
 */
export function formatCustomerName(customer: SquareCustomer | null): string {
  if (!customer) {
    return 'Unknown Customer';
  }

  // Try full name
  if (customer.given_name && customer.family_name) {
    return `${customer.given_name} ${customer.family_name}`.trim();
  }

  // Try first name only
  if (customer.given_name) {
    return customer.given_name;
  }

  // Try last name only
  if (customer.family_name) {
    return customer.family_name;
  }

  // Try company name
  if (customer.company_name) {
    return customer.company_name;
  }

  // Try nickname
  if (customer.nickname) {
    return customer.nickname;
  }

  // Fallback
  return 'Unknown Customer';
}

/**
 * Extract customer contact info from Square customer object
 * 
 * @param customer - Square customer object
 * @returns Contact info object
 */
export function extractCustomerContact(customer: SquareCustomer | null): {
  email?: string;
  phone?: string;
} {
  if (!customer) {
    return {};
  }

  return {
    email: customer.email_address,
    phone: customer.phone_number,
  };
}
