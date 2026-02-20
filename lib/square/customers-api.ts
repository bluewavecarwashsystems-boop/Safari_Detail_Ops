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

/**
 * Phase 5: Search for customers by phone or email
 * 
 * @param query - Search query (phone or email)
 * @returns List of matching customers
 */
export async function searchCustomers(query: {
  phoneNumber?: string;
  emailAddress?: string;
}): Promise<SquareCustomer[]> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    console.warn('[SQUARE API] No access token configured, skipping customer search');
    return [];
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/customers/search`;
    
    const searchQuery: any = {
      query: {
        filter: {},
      },
    };

    if (query.phoneNumber) {
      searchQuery.query.filter.phone_number = {
        exact: query.phoneNumber,
      };
    }

    if (query.emailAddress) {
      searchQuery.query.filter.email_address = {
        exact: query.emailAddress,
      };
    }
    
    console.log('[SQUARE API] Searching customers', query);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify(searchQuery),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SQUARE API] Customer search failed', {
        status: response.status,
        error: errorText,
      });
      
      return [];
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      console.error('[SQUARE API] Customer search errors', data.errors);
      return [];
    }
    
    console.log('[SQUARE API] Customers found', {
      count: data.customers?.length || 0,
    });
    
    return (data.customers || []) as SquareCustomer[];
  } catch (error: any) {
    console.error('[SQUARE API] Customer search error', {
      error: error.message,
    });
    
    return [];
  }
}

/**
 * Phase 5: Create a new customer in Square
 * 
 * @param customer - Customer details
 * @returns Created customer
 */
export async function createCustomer(params: {
  givenName?: string;
  familyName?: string;
  phoneNumber?: string;
  emailAddress?: string;
  note?: string;
}): Promise<SquareCustomer> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    throw new Error('Square access token not configured');
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/customers`;
    
    const customerData: any = {};
    if (params.givenName) customerData.given_name = params.givenName;
    if (params.familyName) customerData.family_name = params.familyName;
    if (params.phoneNumber) customerData.phone_number = params.phoneNumber;
    if (params.emailAddress) customerData.email_address = params.emailAddress;
    if (params.note) customerData.note = params.note;
    
    console.log('[SQUARE API] Creating customer', {
      hasName: !!(params.givenName || params.familyName),
      hasPhone: !!params.phoneNumber,
      hasEmail: !!params.emailAddress,
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SQUARE API] Create customer failed', {
        status: response.status,
        error: errorText,
      });
      
      throw new Error(`Failed to create customer: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      const errorMsg = data.errors.map((e: any) => `${e.code}: ${e.detail || e.category}`).join(', ');
      throw new Error(`Square API errors: ${errorMsg}`);
    }
    
    console.log('[SQUARE API] Customer created', {
      customerId: data.customer?.id,
    });
    
    return data.customer as SquareCustomer;
  } catch (error: any) {
    console.error('[SQUARE API] Create customer error', {
      error: error.message,
    });
    
    throw error;
  }
}

/**
 * Phase 5: Find or create a customer by phone/email
 * 
 * @param params - Customer search/create parameters
 * @returns Existing or newly created customer
 */
export async function findOrCreateCustomer(params: {
  name: string;
  phone: string;
  email?: string;
}): Promise<SquareCustomer> {
  // First, try to find by phone
  let customers = await searchCustomers({ phoneNumber: params.phone });
  
  if (customers.length > 0) {
    console.log('[SQUARE API] Found existing customer by phone', {
      customerId: customers[0].id,
    });
    return customers[0];
  }
  
  // If email provided, try to find by email
  if (params.email) {
    customers = await searchCustomers({ emailAddress: params.email });
    
    if (customers.length > 0) {
      console.log('[SQUARE API] Found existing customer by email', {
        customerId: customers[0].id,
      });
      return customers[0];
    }
  }
  
  // Customer not found, create new one
  const nameParts = params.name.trim().split(' ');
  const givenName = nameParts[0] || params.name;
  const familyName = nameParts.slice(1).join(' ') || undefined;
  
  return createCustomer({
    givenName,
    familyName,
    phoneNumber: params.phone,
    emailAddress: params.email,
  });
}

/**
 * Phase 3: Convert Square customer to cached format for job records
 * 
 * @param customer - Square customer object
 * @returns CustomerCached object
 */
export function toCustomerCached(customer: SquareCustomer): {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  cachedAt: string;
} {
  return {
    id: customer.id,
    name: formatCustomerName(customer),
    email: customer.email_address,
    phone: customer.phone_number,
    cachedAt: new Date().toISOString(),
  };
}

/**
 * Phase 3: Check if customer cache is stale (older than 24 hours)
 * 
 * @param cachedAt - ISO timestamp of when customer was cached
 * @returns true if cache is stale or missing
 */
export function isCacheStale(cachedAt?: string): boolean {
  if (!cachedAt) {
    return true;
  }

  const cacheAge = Date.now() - new Date(cachedAt).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  return cacheAge > oneDayMs;
}

/**
 * Phase 3: Fetch customer with retry logic for webhook safety
 * 
 * @param customerId - Square customer ID
 * @param retries - Number of retries on failure (default: 1)
 * @returns Customer cached data or null
 */
export async function fetchCustomerWithRetry(
  customerId: string,
  retries: number = 1
): Promise<{
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  cachedAt: string;
} | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const customer = await fetchCustomerDetails(customerId);
      if (!customer) {
        return null;
      }
      return toCustomerCached(customer);
    } catch (error: any) {
      if (attempt < retries) {
        const delayMs = 500 * (attempt + 1);
        console.log(`[SQUARE API] Retry ${attempt + 1}/${retries} after ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error(`[SQUARE API] Failed after ${retries} retries`);
        return null;
      }
    }
  }
  
  return null;
}
