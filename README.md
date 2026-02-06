# Safari Detail Ops - Phase B Complete! 🎉

**Internal Operations PWA for Safari Detailing - Franklin Location**

Phase B delivers a fully functional V1 product with Square booking integration, DynamoDB job storage, and a touch-optimized frontend for staff phones and bay tablets.

---

## 🚀 Quick Start (Deployment)

### 1. Install Dependencies
```powershell
npm install
```

### 2. Set Environment Variables in Vercel
See `PHASE_B_DEPLOYMENT_GUIDE.md` for complete list of required variables.

### 3. Deploy
```powershell
git add .
git commit -m "Phase B: Full V1 implementation"
git push origin main
```

### 4. Create Square Webhook
Follow steps in `PHASE_B_DEPLOYMENT_GUIDE.md` to set up Square webhook subscription.

---

## 📁 Project Structure

```
safari-detail-ops/
├── api/                    # Vercel serverless functions (Backend API)
│   ├── health.ts          # Health check endpoint
│   ├── jobs/              # Jobs API endpoints
│   └── square/webhooks/   # Square webhook handlers
│       └── bookings.ts    # Booking webhook (Phase B complete)
│
├── app/                    # Next.js App Router (Frontend)
│   ├── layout.tsx         # Root layout with PWA metadata
│   ├── page.tsx           # Today Board (home page, kanban)
│   ├── globals.css        # Tailwind base styles + RTL support
│   └── jobs/[jobId]/      # Job Detail pages
│       └── page.tsx       # Job detail screen
│
├── lib/                    # Shared libraries
│   ├── types.ts           # TypeScript types (Phase B model)
│   ├── config.ts          # Environment configuration
│   ├── aws/               # AWS integrations (DynamoDB, S3)
│   ├── square/            # Square integrations (webhooks, parsing)
│   └── services/          # Business logic (job service)
│
├── public/                 # Static assets
│   ├── manifest.json      # PWA manifest
│   └── (icons TBD)        # Add icon-192.png, icon-512.png
│
├── docs/                   # Documentation
│   ├── AWS_SETUP.md       # AWS resource setup
│   └── AWS_RESOURCES_CREATED.md
│
├── PHASE_A_*.md           # Phase A documentation
├── PHASE_B_*.md           # Phase B documentation (← START HERE)
└── package.json           # Dependencies (Next.js, React, Tailwind)
```

---

## ✅ What's Implemented (Phase B)

### Backend (Complete)
- ✅ Square webhook handler with HMAC-SHA256 signature validation
- ✅ Booking event parsing (created, updated, canceled)
- ✅ Franklin location filtering
- ✅ DynamoDB job storage (idempotent creation/updates)
- ✅ S3 photo storage infrastructure
- ✅ Jobs API endpoints (list, get, update)
- ✅ Health check endpoint

### Frontend (MVP)
- ✅ Today Board kanban (5 status columns)
- ✅ Job Detail screen
- ✅ Responsive design
- ✅ Touch-friendly UI (44px buttons)
- ✅ PWA manifest

### Not Yet Implemented
- ⬜ Calendar view
- ⬜ Multilingual support (EN/ES/AR)
- ⬜ Authentication
- ⬜ No-show manager flow
- ⬜ Reconciliation service

---

## 📚 Documentation

### Start Here
1. **`PHASE_B_DEPLOYMENT_GUIDE.md`** - Quick deployment checklist
2. **`PHASE_B_IMPLEMENTATION.md`** - Technical details, API docs
3. **`PHASE_B_COMPLETE.md`** - Implementation summary

### AWS Setup
- `docs/AWS_SETUP.md` - DynamoDB & S3 setup
- `docs/AWS_RESOURCES_CREATED.md` - Resource inventory

---

## 🔧 Development

### Local Development
```powershell
npm install
npm run dev
# Open http://localhost:3000
```

### Type Checking
```powershell
npm run type-check
```

---

## 🌐 Environment Variables

See `PHASE_B_DEPLOYMENT_GUIDE.md` for complete list.

**Required:** APP_ENV, SQUARE_ENV, SQUARE_ACCESS_TOKEN, SQUARE_WEBHOOK_SIGNATURE_KEY, FRANKLIN_SQUARE_LOCATION_ID, AWS credentials, DynamoDB/S3 config

---

## 🧪 Testing

### Backend
```powershell
curl https://ops-qa.thesafaricarwash.com/api/health -UseBasicParsing
```

### Frontend
Open `https://ops-qa.thesafaricarwash.com/`

---

**Deploy now:** `npm install && git push origin main`

**Test at:** https://ops-qa.thesafaricarwash.com/
- Vercel CLI (for local development)
- AWS credentials configured

### Installation

1. Clone the repository:
```bash
git clone https://github.com/bluewavecarwashsystems-boop/Safari_Detail_Ops.git
cd Safari_Ops
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `APP_ENV=qa` (or `prod`)
- AWS credentials (injected via secure store in production)
- Square credentials (Phase B)

4. Run local development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Phase A (Current - Scaffolding)

#### Health Check
```
GET /api/health
```

Returns application health status and environment information.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "environment": "qa",
    "version": "1.0.0",
    "timestamp": "2026-02-05T12:00:00.000Z",
    "services": {
      "api": {
        "status": "up",
        "message": "API is operational"
      }
    }
  },
  "timestamp": "2026-02-05T12:00:00.000Z"
}
```

