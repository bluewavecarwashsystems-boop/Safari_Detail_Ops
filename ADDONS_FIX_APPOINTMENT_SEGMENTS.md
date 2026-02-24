# Add-ons Fix: Appointment Segments Architecture

## Issue
Add-ons were not appearing in Square Bookings UI despite successful order creation. The Square Bookings interface only displays items in the `appointment_segments` array, not separately linked orders.

## Root Cause
- Original implementation: Add-ons stored as separate Square Orders linked to bookings via `order_id`
- Square UI limitation: Bookings dashboard only shows `appointment_segments`, not linked orders
- Result: Add-ons were created and linked but invisible in Square's booking interface

## Solution
Changed architecture to use appointment segments for add-ons while maintaining backward compatibility:

### 1. Updated Bookings API (`lib/square/bookings-api.ts`)
- Added optional `addonVariationIds` parameter: `Array<{id: string, version: number}>`
- Changed `appointment_segments` from single segment to array
- Add-ons added as segments with `duration_minutes: 0` (don't extend appointment time)
- Each add-on requires both ID and version number for Square API

```typescript
export async function createBooking({
  customerId,
  locationId,
  serviceVariationId,
  serviceVariationVersion,
  startAt,
  durationMinutes,
  teamMemberId,
  customerNote,
  sellerNote,
  addonVariationIds, // NEW: Array of addon IDs with versions
}: CreateBookingParams): Promise<SquareBooking>
```

### 2. Updated Create Booking Route (`app/api/manager/create-booking/route.ts`)
**Step 3: Validate and prepare add-ons**
- Fetch all available add-ons using `listAddons()`
- Validate each selected addon ID against available addons
- Extract version numbers for each addon

**Step 4: Create booking with add-ons as segments**
- Pass `addonVariationIds` to `createBooking()`
- Add-ons become appointment segments with 0-duration
- Base service + add-ons all in single booking

**Step 4.5: Create reference order (optional)**
- For backward compatibility and tracking
- Wrapped in try-catch - won't fail booking if order creation fails
- Add-ons already visible in booking, order is supplementary

## Technical Details

### Appointment Segments Structure
```typescript
const appointmentSegments = [
  // Base service segment
  {
    duration_minutes: durationMinutes,
    service_variation_id: serviceVariationId,
    service_variation_version: serviceVariationVersion,
    team_member_id: teamMemberId,
  },
  // Add-on segments (0-duration)
  ...addonVariationIds.map(addon => ({
    duration_minutes: 0, // Don't extend total appointment time
    service_variation_id: addon.id,
    service_variation_version: addon.version,
  }))
];
```

### Version Numbers
- Square requires `service_variation_version` for all appointment segments
- Version numbers fetched from Catalog API via `listAddons()`
- Ensures API calls use correct catalog object versions

### Backward Compatibility
- Reference order still created for tracking (optional)
- Existing `orderId` field in DynamoDB job record maintained
- Order creation failure doesn't fail booking (add-ons already in segments)

## Testing Checklist

- [ ] Create booking with base service only → appears in Square UI
- [ ] Create booking with base service + 1 add-on → both appear in Square UI
- [ ] Create booking with base service + multiple add-ons → all appear in Square UI
- [ ] Verify appointment_segments array contains correct number of items
- [ ] Verify add-on segments have duration_minutes: 0
- [ ] Verify reference order created successfully (optional)
- [ ] Verify booking creation succeeds even if order creation fails
- [ ] Check Square Bookings dashboard shows all services/items
- [ ] Verify total appointment duration = base service duration (not extended by add-ons)

## Files Modified

### Core Changes
- `lib/square/bookings-api.ts` - Added appointment segments support
- `app/api/manager/create-booking/route.ts` - Updated validation and booking creation flow

### No Changes Needed
- `lib/square/orders-api.ts` - Still used for reference order creation
- `lib/square/catalog-api.ts` - Already has `listAddons()` and validation
- `app/[locale]/manager/phone-booking/page.tsx` - UI already works correctly
- `app/api/phone-booking/catalog/route.ts` - Already provides addons separately

## Benefits

1. **UI Visibility**: Add-ons now visible in Square Bookings dashboard
2. **Correct Duration**: 0-duration segments don't extend appointment time
3. **Single API Call**: Create booking + add-ons in one Square API request
4. **Backward Compatible**: Reference order maintained for tracking
5. **Fail-Safe**: Order creation failure doesn't affect booking

## Next Steps

1. Test booking creation with add-ons
2. Update booking retrieval endpoints to extract add-ons from appointment_segments
3. Consider removing reference order creation after confirming segments work
4. Update documentation to reflect segments-first architecture

## Architecture Decision

**Before**: Bookings (base service) + Orders (add-ons) = Separate entities
**After**: Bookings (base service + add-on segments) + Orders (optional reference) = Single booking entity

This aligns with Square's architectural design where Bookings represent appointments with all services/items as segments, while Orders represent separate sales transactions.
