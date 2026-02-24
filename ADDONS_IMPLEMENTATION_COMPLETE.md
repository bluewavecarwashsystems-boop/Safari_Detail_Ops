# Square Bookings + Orders Add-ons Integration - Implementation Complete

## Summary

Successfully implemented Option B: Add-ons are stored as Square Order line items and linked to bookings via `order_id`.

## Architecture

### Data Model
- **Base Services**: Square Booking Services (one required per booking)
- **Add-ons**: Square Item Variations from reporting category "Add-on's" (0..N optional)
- **Orders**: Square Orders containing add-on line items, linked to bookings
- **Location**: All operations restricted to `L9ZMZD9TTTTZJ` (server-side enforced)

### Key Design Decisions
1. Add-ons are **NOT** appointment segments (keeps booking simple with one service)
2. Square Order is the source of truth for add-ons
3. Internal DB stores `orderId` for redundancy/quick lookup
4. If add-ons array is empty, no order is created
5. Server-side validation on all add-on operations

## Files Created

### 1. Square Orders API Client
**File**: `lib/square/orders-api.ts`

New functionality:
- `createOrder()` - Create new Square Order
- `retrieveOrder()` - Fetch order by ID
- `updateOrder()` - Update existing order with new line items
- `isAddonLineItem()` - Check if line item is an add-on (via metadata)
- `extractAddonLineItems()` - Extract only add-on items from order
- `extractNonAddonLineItems()` - Extract non-add-on items (deposits, fees, etc.)

Line item metadata marking:
```typescript
{
  metadata: {
    source: 'detail-ops-addon'
  }
}
```

### 2. Catalog API Extensions
**File**: `lib/square/catalog-api.ts` (extended)

New exports:
- `CatalogAddon` interface
- `listAddons()` - Fetch add-ons from "Add-on's" category at location L9ZMZD9TTTTZJ
- `validateAddonVariation()` - Server-side validation for add-on IDs

Add-on fetching logic:
1. Fetch all categories, find "Add-on's" category ID
2. Fetch all items, filter by category and location
3. Extract variations, enforce location presence
4. Sort by price descending

### 3. Phone Booking Catalog Endpoint
**File**: `app/api/phone-booking/catalog/route.ts`

- **Method**: GET
- **Path**: `/api/phone-booking/catalog`
- **Returns**: 
  ```json
  {
    "success": true,
    "data": {
      "services": [...],  // Square Booking Services
      "addons": [...]     // Square Item Variations (Add-ons)
    }
  }
  ```

### 4. Booking Retrieval Endpoint
**File**: `app/api/bookings/[id]/route.ts`

- **Method**: GET
- **Path**: `/api/bookings/{bookingId}`
- **Returns**: Booking + add-ons (extracted from linked order)
- **Logic**:
  1. Fetch booking from Square
  2. Get job from DynamoDB to find `orderId`
  3. If `orderId` exists, fetch order and extract add-on line items
  4. Fetch catalog details for each add-on for display names

### 5. Add-ons Update Endpoint
**File**: `app/api/bookings/[id]/addons/route.ts`

- **Method**: PATCH
- **Path**: `/api/bookings/{bookingId}/addons`
- **Body**: `{ addonItemVariationIds: string[] }`
- **Logic**:
  - **Case 1**: Job has existing order → Update order, preserve non-add-on line items
  - **Case 2**: No existing order + add-ons requested → Create new order, link to job
  - **Case 3**: No add-ons requested → No action (or remove add-ons if order exists)
- **Validation**: All add-on IDs validated server-side before order operations

## Files Modified

### 6. Create Booking Endpoint (Updated)
**File**: `app/api/manager/create-booking/route.ts`

**New imports**:
- `validateAddonVariation` from catalog-api
- `createOrder` from orders-api
- `OrderLineItem` type

**New flow** (Step 3.5):
1. Validate all `addonItemVariationIds` server-side
2. If validation fails → return 400 error
3. Create order with add-on line items
4. Link `orderId` to booking in metadata
5. Store `orderId` in job record (Step 4 updated)
6. If order creation fails → log warning but continue (booking is still valid)

**Request body updated**:
```typescript
{
  ...existing fields,
  addonItemVariationIds?: string[]
}
```

**Response updated**:
```typescript
{
  jobId: string,
  bookingId: string,
  orderId?: string,  // NEW
  job: Job
}
```

### 7. TypeScript Types (Updated)
**File**: `lib/types.ts`

**Modified interfaces**:

```typescript
// CreateManagerBookingRequest - new field
{
  ...existing,
  addonItemVariationIds?: string[]
}

// CreateManagerBookingResponse - new field
{
  ...existing,
  orderId?: string
}

// Job - new field
{
  ...existing,
  orderId?: string  // Square Order ID (for add-ons)
}
```