#### Square Booking Webhook
```
POST /api/square/webhooks/bookings
```

Receives and processes Square booking webhooks (booking.created, booking.updated).

**Phase B Complete:**
- ✓ Signature verification using Square webhook signature key
- ✓ Booking event parsing and validation
- ✓ Extracts customer and appointment information
- ✓ Determines action (create/update job)

**Phase C Complete:**
- ✓ Creates or updates jobs in DynamoDB
- ✓ Handles both booking.created and booking.updated events
- ✓ Links Square bookings to job records

**Request Headers:**
- `x-square-hmacsha256-signature`: Webhook signature from Square

**Request Body:** Square booking webhook event (JSON)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Webhook processed successfully",
    "eventId": "evt_123",
    "eventType": "booking.created",
    "action": "create",
    "bookingId": "booking_123",
    "processed": true
  },
  "timestamp": "2026-02-05T12:00:00.000Z"
}
```

**Test locally:**
```bash
npm run test:webhook
```

### Phase C - Job Management APIs

#### List Jobs
```
GET /api/jobs?status=pending&limit=50
```

Query Parameters:
- `status` (optional): Filter by job status (pending, in_progress, completed, cancelled)
- `customerId` (optional): Filter by customer ID
- `limit` (optional): Number of results (default: 50)
- `nextToken` (optional): Pagination token

#### Get Job
```
GET /api/jobs/[jobId]
```

Returns job details with pre-signed photo URLs.

#### Update Job
```
PATCH /api/jobs/[jobId]/update
```

Update job status, vehicle info, or other fields.

**Request Body:**
```json
{
  "status": "in_progress",
  "vehicleInfo": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2022,
    "color": "Blue"
  },
  "updatedBy": "staff-name"
}
```

#### Generate Photo Upload URL
```
POST /api/jobs/[jobId]/photos
```

Generates pre-signed S3 URL for direct photo upload.

**Request Body:**
```json
{
  "filename": "car-front.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "photoKey": "jobs/{jobId}/photos/...",
    "expiresIn": 3600
  }
}
```

## Environment Configuration

The application uses `APP_ENV` to determine which AWS resources to use:

- **QA Environment:**
  - DynamoDB: `safari-detail-ops-qa-jobs`
  - S3: `safari-detail-ops-qa-photos`
  - Logs: `safari-detail-ops-qa-logs`

- **PROD Environment:**
  - DynamoDB: `safari-detail-ops-prod-jobs`
  - S3: `safari-detail-ops-prod-photos`
  - Logs: `safari-detail-ops-prod-logs`

## AWS Resources

### DynamoDB Tables
- **Jobs Table:** `safari-detail-ops-<env>-jobs`
  - Stores job records linked to Square bookings
  - Schema defined in `lib/types.ts` (Job interface)

### S3 Buckets
- **Photos Bucket:** `safari-detail-ops-<env>-photos`
  - Stores job-related photos
  - Organized by job ID

### CloudWatch Logs
- **Log Group:** `safari-detail-ops-<env>-logs`
  - QA: 7-14 day retention
  - PROD: 30-90 day retention

## Security & Isolation

This project is isolated within a shared AWS account:

1. **Namespace Isolation:** All resources prefixed with `safari-detail-ops-<env>-`
2. **Environment Separation:** QA and PROD use completely separate resources
3. **IAM Boundaries:** Limited to project-specific resources only
4. **No Shared Resources:** No cross-project or cross-environment access

## Development Phases

### Phase A (Complete) ✓
- [x] Project scaffolding
- [x] Environment configuration
- [x] Health check endpoint
- [x] Square webhook stub endpoint

### Phase B (Complete) ✓
- [x] Square SDK integration
- [x] Webhook signature verification
- [x] Parse booking data from webhooks
- [x] Booking validation and action determination

### Phase C (Complete) ✓
- [x] AWS SDK integration (DynamoDB, S3)
- [x] DynamoDB service layer with full CRUD operations
- [x] S3 service layer for photo storage
- [x] Job service combining DynamoDB and S3
- [x] Webhook endpoint creates/updates jobs in DynamoDB
- [x] Job management API endpoints
- [x] Photo upload with pre-signed URLs
- [x] AWS resource setup documentation

### Phase D (Next)
- [ ] Staff UI for job management
- [ ] Photo viewing/uploading interface
- [ ] Job status updates UI
- [ ] Real-time notifications

## Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build TypeScript files
- `npm run type-check` - Check TypeScript types without emitting
- `npm run lint` - Lint code with ESLint
- `npm run test:webhook` - Test Square webhook processing (Phase B)

## Deployment

### Prerequisites
1. Vercel project configured for this repository
2. Environment variables set in Vercel dashboard
3. DNS configured to route subdomain to Vercel

### Deploy to QA
```bash
vercel --prod
```

Ensure Vercel environment variables are set for QA environment.

### Deploy to PROD
Deploy only after QA verification and explicit approval.

## Support

For issues or questions, contact the Safari Detail Ops team.
