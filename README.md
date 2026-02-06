# Safari Detail Ops

Job management and Square integration for Safari Car Wash detail operations.

## Project Overview

**Repository:** https://github.com/bluewavecarwashsystems-boop/Safari_Detail_Ops.git  
**Branch:** main  
**AWS Account:** Safari_Franklin (4025-6244-7563)

### Domains
- **QA:** ops-qa.thesafaricarwash.com
- **PROD:** ops.thesafaricarwash.com

### AWS Resource Namespace
All AWS resources follow the naming convention:
```
safari-detail-ops-<env>-<resource>
```

Where `<env>` is either `qa` or `prod`.

### Architecture
- **Frontend/Routing:** Vercel (DNS routing to subdomain)
- **Backend:** AWS (DynamoDB, S3)
- **Integration:** Square API (webhooks for bookings)

## Project Structure

```
Safari_Ops/
├── api/                        # Vercel serverless functions
│   ├── health.ts              # Health check endpoint
│   └── square/
│       └── webhooks/
│           └── bookings.ts    # Square booking webhooks
├── lib/                        # Shared utilities
│   ├── config.ts              # Environment configuration
│   └── types.ts               # TypeScript types
├── package.json
├── tsconfig.json
├── .env.example               # Environment variables template
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn
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

#### Square Booking Webhook (Stub)
```
POST /api/square/webhooks/bookings
```

Receives and acknowledges Square booking webhooks (booking.created, booking.updated).

**Phase A:** Logs and acknowledges webhooks only.  
**Phase B:** Will add signature verification.  
**Phase C:** Will create/update jobs in DynamoDB.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Webhook received and acknowledged",
    "eventId": "evt_123",
    "eventType": "booking.created",
    "processed": false
  },
  "timestamp": "2026-02-05T12:00:00.000Z"
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

### Phase A (Current) ✓
- [x] Project scaffolding
- [x] Environment configuration
- [x] Health check endpoint
- [x] Square webhook stub endpoint

### Phase B (Next)
- [ ] Square API integration
- [ ] Webhook signature verification
- [ ] Parse booking data

### Phase C
- [ ] DynamoDB integration
- [ ] Job creation from bookings
- [ ] Photo upload to S3

### Phase D
- [ ] Staff UI for job management
- [ ] Photo viewing/uploading
- [ ] Job status updates

## Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build TypeScript files
- `npm run type-check` - Check TypeScript types without emitting
- `npm run lint` - Lint code with ESLint

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