### 8. Phone Booking UI (Completely Refactored)
**File**: `app/[locale]/manager/phone-booking/page.tsx`

**New state**:
```typescript
const [addons, setAddons] = useState<Addon[]>([]);
const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
const [loadingCatalog, setLoadingCatalog] = useState(true);
```

**New functions**:
- `handleAddonToggle()` - Toggle add-on selection
- `calculateTotalPrice()` - Base service + add-ons total

**API change**:
- Changed from `/api/square/services` to `/api/phone-booking/catalog`
- Fetches both services and add-ons in one request

**UI additions**:

1. **Add-ons Selection Section**:
   - Grid of checkboxes for each add-on
   - Shows add-on name and price
   - Visual feedback for selected add-ons (blue border/background)
   - Only displayed if add-ons are available

2. **Price Summary Section**:
   - Base service price
   - Add-ons subtotal (count + price)
   - Estimated total (styled in Safari Orange)
   - Real-time price calculation

3. **Request body includes**:
   ```typescript
   {
     ...existing,
     addonItemVariationIds: Array.from(selectedAddonIds)
   }
   ```

## Validation & Security

### Server-Side Validation (Enforced)
All add-on operations validate:
1. **Category check**: Must be from "Add-on's" reporting category
2. **Location check**: Must be present at location L9ZMZD9TTTTZJ
3. **Type check**: Must be ITEM_VARIATION (not booking service)
4. **Rejection**: Any invalid ID causes 400 error with details

Validation points:
- ✅ POST `/api/manager/create-booking` (before order creation)
- ✅ PATCH `/api/bookings/[id]/addons` (before order update)
- ✅ Uses `validateAddonVariation()` helper

### Location Enforcement
- All catalog queries filter by `present_at_location_ids.includes('L9ZMZD9TTTTZJ')`
- All orders created with `location_id: 'L9ZMZD9TTTTZJ'`
- Consistent with existing phone booking service filtering

### Defensive Programming
- Order creation failures don't fail the entire booking
- Missing orders return empty add-ons list (not 404)
- Non-add-on line items preserved during order updates

## Logging

Comprehensive logging at all levels:

**Catalog API**:
- `[SQUARE CATALOG API] Fetching add-ons` - Start of fetch
- `[SQUARE CATALOG API] Found Add-ons category` - Category ID found
- `[SQUARE CATALOG API] Add-ons fetched` - Success with count
- `[SQUARE CATALOG API] Addon validation` - Validation result

**Orders API**:
- `[SQUARE ORDERS API] Creating order` - Order creation start
- `[SQUARE ORDERS API] Order created` - Success with order ID
- `[SQUARE ORDERS API] Updating order` - Order update start
- `[SQUARE ORDERS API] Order updated` - Success with new version

**Booking Creation**:
- `[MANAGER BOOKING] Validating add-ons` - Addon validation start
- `[MANAGER BOOKING] SECURITY: Invalid add-on variation IDs` - Validation failure
- `[MANAGER BOOKING] Creating Square order` - Order creation start
- `[MANAGER BOOKING] Square order created` - Success with order ID
- `[MANAGER BOOKING] Job created in DynamoDB` - Includes addon count

**Booking Retrieval**:
- `[GET BOOKING] Fetching booking` - Start
- `[GET BOOKING] Fetching order for add-ons` - Order fetch start
- `[GET BOOKING] Found add-on line items` - Count of add-ons

**Add-ons Update**:
- `[UPDATE ADDONS] Starting update` - Update start with addon count
- `[UPDATE ADDONS] Validating add-ons` - Validation start
- `[UPDATE ADDONS] SECURITY: Invalid add-on variation IDs` - Validation failure
- `[UPDATE ADDONS] Updating existing order` - Existing order path
- `[UPDATE ADDONS] Creating new order` - New order path

## Testing Checklist

### ✅ New Phone Booking with Add-ons
1. Open Phone Booking page
2. See add-ons section with checkboxes
3. Select service + 2 add-ons
4. See price summary update in real-time
5. Submit booking
6. Verify booking created in Square
7. Verify order created with 2 line items
8. Verify job has `orderId` field
9. Check logs for successful order creation

### ✅ New Phone Booking without Add-ons
1. Open Phone Booking page
2. Select service only, no add-ons
3. Submit booking
4. Verify booking created
5. Verify NO order created
6. Verify job has NO `orderId` field

### ✅ Edit Existing Booking - Add Add-ons
1. Fetch existing booking (GET `/api/bookings/{id}`)
2. Call PATCH `/api/bookings/{id}/addons` with add-on IDs
3. Verify new order created
4. Verify job updated with `orderId`
5. GET booking again, verify add-ons returned

