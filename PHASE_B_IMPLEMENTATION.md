# Phase B Implementation - Full V1 Product

**Status:** ✅ Backend Complete | 🚧 Frontend In Progress  
**Date:** February 5, 2026  
**Project:** Safari Detail Ops - Franklin Location

---

## What Was Implemented in Phase B

Phase B restores full Square integration with webhook signature validation, DynamoDB job storage, and prepares the API backend for the frontend PWA.

### Backend (API) - Phase B Complete ✅

#### 1. Type System Updated
**File:** `/lib/types.ts`
- Added `WorkStatus` enum: SCHEDULED, CHECKED_IN, IN_PROGRESS, QC_READY, WORK_COMPLETED, NO_SHOW states
- Added `PaymentStatus` enum: UNPAID, PAID (separate from work status)
- Added `UserRole` enum: TECH, QC, MANAGER (for authorization)
- Added `BookingSource` enum: SQUARE_ONLINE, PHONE
- Added `JobV2` interface with full Phase B model:
  - Work status tracking
  - Check-in photos (required before work starts)
  - Checklist with completion tracking
  - Timer with pause/resume support
  - QC workflow
  - Payment tracking (separate from work completion)
  - No-show handling
  - Customer notification tracking

#### 2. Webhook Handler Restored
**File:** `/api/square/webhooks/bookings.ts`
- ✅ Signature validation (HMAC-SHA256)
- ✅ Booking event parsing (created, updated, canceled)
- ✅ Franklin location filtering
- ✅ Idempotent job creation/updates
- ✅ DynamoDB integration
- ✅ Error handling with retry (returns 500 for Square to retry)
- ✅ Production requirements (signature required in prod)

#### 3. Square Integration Libraries
**Files:** 
- `/lib/square/webhook-validator.ts` - Signature validation
- `/lib/square/booking-parser.ts` - Event parsing

#### 4. Data Layer
**Files:**
- `/lib/aws/dynamodb.ts` - DynamoDB operations (create, get, update, list jobs)
- `/lib/aws/s3.ts` - S3 photo storage with presigned URLs
- `/lib/services/job-service.ts` - High-level job operations

#### 5. Existing API Endpoints
- `GET /api/health` - Health check
- `POST /api/square/webhooks/bookings` - Square webhook receiver
- `GET /api/jobs` - List jobs (with filters)
- `GET /api/jobs/[jobId]` - Get single job with photo URLs
- `POST /api/jobs/[jobId]/update` - Update job fields
- `POST /api/jobs/[jobId]/photos` - Upload photos (via presigned URL)

---

## Environment Variables for Phase B

### Required for Phase B Backend

```bash
# Application environment
APP_ENV=qa
SQUARE_ENV=sandbox

# Square Configuration (REQUIRED for Phase B)
SQUARE_ACCESS_TOKEN=<sandbox-access-token>
SQUARE_WEBHOOK_SIGNATURE_KEY=<sandbox-webhook-key>
FRANKLIN_SQUARE_LOCATION_ID=<sandbox-location-id>

# AWS Configuration (REQUIRED for Phase B)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret>

# DynamoDB Tables (auto-namespaced: safari-detail-ops-qa-*)
DYNAMODB_JOBS_TABLE=jobs

# S3 Buckets (auto-namespaced: safari-detail-ops-qa-*)
S3_PHOTOS_BUCKET=photos

# Optional
LOG_LEVEL=info
```

### How to Get Square Credentials

1. **Square Developer Dashboard:** https://developer.squareup.com/console
2. Go to your application (or create new one  for sandbox)
3. Get **Access Token** from "Credentials" tab (use Sandbox token for QA)
4. Get **Location ID** from Square Dashboard → Locations (Franklin)
5. **Webhook Signature Key**: Create webhook subscription, get key from subscription details

---

## AWS Resources Required

Phase B requires DynamoDB and S3 resources. These should already exist if you followed AWS setup docs.

### DynamoDB Table: `safari-detail-ops-qa-jobs`

**Primary Key:**
- `jobId` (String, partition key)

**Global Secondary Indexes (GSIs):**
1. **bookingId-index** (for webhook idempotency)
   - Partition Key: `squareBookingId` (String)
   
2. **plateNorm-index** (for vehicle search)
   - Partition Key: `plateNorm` (String)
   
3. **workStatus-scheduledStart-index** (for Today Board queries)
   - Partition Key: `workStatus` (String)
   - Sort Key: `scheduledStart` (String)

### S3 Bucket: `safari-detail-ops-qa-photos`

**Configuration:**
- Private bucket (no public access)
- Presigned URLs for uploads/downloads (1-hour expiry)
- Lifecycle policy: retain indefinitely (or set retention as needed)

**Bucket policy allows:**
- PutObject (for photo uploads)
- GetObject (for photo downloads via presigned URLs)
- DeleteObject (for photo removal)

---

## Testing Phase B Backend

### 1. Health Check
```powershell
curl https://ops-qa.thesafaricarwash.com/api/health -UseBasicParsing
```

**Expected:**
```json
{
  "app_env": "qa",
  "square_env": "sandbox",
  "franklin_location_id": "L...",
  "timestamp": "...",
  "build": "..."
}
```

### 2. Square Webhook Subscription

Create webhook subscription in Square Developer Dashboard:
- **URL:** `https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings`
- **Events:**
  - `booking.created`
  - `booking.updated`
  - `booking.canceled`
