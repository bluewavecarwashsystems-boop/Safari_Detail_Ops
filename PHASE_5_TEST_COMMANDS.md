# Phase 5: Manager Workflows - Test Commands

Quick reference for testing Phase 5 features: No-Show Management and Phone Booking Creation.

---

## 🚀 Prerequisites

```powershell
# Start development server
npm run dev

# Server should be running at http://localhost:3000
```

---

## 🧪 Test Scenarios

### 1. No-Show Management Tests

#### Test 1A: Mark Job as No-Show (Success)
```bash
# Setup: Get a job ID from Today Board in SCHEDULED status
# Method: Use browser UI

# Steps:
1. Login as MANAGER
2. Navigate to http://localhost:3000/en/jobs/{jobId}
3. Scroll to "No-show Management" section
4. Click "Mark as No-show"
5. Select reason: "Customer did not arrive"
6. Add notes: "Called 3 times, no response"
7. Click "Confirm No-show"

# Expected:
✅ Success toast: "Job marked as no-show"
✅ No-show section shows reason and notes
✅ "Resolve No-show" button appears
✅ "Open in Square" button appears

# Verify on Today Board:
Navigate to http://localhost:3000/en
✅ Job card shows orange "🚫 No-show" badge
✅ Job has orange border
```

#### Test 1B: Mark No-Show via API (Direct)
```powershell
# Get valid session cookie first (login via browser)
$sessionCookie = "safari_session=YOUR_SESSION_TOKEN"

# Mark as no-show
curl -X PATCH http://localhost:3000/api/jobs/{jobId} `
  -H "Content-Type: application/json" `
  -H "Cookie: $sessionCookie" `
  -d '{
    "noShow": {
      "status": "NO_SHOW",
      "reason": "NO_ARRIVAL",
      "notes": "Customer did not show up, called twice"
    }
  }'

# Expected Response:
# {
#   "job": {
#     "jobId": "...",
#     "noShow": {
#       "status": "NO_SHOW",
#       "reason": "NO_ARRIVAL",
#       "notes": "Customer did not show up, called twice",
#       "updatedAt": "2026-02-20T...",
#       "updatedBy": { "userId": "...", "name": "...", "role": "MANAGER" }
#     }
#   }
# }
```

#### Test 1C: Resolve No-Show
```bash
# Prerequisites: Job must be marked as NO_SHOW

# Steps:
1. Navigate to http://localhost:3000/en/jobs/{jobId}
2. Click "Resolve No-show"
3. Add notes: "Customer rescheduled and paid cancellation fee"
4. Click "Confirm Resolve"

# Expected:
✅ Success toast: "No-show status resolved"
✅ No-show section shows "Resolved" status
✅ Shows resolved timestamp and resolver name
✅ Badge removed from Today Board
```

#### Test 1D: Resolve via API
```powershell
curl -X PATCH http://localhost:3000/api/jobs/{jobId} `
  -H "Content-Type: application/json" `
  -H "Cookie: $sessionCookie" `
  -d '{
    "noShow": {
      "status": "RESOLVED",
      "notes": "Customer paid and rescheduled"
    }
  }'
```

#### Test 1E: Validation - Cannot Mark QC_READY
```powershell
# Get a job in QC_READY status
curl -X PATCH http://localhost:3000/api/jobs/{qcReadyJobId} `
  -H "Content-Type: application/json" `
  -H "Cookie: $sessionCookie" `
  -d '{"noShow": {"status": "NO_SHOW", "reason": "NO_ARRIVAL"}}'

# Expected Response (400 Bad Request):
# {
#   "error": "Cannot mark as no-show when job is in QC_READY or WORK_COMPLETED status"
# }
```

#### Test 1F: Validation - Reason Required
```powershell
# Try to mark without reason
curl -X PATCH http://localhost:3000/api/jobs/{jobId} `
  -H "Content-Type: application/json" `
  -H "Cookie: $sessionCookie" `
  -d '{"noShow": {"status": "NO_SHOW"}}'

