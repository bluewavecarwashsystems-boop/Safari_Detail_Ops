# Phone Booking Location Restriction - Implementation Summary

## Overview

Phone Booking is now **restricted to a single Square location: L9ZMZD9TTTTZJ**. This restriction is enforced at multiple layers for security and consistency.

---

## Changes Made

### 1. Location Constant (Single Source of Truth)

**File**: `lib/config.ts`

Added a constant that serves as the single source of truth:

```typescript
export const PHONE_BOOKING_LOCATION_ID = 'L9ZMZD9TTTTZJ';
```

This constant is exported and imported wherever needed, ensuring consistency across the codebase.

---

### 2. Server-Side Location Filtering (Catalog API)

**File**: `lib/square/catalog-api.ts`

Added a new function `listPhoneBookingServices()` that:

- Uses POST `/v2/catalog/search` to query Square Catalog
- Filters items at the **item level** using `present_at_all_locations` or `present_at_location_ids`
- Filters variations at the **variation level** with the same logic
- Returns only services available at location `L9ZMZD9TTTTZJ`
- Logs the count of services before and after filtering

**Key filtering logic**:
```typescript
const isPresentAtLocation = 
  itemData.present_at_all_locations === true ||
  (itemData.present_at_location_ids && 
   itemData.present_at_location_ids.includes(PHONE_BOOKING_LOCATION_ID));
```

**Note**: The original `listServices()` function remains unchanged and is used by other features (e.g., checklist templates) that need all services across locations.

---

### 3. Phone Booking API Route Update

**File**: `app/api/square/services/route.ts`

- **Changed**: Now calls `listPhoneBookingServices()` instead of `listServices()`
- **Effect**: The dropdown in Phone Booking UI only receives location-filtered services
- **Logging**: Added clear indication that services are location-filtered

---

### 4. Booking Creation Validation (Server-Side)

**File**: `app/api/manager/create-booking/route.ts`

Added **server-side validation** to ensure that the `serviceVariationId` submitted is from the allowed location:

1. Uses `PHONE_BOOKING_LOCATION_ID` constant instead of config value
2. Fetches allowed services via `listPhoneBookingServices()`
3. Validates that the submitted `serviceVariationId` exists in the allowed list
4. **Rejects with 400 error** if service is not from the allowed location
5. Logs security warnings if invalid service is attempted

**Validation code**:
```typescript
const allowedServices = await listPhoneBookingServices();
const isValidService = allowedServices.some(s => s.id === serviceVariationId);

if (!isValidService) {
  console.error('[MANAGER BOOKING] SECURITY: Attempted to book service not from allowed location', {
    serviceVariationId,
    allowedLocation: locationId,
    allowedServiceIds: allowedServices.map(s => s.id),
  });
  
  return NextResponse.json({
    success: false,
    error: {
      code: 'INVALID_SERVICE',
      message: `Service variation ${serviceVariationId} is not available at location ${locationId}`,
    },
  }, { status: 400 });
}
```

**Location ID usage**: The booking is created using `PHONE_BOOKING_LOCATION_ID` constant, ensuring consistency with the Square Bookings API.

---

### 5. Frontend Guard (Defense in Depth)

**File**: `app/[locale]/manager/phone-booking/page.tsx`

Added client-side defensive measures:

1. Added location constant at the top of the file with documentation
2. Added logging when services are loaded to confirm server-side filtering
3. Added defensive check in form submission to ensure selected service is from the filtered list

**Frontend validation**:
```typescript
// DEFENSIVE: Ensure selected service is from our location-filtered list
const isValidService = services.some(s => s.id === selectedService.id);
if (!isValidService) {
  console.error('[PHONE BOOKING] SECURITY: Attempted to book invalid service', {
    serviceId: selectedService.id,
    location: PHONE_BOOKING_LOCATION_ID,
  });
  throw new Error('Selected service is not available for phone booking');
}
```

**Note**: This is a "belt and suspenders" approach. The primary enforcement is server-side.

---

## Files Changed

