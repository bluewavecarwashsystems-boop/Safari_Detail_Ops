# Square Business Booking Profile Check

This implementation checks whether your Square Sandbox seller account supports seller-level Bookings API write operations by calling the `RetrieveBusinessBookingProfile` endpoint.

## Key Information

**Endpoint**: `GET /v2/bookings/business-booking-profile`  
**Key Field**: `support_seller_level_writes` (boolean)

## Implementation Files

1. **API Route**: [app/api/square/booking-profile/route.ts](app/api/square/booking-profile/route.ts)
   - Next.js API endpoint
   - Returns JSON response with profile data

2. **Standalone Script**: [scripts/check-booking-profile.ts](scripts/check-booking-profile.ts)
   - CLI tool with formatted output
   - Better for manual testing and debugging

## Usage Methods

### Method 1: Standalone Script (Recommended for testing)

```bash
# Run the script
npm run check-booking-profile

# Or with ts-node directly
ts-node scripts/check-booking-profile.ts
```

**Output**: Formatted console output with the `support_seller_level_writes` value and full profile details.

### Method 2: API Route (For application integration)

Start your dev server:
```bash
npm run dev
```

Then access via HTTP:
```bash
# Using curl
curl http://localhost:3000/api/square/booking-profile

# Using PowerShell Invoke-RestMethod
Invoke-RestMethod -Uri "http://localhost:3000/api/square/booking-profile" -Method Get | ConvertTo-Json -Depth 10
```

**Response Format**:
```json
{
  "success": true,
  "support_seller_level_writes": true,
  "profile": { /* full profile object */ },
  "summary": {
    "seller_id": "...",
    "booking_enabled": true,
    "support_seller_level_writes": true,
    "booking_policy": "ACCEPT_ALL",
    "customer_timezone_choice": "BUSINESS_LOCATION_TIMEZONE"
  }
}
```

### Method 3: Direct API Call with curl

Test the Square API directly without running your application:

**For Sandbox:**
```bash
curl -X GET \
  https://connect.squareupsandbox.com/v2/bookings/business-booking-profile \
  -H "Authorization: Bearer YOUR_SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Square-Version: 2025-01-16"
```

**For Production:**
```bash
curl -X GET \
  https://connect.squareup.com/v2/bookings/business-booking-profile \
  -H "Authorization: Bearer YOUR_SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Square-Version: 2025-01-16"
```

**PowerShell equivalent:**
```powershell
$headers = @{
    "Authorization" = "Bearer $env:SQUARE_ACCESS_TOKEN"
    "Content-Type" = "application/json"
    "Square-Version" = "2025-01-16"
}

Invoke-RestMethod `
  -Uri "https://connect.squareupsandbox.com/v2/bookings/business-booking-profile" `
  -Method Get `
  -Headers $headers | ConvertTo-Json -Depth 10
```

## Environment Variables Required

Make sure your `.env` file has:

```bash
SQUARE_ACCESS_TOKEN=your_sandbox_access_token_here
SQUARE_ENVIRONMENT=sandbox
```

## Understanding the Response

### Key Field: `support_seller_level_writes`

- **`true`**: The seller account supports seller-level write operations. You can use APIs like:
  - `CreateBooking`
  - `UpdateBooking`
  - `CancelBooking`
  at the seller level without specifying a location.

- **`false`**: Seller-level writes are NOT supported. You must:
  - Use location-scoped booking endpoints
  - Complete Square Appointments onboarding
  - Check if your OAuth token has the correct scopes

## Common Error Scenarios

### 401 Unauthorized
- Invalid or expired access token
- Token is for wrong environment (sandbox vs production mismatch)
- Token doesn't have required OAuth scopes

### 403 Forbidden
- Token lacks `APPOINTMENTS_READ` permission
- Seller hasn't completed Square Appointments/Bookings onboarding
- Feature not available for this seller account type

### 404 Not Found
- Seller hasn't set up Square Appointments/Bookings yet
- Need to complete onboarding at: https://squareupsandbox.com/dashboard/appointments
- Bookings feature not activated

### 500/502/503 Server Errors
- Temporary Square API issue
- Retry after a short delay

## Next Steps

If `support_seller_level_writes = false`, you need to:

1. **Complete Square Appointments Onboarding**
   - Visit: https://squareupsandbox.com/dashboard/appointments
   - Set up at least one service
   - Configure business hours
   - Add team members

2. **Verify OAuth Scopes**
   - Your OAuth application must request `APPOINTMENTS_ALL_READ` and `APPOINTMENTS_ALL_WRITE`
   - Or at minimum: `APPOINTMENTS_READ` and `APPOINTMENTS_WRITE`

3. **Use Location-Scoped Endpoints** (Alternative)
   - If you can't enable seller-level writes, use location-specific endpoints
   - Example: `/v2/bookings?location_id=LOCATION_ID`

## References

- [Square Bookings API Documentation](https://developer.squareup.com/docs/bookings-api/what-it-does)
- [Retrieve Business Booking Profile Endpoint](https://developer.squareup.com/reference/square/bookings-api/retrieve-business-booking-profile)
- [Square API Versions](https://developer.squareup.com/docs/build-basics/api-versions)