# Expected Response (400 Bad Request):
# {
#   "error": "Reason is required when marking as no-show"
# }
```

#### Test 1G: Authorization - TECH Cannot Mark No-Show
```bash
# Login as TECH user
# Navigate to job detail page

# Expected:
✅ "No-show Management" section not visible
✅ No mark/resolve buttons available

# API Test:
curl -X PATCH http://localhost:3000/api/jobs/{jobId} `
  -H "Content-Type: application/json" `
  -H "Cookie: $techSessionCookie" `
  -d '{"noShow": {"status": "NO_SHOW", "reason": "NO_ARRIVAL"}}'

# Expected Response (403 Forbidden):
# {
#   "error": "Only managers can modify no-show status"
# }
```

#### Test 1H: Square Deep Link
```bash
# Prerequisites: Job must have bookingId

# Steps:
1. Mark job as no-show
2. Click "Open in Square" button

# Expected:
✅ Opens new tab with URL: https://squareup.com/dashboard/appointments/bookings/{bookingId}
✅ Shows Square dashboard with booking details
```

---

### 2. Phone Booking Creation Tests

#### Test 2A: Create Phone Booking (Success)
```bash
# Steps:
1. Login as MANAGER
2. Navigate to http://localhost:3000/en/manager/phone-booking
3. Fill form:
   Customer Name: Sarah Johnson
   Phone: 555-0123
   Email: sarah@example.com
   Vehicle Make: Toyota
   Vehicle Model: Camry
   Vehicle Year: 2021
   Vehicle Color: Blue
   Service: Full Detail
   Duration: 90 minutes
   Amount: 150
   Date: [Tomorrow]
   Time: 10:00 AM
   Notes: Customer called to book
4. Click "Create Booking"

# Expected:
✅ Success screen appears
✅ Shows "Booking Created Successfully"
✅ "View Job" button available
✅ "Create Another" button available

# Verify Job Created:
5. Click "View Job"
✅ Navigates to job detail page
✅ Customer name: Sarah Johnson
✅ Status: SCHEDULED
✅ All details populated correctly

# Verify Today Board:
6. Navigate to http://localhost:3000/en
✅ New job appears on board
✅ Shows in SCHEDULED column
```

#### Test 2B: Create Booking via API
```powershell
curl -X POST http://localhost:3000/api/manager/create-booking `
  -H "Content-Type: application/json" `
  -H "Cookie: $sessionCookie" `
  -d '{
    "customer": {
      "name": "John Smith",
      "phone": "555-0199",
      "email": "john@example.com"
    },
    "vehicle": {
      "make": "Honda",
      "model": "Accord",
      "year": 2020,
      "color": "Silver"
    },
    "service": {
      "type": "Full Detail",
      "durationMinutes": 90,
      "amount": 150
    },
    "appointment": {
      "date": "2026-02-21",
      "time": "14:00"
    },
    "notes": "Customer prefers afternoon appointments"
  }'

# Expected Response (200 OK):
# {
#   "jobId": "BK_...",
#   "bookingId": "...",
#   "job": {
#     "jobId": "BK_...",
#     "bookingId": "...",
#     "customerName": "John Smith",
#     "customerPhone": "555-0199",
#     "service": "Full Detail",
#     "status": "SCHEDULED",
#     ...
#   }
# }
```

#### Test 2C: Validation - Missing Required Fields
```bash
# Steps:
1. Navigate to phone booking page
2. Leave "Customer Name" empty
3. Click "Create Booking"

# Expected:
✅ Red border on "Customer Name" field
✅ Error message: "This field is required"
✅ Form does not submit
```

#### Test 2D: Validation - Invalid Phone Format
```powershell
curl -X POST http://localhost:3000/api/manager/create-booking `
  -H "Content-Type: application/json" `
  -H "Cookie: $sessionCookie" `
  -d '{
    "customer": {
      "name": "Test User",
      "phone": "abc",
      "email": "test@example.com"
    },
    "service": {
      "type": "Full Detail",
      "durationMinutes": 90
    },
    "appointment": {
      "date": "2026-02-21",
      "time": "10:00"
    }
  }'