- **API Version:** 2024-10-17 (or latest)

Square will validate the URL (should return 200).

### 3. Test Webhook Flow

**Create a test booking in Square Sandbox:**
1. Use Square Appointments API or Dashboard
2. Create booking for Franklin location
3. Check Vercel logs for webhook receipt
4. Verify job created in DynamoDB

**Check Vercel logs:**
- Look for `[WEBHOOK SIGNATURE VALID]`
- Look for `[JOB CREATED]` or `[JOB UPDATED]`
- Verify no errors

### 4. Test Jobs API

```powershell
# List all jobs
curl https://ops-qa.thesafaricarwash.com/api/jobs -UseBasicParsing

# Get specific job
curl https://ops-qa.thesafaricarwash.com/api/jobs/<jobId> -UseBasicParsing
```

---

## Frontend Implementation (Next Step)

Phase B backend is complete. Next, implement the PWA frontend:

### Required Screens

1. **Today Board** (`/`)
   - Kanban columns: Scheduled | Checked In | In Progress | QC Ready | Work Done
   - Card displays: customer name, vehicle, service, time
   - Drag-drop (future enhancement)
   - Real-time updates (polling every 30s or WebSocket)

2. **Calendar View** (`/calendar`)
   - Day view (default, for TECH/QC)
   - Week view (MANAGER only)
   - Read-only
   - Tap card → opens Job Detail

3. **Job Detail** (`/jobs/[jobId]`)
   - Customer & vehicle info
   - Service details
   - Status actions (Check In, Start Work, Request QC, Complete)
   - Photo upload (check-in photos + additional)
   - Checklist with checkboxes
   - Timer display (elapsed time)
   - Payment section (MANAGER: mark paid)
   - No-show section (MANAGER only)

4. **Settings** (`/settings`)
   - Language toggle (EN / ES / AR)
   - User role display
   - Logout

### Technology Stack (Recommended)

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS (for rapid development & RTL support)
- **State:** React Query (for data fetching/caching)
- **i18n:** next-intl or react-i18next
- **Icons:** Heroicons or Lucide React
- **PWA:** next-pwa plugin

### Multilingual Support (EN / ES / AR)

- Icon-first design (minimize text)
- Short strings with translation files
- RTL layout support for Arabic
- Large touch targets (44x44px minimum)

---

## Deployment Steps for Phase B

### 1. Set Environment Variables in Vercel

```bash
# In Vercel Dashboard → Settings → Environment Variables
# Set for BOTH "Production" and "Preview" (or just Production)

APP_ENV=qa
SQUARE_ENV=sandbox
SQUARE_ACCESS_TOKEN=<from-square-dashboard>
SQUARE_WEBHOOK_SIGNATURE_KEY=<from-square-webhook>
FRANKLIN_SQUARE_LOCATION_ID=<from-square-dashboard>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from-aws>
AWS_SECRET_ACCESS_KEY=<from-aws>
DYNAMODB_JOBS_TABLE=jobs
S3_PHOTOS_BUCKET=photos
```

### 2. Deploy to Vercel

```powershell
# Commit Phase B changes
git add .
git commit -m "Phase B: Full Square integration + backend API"
git push origin main

# Vercel will auto-deploy
```

### 3. Verify Deployment

- Check Vercel deployment logs
- Test health endpoint
- Create test booking in Square
- Verify webhook received and job created
- Check DynamoDB for job record
- Test jobs API endpoints

---

## Next Steps After Phase B Backend

1. ✅ Phase B Backend complete
2. 🚧 Build frontend screens (Today Board, Calendar, Job Detail)
3. 🚧 Implement multilingual support
4. 🚧 Add PWA manifest and service worker
5. 🚧 Implement role-based authorization
6. 🚧 Add reconciliation polling (ListBookings every 5-15 min)
7. 🚧 Implement no-show flow with Square deep links
8. 🚧 Add manager phone booking creation

---

## Phase B Success Criteria

### Backend ✅
- [x] Types updated with Phase B model
- [x] Webhook handler with signature validation
- [x] DynamoDB integration
- [x] Square event parsing
- [x] Franklin location filtering
- [x] Idempotent job creation
- [x] API endpoints functional

### Still Needed 🚧
- [ ] Frontend Today Board
- [ ] Frontend Calendar view
- [ ] Frontend Job Detail screen
- [ ] Multilingual support (EN/ES/AR)
- [ ] PWA configuration
- [ ] Role-based auth
- [ ] Reconciliation service
- [ ] No-show manager flow
- [ ] Manager phone booking creation

---

## Troubleshooting

### Webhook signature validation fails
- Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` matches Square dashboard
- Check webhook URL exactly matches (including https://)
- Verify request body is read as raw string (not parsed)

### Jobs not appearing in DynamoDB
- Check Vercel logs for errors
- Verify AWS credentials have DynamoDB PutItem permission
- Check table name matches: `safari-detail-ops-qa-jobs`

### Photos not uploading
- Verify S3 bucket exists: `safari-detail-ops-qa-photos`
- Check AWS credentials have S3 PutObject permission
- Verify presigned URL generation is successful

---

**Phase B Backend is production-ready! 🚀**

Next: Build the PWA frontend to consume theseAPIs and provide the staff interface for Safari Detailing operations.
