/**
 * Square Catalog API Client
 * 
 * Fetches catalog item and variation details from Square Catalog API.
 */

import { getConfig } from '../config';

/**
 * Catalog item variation from Square API
 */
export interface CatalogItemVariation {
  id: string;
  item_variation_data?: {
    item_id?: string;
    name?: string;
    sku?: string;
    pricing_type?: string;
    price_money?: {
      amount?: number;
      currency?: string;
    };
  };
}

/**
 * Catalog item from Square API
 */
export interface CatalogItem {
  id: string;
  type: string;
  item_data?: {
    name?: string;
    description?: string;
    category_id?: string;
    variations?: CatalogItemVariation[];
  };
}

/**
 * Batch retrieve catalog objects response
 */
export interface CatalogBatchResponse {
  objects?: CatalogObject[];
  errors?: any[];
}

/**
 * Generic catalog object
 */
export interface CatalogObject {
  id: string;
  type: string;
  item_data?: {
    name?: string;
    description?: string;
  };
  item_variation_data?: {
    item_id?: string;
    name?: string;
    price_money?: {
      amount?: number;
      currency?: string;
    };
  };
}

/**
 * In-memory cache for catalog objects
 * Key: variation_id, Value: formatted service name
 */
const catalogCache = new Map<string, string>();

/**
 * Cache TTL in milliseconds (1 hour)
 */
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Cache expiry tracking
 */
const cacheExpiry = new Map<string, number>();

/**
 * Fetch catalog object (item or variation) from Square Catalog API
 * 
 * @param objectId - Catalog object ID (item or variation ID)
 * @returns Catalog object or null if not found
 */
export async function fetchCatalogObject(objectId: string): Promise<CatalogObject | null> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    console.warn('[SQUARE CATALOG API] No access token configured, skipping catalog fetch');
    return null;
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/catalog/object/${objectId}?include_related_objects=true`;
    
    console.log('[SQUARE CATALOG API] Fetching catalog object', { objectId });
    
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
        console.warn('[SQUARE CATALOG API] Object not found', { objectId });
        return null;
      }
      
      const errorText = await response.text();
      console.error('[SQUARE CATALOG API] Fetch failed', {
        objectId,
        status: response.status,
        error: errorText,
      });
      
      return null;
    }

    const data = await response.json();
    const catalogObject = data.object as CatalogObject;
    
    console.log('[SQUARE CATALOG API] Object fetched', {
      objectId,
      type: catalogObject.type,
      hasItemData: !!catalogObject.item_data,
      hasVariationData: !!catalogObject.item_variation_data,
    });
    
    return catalogObject;
  } catch (error: any) {
    console.error('[SQUARE CATALOG API] Fetch error', {
      objectId,
      error: error.message,
    });
    
    return null;
  }
}

/**
 * Fetch service variation name with related item name
 * 
 * @param variationId - Service variation ID
 * @returns Formatted service name or variation ID if fetch fails
 */
export async function fetchServiceName(variationId: string): Promise<string> {
  // Check cache first
  const cached = getCachedServiceName(variationId);
  if (cached) {
    console.log('[SQUARE CATALOG API] Cache hit', { variationId, serviceName: cached });
    return cached;
  }

  try {
    const catalogObject = await fetchCatalogObject(variationId);
    
    if (!catalogObject) {
      console.warn('[SQUARE CATALOG API] Failed to fetch variation, using ID', { variationId });
      return variationId;
    }

    let serviceName = variationId; // Default to ID

    // If this is a variation, try to get both item name and variation name
    if (catalogObject.type === 'ITEM_VARIATION' && catalogObject.item_variation_data) {
      const variationName = catalogObject.item_variation_data.name;
      const itemId = catalogObject.item_variation_data.item_id;
      
      // Try to fetch parent item for full context
      if (itemId) {
        const itemObject = await fetchCatalogObject(itemId);
        if (itemObject && itemObject.item_data) {
          const itemName = itemObject.item_data.name;
          
          // Format: "Item Name - Variation Name" or just "Item Name" if variation name is generic
          if (variationName && variationName.toLowerCase() !== 'regular' && variationName !== itemName) {
            serviceName = `${itemName} - ${variationName}`;
          } else {
            serviceName = itemName || variationName || variationId;
          }
        } else {
          serviceName = variationName || variationId;
        }
      } else {
        serviceName = variationName || variationId;
      }
    } else if (catalogObject.type === 'ITEM' && catalogObject.item_data) {
      // Direct item reference
      serviceName = catalogObject.item_data.name || variationId;
    }

    // Cache the result
    setCachedServiceName(variationId, serviceName);
    
    console.log('[SQUARE CATALOG API] Service name resolved', {
      variationId,
      serviceName,
      cached: true,
    });

    return serviceName;
  } catch (error: any) {
    console.error('[SQUARE CATALOG API] Error fetching service name', {
      variationId,
      error: error.message,
    });
    
    return variationId; // Fall back to ID
  }
}

/**
 * Get cached service name
 * 
 * @param variationId - Service variation ID
 * @returns Cached service name or null if not cached or expired
 */
function getCachedServiceName(variationId: string): string | null {
  const expiry = cacheExpiry.get(variationId);
  
  if (!expiry || Date.now() > expiry) {
    // Cache miss or expired
    catalogCache.delete(variationId);
    cacheExpiry.delete(variationId);
    return null;
  }
  
  return catalogCache.get(variationId) || null;
}

/**
 * Set cached service name with TTL
 * 
 * @param variationId - Service variation ID
 * @param serviceName - Formatted service name
 */
function setCachedServiceName(variationId: string, serviceName: string): void {
  catalogCache.set(variationId, serviceName);
  cacheExpiry.set(variationId, Date.now() + CACHE_TTL);
}

/**
 * Clear catalog cache (useful for testing or manual refresh)
 */
export function clearCatalogCache(): void {
  catalogCache.clear();
  cacheExpiry.clear();
  console.log('[SQUARE CATALOG API] Cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: catalogCache.size,
    entries: Array.from(catalogCache.keys()),
  };
}