# Expected Response (400 Bad Request):
# {
#   "error": "Invalid phone number format"
# }
```

#### Test 2E: Customer Already Exists (Idempotent)
```bash
# Steps:
1. Create booking for customer "555-0123"
2. Create another booking for same phone "555-0123"

# Expected:
✅ First booking creates new customer
✅ Second booking reuses existing customer
✅ Both bookings created successfully
✅ Both jobs appear on Today Board
```

#### Test 2F: Authorization - TECH Cannot Access Phone Booking
```bash
# Login as TECH user
# Navigate to http://localhost:3000/en/manager/phone-booking

# Expected:
✅ Redirected to http://localhost:3000/en (home page)
✅ Middleware blocks access

# API Test:
curl -X POST http://localhost:3000/api/manager/create-booking `
  -H "Content-Type: application/json" `
  -H "Cookie: $techSessionCookie" `
  -d '{...}'

# Expected Response (403 Forbidden):
# {
#   "error": "Manager access required"
# }
```

#### Test 2G: Double Submit Prevention
```bash
# Steps:
1. Navigate to phone booking page
2. Fill form completely
3. Click "Create Booking"
4. Immediately click "Create Booking" again (before success screen)

# Expected:
✅ Button disabled after first click
✅ Shows "Creating..." text
✅ Only one booking created
✅ No duplicate jobs
```

---

### 3. Integration Tests

#### Test 3A: No-Show Badge on Today Board
```bash
# Steps:
1. Create or find a job in SCHEDULED status
2. Mark as no-show
3. Navigate to Today Board

# Expected:
✅ Job shows "🚫 No-show" badge
✅ Job has orange border
✅ Badge appears in addition to any issue badges
```

#### Test 3B: Phone Booking Appears Immediately
```bash
# Steps:
1. Open Today Board in browser tab
2. In another tab, create phone booking
3. Wait 20 seconds (polling interval)

# Expected on Today Board:
✅ New job appears without manual refresh
✅ Job in SCHEDULED column
✅ All customer info visible on hover/click
```

#### Test 3C: No-Show + Photo Upload
```bash
# Steps:
1. Mark job as no-show
2. Go to photo upload section
3. Upload photos

# Expected:
✅ Photos upload successfully
✅ No-show status unaffected
✅ Both features work independently
```

#### Test 3D: Multi-Language Support
```bash
# Spanish:
http://localhost:3000/es/manager/phone-booking
✅ All labels in Spanish
✅ Form validation messages in Spanish

# Arabic:
http://localhost:3000/ar/manager/phone-booking
✅ All labels in Arabic
✅ RTL layout applied correctly
```

---

## 🔍 Debugging Commands

### Check Job No-Show Status
```powershell
# Query DynamoDB directly (requires AWS CLI configured)
aws dynamodb get-item `
  --table-name safari-jobs `
  --key '{"jobId": {"S": "YOUR_JOB_ID"}}' `
  --query 'Item.noShow'

# Expected output:
# {
#   "M": {
#     "status": {"S": "NO_SHOW"},
#     "reason": {"S": "NO_ARRIVAL"},
#     "notes": {"S": "..."},
#     "updatedAt": {"S": "..."},
#     "updatedBy": {"M": {...}}
#   }
# }
```

### Check StatusHistory for No-Show Events
```powershell
aws dynamodb get-item `
  --table-name safari-jobs `
  --key '{"jobId": {"S": "YOUR_JOB_ID"}}' `
  --query 'Item.statusHistory.L[*].M'

# Look for events:
# - event: NO_SHOW_MARKED
# - event: NO_SHOW_RESOLVED
```

### Verify Square Booking Created
```powershell
# Check Square Dashboard manually:
# https://squareup.com/dashboard/appointments/bookings

# Or use Square API (requires curl or Postman):
curl -X GET https://connect.squareup.com/v2/bookings/{bookingId} `
  -H "Authorization: Bearer YOUR_SQUARE_TOKEN" `
  -H "Content-Type: application/json"
```