1. **`lib/config.ts`** - Added `PHONE_BOOKING_LOCATION_ID` constant
2. **`lib/square/catalog-api.ts`** - Added `listPhoneBookingServices()` function with location filtering
3. **`app/api/square/services/route.ts`** - Updated to use `listPhoneBookingServices()`
4. **`app/api/manager/create-booking/route.ts`** - Added server-side validation and uses location constant
5. **`app/[locale]/manager/phone-booking/page.tsx`** - Added frontend guard and logging

---

## Files NOT Changed (Confirmed)

- **`app/api/services/route.ts`** - Used by checklist templates, continues to use `listServices()` for all locations
- **`lib/square/bookings-api.ts`** - Booking creation already uses `locationId` parameter correctly
- No other screens or features were affected

---

## Enforcement Layers

### Layer 1: Server-Side Filtering (Primary)
- API route `/api/square/services` returns only services from location `L9ZMZD9TTTTZJ`
- Users cannot see services from other locations in the UI

### Layer 2: Server-Side Validation (Critical)
- Booking creation API validates `serviceVariationId` against allowed list
- Rejects attempts to book services not from the allowed location
- Returns 400 error with clear message

### Layer 3: Booking Creation Location Enforcement
- Booking is created with `location_id: L9ZMZD9TTTTZJ`
- Square API ensures booking is tied to correct location

### Layer 4: Frontend Guard (Defense in Depth)
- Client-side check ensures only filtered services can be selected
- Provides additional safety if backend changes

---

## Consistency Across Features

### Phone Booking Flow:
1. **Service List** → Filtered to location `L9ZMZD9TTTTZJ`
2. **Availability Search** → (Not currently implemented, but would use same location)
3. **Booking Creation** → Uses location `L9ZMZD9TTTTZJ` consistently

### Square API Calls:
- **Catalog Search**: Filtered server-side
- **Bookings Create**: Uses `location_id: L9ZMZD9TTTTZJ`
- **Bookings List**: (Not shown, but would filter by location if needed)

---

## Verification & Testing

### Server Logs to Monitor:
1. **Services fetch**: Check count before/after filtering
   ```
   [SQUARE CATALOG API] Phone booking services filtered {
     locationId: 'L9ZMZD9TTTTZJ',
     totalBeforeFilter: X,
     returnedAfterFilter: Y
   }
   ```

2. **Service validation**: Confirm services are being validated
   ```
   [MANAGER BOOKING] Service validated successfully {
     serviceVariationId: '...',
     locationId: 'L9ZMZD9TTTTZJ'
   }
   ```

3. **Security warnings**: Monitor for any invalid attempts
   ```
   [MANAGER BOOKING] SECURITY: Attempted to book service not from allowed location
   ```

### Manual Testing:
1. Navigate to Phone Booking page
2. Check service dropdown - should only show services from location `L9ZMZD9TTTTZJ`
3. Create a booking - should succeed with valid service
4. Check Square dashboard - booking should be at location `L9ZMZD9TTTTZJ`

### Edge Cases Handled:
- Services with `present_at_all_locations: true` → Included
- Services with `present_at_location_ids: ['L9ZMZD9TTTTZJ']` → Included
- Services at other locations only → Excluded
- Variation-level location filtering → Handled correctly
- Invalid service ID submission → Rejected with 400

---

## Security Considerations

✅ **Server-side enforcement** - Cannot be bypassed by client manipulation
✅ **Validation at booking creation** - Rejects invalid service IDs
✅ **Location constant** - Single source of truth prevents inconsistencies
✅ **Logging** - Security attempts are logged for monitoring
✅ **No location selector in UI** - Users cannot choose location for phone booking

---

## No Location Selector

As required, there is **no location selector** in the Phone Booking UI. The location is:
- Hardcoded in the constant `PHONE_BOOKING_LOCATION_ID`
- Used automatically in API calls
- Never exposed as a user-selectable option

---

## Summary

Phone Booking is now **fully restricted** to location `L9ZMZD9TTTTZJ`:
- ✅ Services are filtered server-side
- ✅ Booking creation validates service is from allowed location
- ✅ Booking is created at the correct location
- ✅ Frontend provides additional defensive checks
- ✅ All related calls use the same location consistently
- ✅ No other screens or features were affected
- ✅ Changes are minimal and safe

**Location: L9ZMZD9TTTTZJ is now the single source of truth for Phone Booking.**
