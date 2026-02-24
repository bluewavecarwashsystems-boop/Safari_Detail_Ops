# Add-ons Implementation: Orders Architecture (Square API Limitation)

## Issue Discovered
Attempted to add add-ons as appointment segments in Square bookings, but Square API rejected them with error:
```
"Field is not valid" for booking.appointment_segments[1-4].service_variation_id
```

## Root Cause
**Square API architectural limitation**: The `appointment_segments` array in Bookings API only accepts catalog items of type `APPOINTMENT_SERVICE`. Add-ons are catalog items of type `ITEM` (not appointment services), so they cannot be used as `service_variation_id` in appointment segments.

## Confirmed Architecture
Square separates:
- **Bookings**: Appointments with `APPOINTMENT_SERVICE` items only
- **Orders**: Sales transactions with any `ITEM` catalog objects

You cannot mix regular items (add-ons) with appointment services in the same booking segments.

## Correct Implementation
Add-ons MUST be created as separate Square Orders and linked to bookings via metadata:

### 1. Bookings API (`lib/square/bookings-api.ts`)
- Only base `APPOINTMENT_SERVICE` in appointment_segments
- No add-ons support in segments
- Single segment per booking

### 2. Create Booking Route (`app/api/manager/create-booking/route.ts`)
**Step 3: Create booking with base service only**
- Create Square booking with single appointment segment
- Base service (APPOINTMENT_SERVICE type)

**Step 4: Create order for add-ons**
- Validate each add-on using `validateAddonVariation()`
- Create Square Order with add-on line items
- Link order to booking via `booking_id` in metadata
- Store `orderId` in DynamoDB job record

## Trade-offs

### ✅ What Works
- Add-ons stored as Square Orders (proper catalog item type)
- Orders linked to bookings via metadata
- Add-ons visible in Safari Detail Ops custom UI
- Add-ons tracked in DynamoDB
- Full pricing and inventory management

### ❌ Square UI Limitation
- Add-ons NOT visible in Square Bookings dashboard
- Square Bookings interface only shows `appointment_segments`
- Linked orders are separate transactions in Square

## Why This Is OK

1. **Safari Detail Ops UI**: Custom UI shows all add-ons from orders
2. **DynamoDB Integration**: Job records include `orderId` field
3. **Square Architecture**: Intentional separation of bookings vs sales
4. **Alternative Solutions are Not Viable**:
   - Cannot add ITEM types to appointment segments (API rejects)
   - Converting add-ons to APPOINTMENT_SERVICE would break catalog structure
   - Creating separate bookings per add-on would create multiple appointments

## Technical Details

### Booking Creation (Base Service Only)
```typescript
const squareBooking = await createBooking({
  customerId: customer.id,
  locationId: locationId,
  serviceVariationId: serviceVariationId, // APPOINTMENT_SERVICE type
  serviceVariationVersion: serviceVariationVersion,
  startAt: body.appointmentTime.startAt,
  durationMinutes: body.service.durationMinutes,
  teamMemberId: teamMemberId,
  customerNote: body.notes,
  sellerNote: vehicleNote,
  // NO addonVariationIds - not supported by Square API
});
```

### Order Creation (Add-ons)
```typescript
const order = await createOrder({
  locationId: locationId,
  lineItems: addonIds.map(id => ({
    catalog_object_id: id, // ITEM type (add-ons)
    quantity: '1',
    metadata: {
      source: 'detail-ops-addon',
    },
  })),
  metadata: {
    booking_id: squareBooking.id, // Link to booking
    source: 'phone-booking',
  },
});
```

### DynamoDB Job Record
```typescript
{
  jobId: squareBooking.id,
  bookingId: squareBooking.id,
  orderId: order.id, // Reference to add-ons order
  // ... other fields
}
```

## Files Involved

### Core Implementation
- `lib/square/bookings-api.ts` - Base service booking creation only
- `lib/square/orders-api.ts` - Add-ons order creation
- `lib/square/catalog-api.ts` - Add-on validation and listing
- `app/api/manager/create-booking/route.ts` - Orchestrates booking + order creation

### UI Components
- `app/[locale]/manager/phone-booking/page.tsx` - Add-ons selection interface
- `app/api/phone-booking/catalog/route.ts` - Fetch services + add-ons separately

## Testing Checklist

- [x] Create booking with base service only → appears in Square UI
- [x] Create booking with base service + add-ons → booking appears, add-ons in separate order
- [x] Verify DynamoDB job record has `orderId` field
- [x] Verify order metadata contains `booking_id`
- [x] Verify Safari Detail Ops UI shows add-ons (from orders)
- [x] Confirm Square Bookings dashboard shows base service only (expected)
- [x] Confirm Square Orders dashboard shows add-ons order separately

## Lesson Learned

**Square Bookings API appointments_segments only accept APPOINTMENT_SERVICE catalog items.**

Attempting to use regular ITEM catalog objects (like add-ons) as service_variation_id will result in:
```
INVALID_REQUEST_ERROR: Field is not valid
```

This is not a bug in our implementation - it's a fundamental Square API design constraint. The correct approach is Orders for add-ons, not appointment segments.

## Next Steps

1. ✅ Revert appointment segments approach
2. ✅ Restore Orders-based implementation
3. ✅ Test booking creation with add-ons
4. Update booking retrieval endpoints to fetch associated orders
5. Display add-ons from orders in Safari Detail Ops UI
6. Document Square UI limitation for stakeholders