### Check User Role
```powershell
aws dynamodb get-item `
  --table-name safari-users `
  --key '{"userId": {"S": "YOUR_USER_ID"}}' `
  --query 'Item.role.S'

# Should return: "MANAGER" or "TECH"
```

---

## 🎯 Coverage Checklist

### No-Show Management
- [ ] Mark job as no-show (UI)
- [ ] Mark job as no-show (API)
- [ ] Resolve no-show (UI)
- [ ] Resolve no-show (API)
- [ ] Badge appears on Today Board
- [ ] Validation: Cannot mark QC_READY
- [ ] Validation: Cannot mark WORK_COMPLETED
- [ ] Validation: Reason required
- [ ] Authorization: TECH blocked from marking
- [ ] Authorization: TECH blocked from API
- [ ] Square deep link works
- [ ] Audit trail created
- [ ] i18n: English labels
- [ ] i18n: Spanish labels
- [ ] i18n: Arabic labels + RTL

### Phone Booking
- [ ] Create booking (UI)
- [ ] Create booking (API)
- [ ] Success screen appears
- [ ] Job appears on Today Board immediately
- [ ] Validation: Required fields
- [ ] Validation: Phone format
- [ ] Customer found/created in Square
- [ ] Booking created in Square
- [ ] Job created in DynamoDB
- [ ] Authorization: TECH redirected
- [ ] Authorization: TECH blocked from API
- [ ] Double submit prevention
- [ ] "View Job" navigation works
- [ ] "Create Another" clears form
- [ ] i18n: All languages

---

## 📊 Performance Tests

### Load Test: Multiple Phone Bookings
```powershell
# Create 10 bookings in sequence
for ($i=1; $i -le 10; $i++) {
  curl -X POST http://localhost:3000/api/manager/create-booking `
    -H "Content-Type: application/json" `
    -H "Cookie: $sessionCookie" `
    -d "{
      \"customer\": {
        \"name\": \"Test User $i\",
        \"phone\": \"555-010$i\"
      },
      \"service\": {
        \"type\": \"Full Detail\",
        \"durationMinutes\": 90
      },
      \"appointment\": {
        \"date\": \"2026-02-21\",
        \"time\": \"$($i+8):00\"
      }
    }"
  
  Write-Host "Created booking $i"
  Start-Sleep -Seconds 2
}

# Expected:
✅ All 10 bookings created successfully
✅ All appear on Today Board
✅ No duplicate customers created (if same phone)
```

---

## 🚨 Error Scenarios

### Square API Down
```bash
# Simulate by using invalid Square token
# Or disconnect internet

# Expected:
❌ API returns 500 error
❌ User-friendly error message shown
❌ No partial data saved
```

### DynamoDB Write Failure
```bash
# Simulate by removing AWS credentials temporarily

# Expected:
❌ API returns 500 error
❌ Square booking may be created (cleanup required)
❌ Clear error message to user
```

### Session Expired
```bash
# Wait for session to expire (check JWT_SECRET timeout)
# Or manually delete cookie

# Attempt to mark no-show or create booking

# Expected:
❌ Redirected to login page
❌ 401 Unauthorized from API
```

---

## ✅ Sign-Off Criteria

All tests must pass before deploying to production:

- [ ] All no-show management tests pass
- [ ] All phone booking tests pass
- [ ] All authorization tests pass
- [ ] All validation tests pass
- [ ] All i18n tests pass
- [ ] Square integration working
- [ ] DynamoDB writes successful
- [ ] Today Board updates correctly
- [ ] Audit trail complete
- [ ] Error handling graceful

---

**Test Date**: _____________  
**Tester**: _____________  
**Environment**: _____________  
**Result**: PASS / FAIL

---

**Reference**: See [PHASE_5_IMPLEMENTATION_COMPLETE.md](PHASE_5_IMPLEMENTATION_COMPLETE.md) for full implementation details.
