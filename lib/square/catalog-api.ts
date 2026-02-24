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

/**
 * Service item for phone bookings
 */
export interface CatalogService {
  id: string; // Variation ID
  itemId: string; // Item ID
  name: string;
  description?: string;
  durationMinutes?: number;
  priceMoney?: {
    amount: number;
    currency: string;
  };
  version: number;
}

/**
 * List all service items from Square Catalog
 * Filters for service-type items suitable for appointments
 * 
 * NOTE: Use listPhoneBookingServices() for phone booking to enforce location restriction
 */
export async function listServices(): Promise<CatalogService[]> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    throw new Error('Square access token not configured');
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/catalog/list?types=ITEM`;
    
    console.log('[SQUARE CATALOG API] Fetching services for booking');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SQUARE CATALOG API] Failed to fetch catalog', {
        status: response.status,
        error: errorText,
      });
      
      throw new Error(`Failed to fetch catalog: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      const errorMsg = data.errors.map((e: any) => `${e.code}: ${e.detail || e.category}`).join(', ');
      throw new Error(`Square API errors: ${errorMsg}`);
    }

    // Extract services from catalog items
    const services: CatalogService[] = [];
    
    if (data.objects) {
      for (const item of data.objects) {
        if (item.type === 'ITEM' && item.item_data) {
          const itemData = item.item_data;
          
          // Include all items with variations (services are catalog items)
          if (itemData.variations && itemData.variations.length > 0) {
            for (const variation of itemData.variations) {
              if (variation.type === 'ITEM_VARIATION' && variation.item_variation_data) {
                const varData = variation.item_variation_data;
                
                services.push({
                  id: variation.id,
                  itemId: item.id,
                  name: `${itemData.name || 'Service'}${varData.name && varData.name !== 'Regular' ? ` - ${varData.name}` : ''}`,
                  description: itemData.description,
                  durationMinutes: varData.service_duration ? Math.floor(varData.service_duration / 60000) : undefined,
                  priceMoney: varData.price_money ? {
                    amount: varData.price_money.amount || 0,
                    currency: varData.price_money.currency || 'USD',
                  } : undefined,
                  version: variation.version || 1,
                });
              }
            }
          }
        }
      }
    }

    console.log('[SQUARE CATALOG API] Found services', {
      count: services.length,
    });
    
    return services;
  } catch (error: any) {
    console.error('[SQUARE CATALOG API] Error fetching services', {
      error: error.message,
    });
    
    throw error;
  }
}

/**
 * List services for Phone Booking with location filtering
 * 
 * In PRODUCTION: Only returns services assigned to location from FRANKLIN_SQUARE_LOCATION_ID env var
 * In SANDBOX/QA: Returns all services (no location filtering)
 * 
 * @returns Services available for phone booking
 */