### ✅ Edit Existing Booking - Remove Add-ons
1. Fetch booking with existing add-ons
2. Call PATCH with empty array `addonItemVariationIds: []`
3. Verify order updated with no add-on line items
4. GET booking again, verify empty add-ons list

### ✅ Server-Side Validation
1. Try to create booking with invalid add-on ID (service ID instead)
2. Should return 400 error: "Invalid add-on variation IDs"
3. Check logs for SECURITY warning
4. Try with add-on from different location → same validation failure

### ✅ UI Behavior
1. Check add-ons load on page mount
2. Toggle add-ons on/off, see visual feedback
3. See price summary update when selections change
4. Submit and reset, verify add-ons deselected
5. "Create Another" button clears selections

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/phone-booking/catalog` | Fetch services + add-ons for phone booking |
| POST | `/api/manager/create-booking` | Create booking + order (if add-ons) |
| GET | `/api/bookings/{id}` | Fetch booking with add-ons |
| PATCH | `/api/bookings/{id}/addons` | Update add-ons for existing booking |

## Data Flow

### Create Booking with Add-ons
```
User selects service + add-ons
  ↓
POST /api/manager/create-booking
  → Validate service (existing logic)
  → Validate add-ons server-side ✓
  → Create Square Booking
  → Create Square Order with add-on line items ✓
  → Link order to booking via metadata
  → Create Job in DynamoDB with orderId ✓
  ↓
Return: { jobId, bookingId, orderId }
```

### Load Booking with Add-ons
```
GET /api/bookings/{id}
  → Fetch Square Booking
  → Get Job from DynamoDB (has orderId)
  → Fetch Square Order ✓
  → Extract add-on line items (via metadata) ✓
  → Fetch catalog details for names/prices ✓
  ↓
Return: { booking, addons[], job }
```

### Update Add-ons
```
PATCH /api/bookings/{id}/addons
  → Validate all add-on IDs server-side ✓
  → Get existing order (if exists)
  → Preserve non-add-on line items ✓
  → Rebuild add-on line items ✓
  → Update order in Square ✓
  → Update job in DynamoDB ✓
  ↓
Return: { bookingId, orderId, addons[] }
```

## Production Deployment Notes

1. **Verify Square Catalog**:
   - Ensure "Add-on's" category exists in Square Dashboard
   - Assign add-on items to location L9ZMZD9TTTTZJ
   - Verify add-on items have correct reporting category

2. **Environment Variables**:
   - `FRANKLIN_SQUARE_LOCATION_ID=L9ZMZD9TTTTZJ` (already set)
   - Verify production Square token has Orders scope

3. **Testing in Production**:
   - Test catalog endpoint: `GET /api/phone-booking/catalog`
   - Verify services and add-ons returned
   - Create test booking with add-on
   - Verify in Square Dashboard: Booking + Order created

4. **Monitoring**:
   - Watch logs for `[SQUARE ORDERS API]` entries
   - Look for `SECURITY: Invalid add-on variation IDs` warnings
   - Check `orderId` field populated in job records

## Rollback Plan

If issues arise:
1. Add-ons are optional, core booking flow unchanged
2. If order creation fails, booking still succeeds (logged as warning)
3. To disable add-ons: hide UI section (no backend changes needed)
4. Existing jobs without `orderId` continue to work normally

## Future Enhancements (Not Implemented)

1. **Quantity support**: Currently hardcoded to "1", could allow quantity selection
2. **Add-on categories**: Group add-ons by sub-category in UI
3. **Pricing logic**: Apply discounts or packages (Prime membership)
4. **Order status sync**: Track order payment status
5. **Booking segments for add-ons**: If needed, could migrate to appointment segments

## Code Quality

- ✅ Full TypeScript type safety
- ✅ Comprehensive error handling
- ✅ Server-side validation on all operations
- ✅ Defensive programming (graceful degradation)
- ✅ Extensive logging for debugging
- ✅ Idempotent order operations
- ✅ Consistent naming conventions
- ✅ No breaking changes to existing features

## Confirmation

All requirements met:
- ✅ Base services and add-ons fetched separately
- ✅ UI shows separate dropdowns (service dropdown + add-on checkboxes)
- ✅ Add-ons stored as Order line items
- ✅ Order linked to booking via `orderId`
- ✅ Server-side validation enforced
- ✅ Location L9ZMZD9TTTTZJ enforced everywhere
- ✅ Existing bookings can add/remove add-ons
- ✅ Empty add-ons array = no order created
- ✅ Non-add-on line items preserved during updates
- ✅ Comprehensive logging throughout

**Status**: ✅ **COMPLETE - READY FOR TESTING**