export async function listPhoneBookingServices(): Promise<CatalogService[]> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    throw new Error('Square access token not configured');
  }

  const locationId = config.square.franklinLocationId;
  const isProduction = config.square.environment === 'production';

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    // Use catalog/search API
    const url = `${baseUrl}/v2/catalog/search`;
    
    console.log('[SQUARE CATALOG API] Fetching phone booking services', {
      environment: config.square.environment,
      locationId,
      filteringEnabled: isProduction && !!locationId,
      note: isProduction ? 'Production filtering active' : 'Sandbox mode - all services',
    });
    
    const searchBody = {
      object_types: ['ITEM'],
      include_related_objects: true,
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SQUARE CATALOG API] Failed to fetch catalog', {
        status: response.status,
        error: errorText,
      });
      
      throw new Error(`Failed to fetch catalog: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      const errorMsg = data.errors.map((e: any) => `${e.code}: ${e.detail || e.category}`).join(', ');
      throw new Error(`Square API errors: ${errorMsg}`);
    }

    // Extract and filter services from catalog items
    const services: CatalogService[] = [];
    const allServices: CatalogService[] = [];
    let totalServicesBeforeFilter = 0;
    let itemsWithLocationInfo = 0;
    
    if (data.objects) {
      for (const item of data.objects) {
        if (item.type === 'ITEM' && item.item_data) {
          const itemData = item.item_data;
          
          // Log location info for debugging
          const hasLocationInfo = 
            itemData.present_at_all_locations !== undefined ||
            itemData.present_at_location_ids !== undefined;
          
          if (hasLocationInfo) {
            itemsWithLocationInfo++;
          }
          
          // Debug logging for first few items
          if (allServices.length < 3) {
            console.log('[SQUARE CATALOG API] Item location debug', {
              itemName: itemData.name,
              present_at_all_locations: itemData.present_at_all_locations,
              present_at_location_ids: itemData.present_at_location_ids,
              targetLocationId: locationId,
              isProduction,
            });
          }
          
          // Check if item is present at the phone booking location
          let isPresentAtLocation: boolean;
          
          if (!isProduction || !locationId) {
            // Sandbox or no location configured: include all services
            isPresentAtLocation = true;
          } else {
            // Production with location: strict filtering
            isPresentAtLocation = 
              itemData.present_at_all_locations === true ||
              (itemData.present_at_location_ids && 
               itemData.present_at_location_ids.includes(locationId));
          }
          
          // Include all items with variations (services are catalog items)
          if (itemData.variations && itemData.variations.length > 0) {
            for (const variation of itemData.variations) {
              if (variation.type === 'ITEM_VARIATION' && variation.item_variation_data) {
                const varData = variation.item_variation_data;
                
                totalServicesBeforeFilter++;
                
                const serviceObj = {
                  id: variation.id,
                  itemId: item.id,
                  name: `${itemData.name || 'Service'}${varData.name && varData.name !== 'Regular' ? ` - ${varData.name}` : ''}`,
                  description: itemData.description,
                  durationMinutes: varData.service_duration ? Math.floor(varData.service_duration / 60000) : undefined,
                  priceMoney: varData.price_money ? {
                    amount: varData.price_money.amount || 0,
                    currency: varData.price_money.currency || 'USD',
                  } : undefined,
                  version: variation.version || 1,
                };
                
                // Store all services for fallback
                allServices.push(serviceObj);
                
                // Additional filtering at variation level
                let varPresentAtLocation: boolean;
                
                if (!isProduction || !locationId) {
                  // Sandbox or no location configured: include all
                  varPresentAtLocation = true;
                } else {
                  // Production with location: strict filtering
                  varPresentAtLocation =
                    varData.present_at_all_locations === true ||
                    (varData.present_at_location_ids && 
                     varData.present_at_location_ids.includes(locationId)) ||
                    // If variation doesn't have location info, inherit from item
                    (!varData.present_at_location_ids && !varData.present_at_all_locations && isPresentAtLocation);
                }
                
                if (varPresentAtLocation) {
                  services.push(serviceObj);
                }
              }
            }
          }
        }
      }
    }

    console.log('[SQUARE CATALOG API] Phone booking services result', {
      environment: config.square.environment,
      locationId,
      filteringEnabled: isProduction && !!locationId,
      totalBeforeFilter: totalServicesBeforeFilter,
      itemsWithLocationInfo,
      returnedAfterFilter: services.length,
    });
    
    // Warning if production filtering returns no services
    if (isProduction && locationId && services.length === 0 && allServices.length > 0) {
      console.warn('[SQUARE CATALOG API] No services found for location in production', {
        locationId,
        totalServicesInCatalog: allServices.length,
        itemsWithLocationInfo,
        action: `Assign services to location ${locationId} in Square Dashboard`,
      });
    }
    
    return services;
  } catch (error: any) {
    console.error('[SQUARE CATALOG API] Error fetching phone booking services', {
      error: error.message,
    });
    
    throw error;
  }
}
