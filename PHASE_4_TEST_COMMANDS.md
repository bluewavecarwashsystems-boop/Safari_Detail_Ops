# Phase 4: Test Commands

Quick reference for testing polling and reconciliation features.

---

## Manual Reconciliation Testing

### Local Development

```bash
# Test with valid token (set CRON_SECRET in .env first)
curl "http://localhost:3000/api/cron/reconcile?token=YOUR_CRON_SECRET_HERE"

# Test with invalid token (should return 401)
curl "http://localhost:3000/api/cron/reconcile?token=invalid"

# Pretty print JSON response
curl -s "http://localhost:3000/api/cron/reconcile?token=YOUR_CRON_SECRET_HERE" | jq '.'
```

### Production (Vercel)

```bash
# Test production reconciliation
curl "https://your-app.vercel.app/api/cron/reconcile?token=YOUR_CRON_SECRET_HERE"

# Pretty print
curl -s "https://your-app.vercel.app/api/cron/reconcile?token=YOUR_CRON_SECRET_HERE" | jq '.'
```

---

## Expected Responses

### Success (200)

```json
{
  "success": true,
  "data": {
    "scanned": 15,
    "created": 2,
    "updated": 5,
    "cancelled": 1,
    "skipped": 7,
    "errors": [],
    "startTime": "2026-02-20T10:00:00.000Z",
    "endTime": "2026-02-20T10:00:03.250Z",
    "durationMs": 3250,
    "totalDurationMs": 3250
  },
  "timestamp": "2026-02-20T10:00:03.250Z"
}
```

### Unauthorized (401)

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### Server Error (500)

```json
{
  "success": false,
  "error": {
    "code": "RECONCILIATION_ERROR",
    "message": "Failed to reconcile bookings",
    "details": "..."
  },
  "timestamp": "2026-02-20T10:00:03.250Z"
}
```

---

## Testing Square Bookings API

### List Bookings (Today)

```bash
# Using curl with Square API directly
curl -X GET "https://connect.squareupsandbox.com/v2/bookings?start_at_min=2026-02-20T00:00:00Z&start_at_max=2026-02-20T23:59:59Z" \
  -H "Authorization: Bearer YOUR_SQUARE_ACCESS_TOKEN" \
  -H "Square-Version: 2024-01-18" \
  -H "Content-Type: application/json"
```

---

## Vercel  CLI Commands

### Deploy with Vercel CLI

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

### View Cron Logs

```bash
# View recent logs (includes cron execution)
vercel logs --follow

# Filter for reconciliation logs
vercel logs | grep reconcile
```

### Set Environment Variables

```bash
# Set CRON_SECRET for production
vercel env add CRON_SECRET production

# Set for preview
vercel env add CRON_SECRET preview

# Set for development (local)
vercel env add CRON_SECRET development
```

---

## Testing Polling

### Calendar Page

1. Navigate to `http://localhost:3000/en/calendar`
2. Open Browser DevTools → Console
3. Look for polling logs:
   ```
   [usePolling] Document visible - resuming polling
   [usePolling] Skipping fetch - document hidden
   ```

### Job Detail Page

1. Navigate to `http://localhost:3000/en/jobs/[jobId]`
2. Observe "Updated Xs ago" in header
3. Make a change via API in another tab
4. Wait 20 seconds
5. Verify change appears without refresh

### Test Tab Visibility

```javascript
// In browser console, manually trigger visibility change
document.dispatchEvent(new Event('visibilitychange'));
```

---

## Common Test Scenarios

### Scenario 1: Missing Webhook (Reconciliation Catchup)

```bash
# 1. Create a booking directly in Square Dashboard (bypass webhook)
#    - Go to https://squareupsandbox.com/dashboard
#    - Create new booking
#    - Note the booking ID

# 2. Verify it's NOT in your DynamoDB yet
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --filter-expression "bookingId = :bid" \
  --expression-attribute-values '{":bid":{"S":"BOOKING_ID_HERE"}}' \
  --region us-east-1

# 3. Run reconciliation
curl "http://localhost:3000/api/cron/reconcile?token=YOUR_CRON_SECRET"

# 4. Verify job was created
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --filter-expression "bookingId = :bid" \
  --expression-attribute-values '{":bid":{"S":"BOOKING_ID_HERE"}}' \
  --region us-east-1
```

### Scenario 2: Stale Customer Cache

```bash
# 1. Find a job with old customerCached (>24 hours)
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --region us-east-1 \
  | jq '.Items[] | select(.customerCached.cachedAt.S < "2026-02-19")'

# 2. Update customer in Square Dashboard
#    - Change name, email, or phone

# 3. Run reconciliation
curl "http://localhost:3000/api/cron/reconcile?token=YOUR_CRON_SECRET"

# 4. Verify customer data refreshed
aws dynamodb get-item \
  --table-name safari-detail-ops-qa-jobs \
  --key '{"jobId":{"S":"JOB_ID_HERE"}}' \
  --region us-east-1 \
  | jq '.Item.customerCached'
```

### Scenario 3: Polling Performance

```javascript
// In browser console, measure polling overhead
let fetchCount = 0;
let lastFetchTime = Date.now();

// Override fetch to log
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  if (args[0].includes('/api/jobs')) {
    fetchCount++;
    const now = Date.now();
    console.log(`[Polling Test] Fetch #${fetchCount}, ${now - lastFetchTime}ms since last`);
    lastFetchTime = now;
  }
  return originalFetch.apply(this, args);
};

// Let it run for 2 minutes
// Should see ~6 fetches (every 20 seconds)
```

---

## Database Queries

### Count Jobs by Creation Source

```bash
# Count jobs created by webhook vs reconciliation
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --region us-east-1 \
  | jq '[.Items[] | .createdBy.S] | group_by(.) | map({source: .[0], count: length})'
```

### Find Jobs with Reconciliation Updates

```bash
# Find jobs last updated by reconciliation
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --filter-expression "updatedBy = :reconcile" \
  --expression-attribute-values '{":reconcile":{"S":"reconciliation"}}' \
  --region us-east-1 \
  | jq '.Items | length'
```

---

## Monitoring Commands

### Watch Logs (Development)

```bash
# Tail Next.js dev logs
npm run dev | grep -E '\[usePolling\]|\[RECONCILE\]|\[SQUARE'
```

### Production Logs (Vercel)

```bash
# Real-time log streaming
vercel logs --follow --output raw

# Filter for specific patterns
vercel logs --output raw | grep -i reconcile

# Get last 100 lines
vercel logs --output raw -n 100
```

### Check Vercel Cron Status

1. Visit Vercel Dashboard → Your Project
2. Go to "Cron Jobs" tab
3. View execution history and logs
4. Check for failed runs

---

## Troubleshooting Commands

### Verify Environment Variables

```bash
# Local
cat .env | grep CRON_SECRET

# Vercel
vercel env ls
```

### Test Square API Connection

```bash
# Test if Square token is valid
curl -X GET "https://connect.squareupsandbox.com/v2/locations" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Square-Version: 2024-01-18" \
  | jq '.locations[] | {id, name}'
```

### Check DynamoDB Table

```bash
# Count total jobs
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --select COUNT \
  --region us-east-1 \
  | jq '.Count'

# List recent jobs
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --region us-east-1 \
  | jq '.Items | sort_by(.createdAt.S) | reverse | .[0:5] | .[] | {jobId: .jobId.S, customer: .customerName.S, created: .createdAt.S}'
```

### Debug Polling in Browser

```javascript
// Check if document.hidden API is supported
console.log('Supports visibility API:', typeof document.hidden !== 'undefined');

// Manually check visibility
console.log('Document hidden:', document.hidden);

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
  console.log('Visibility changed:', document.hidden ? 'HIDDEN' : 'VISIBLE');
});
```

---

## Performance Benchmarks

### Expected Reconciliation Times

- **Small dataset (10-20 bookings):** 2-5 seconds
- **Medium dataset (50-100 bookings):** 5-15 seconds
- **Large dataset (100+ bookings):** 15-30 seconds

### Expected Polling Overhead

- **Network:** ~1-2KB per poll (gzip compressed)
- **Client CPU:** Negligible (<1% on modern devices)
- **Server Load:** Minimal (same as manual page refresh)

---

## Quick Start Checklist

- [ ] Set `CRON_SECRET` in `.env`
- [ ] Restart dev server: `npm run dev`
- [ ] Test reconcile endpoint manually (curl)
- [ ] Test calendar page polling (visit `/en/calendar`)
- [ ] Deploy to Vercel
- [ ] Set `CRON_SECRET` in Vercel environment
- [ ] Verify cron runs in Vercel dashboard (wait 10 min)
- [ ] Test production reconcile endpoint
- [ ] Monitor for errors

---

## Additional Resources

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Square Bookings API Reference](https://developer.squareup.com/reference/square/bookings-api)
- [Phase 4 Implementation Guide](./PHASE_4_IMPLEMENTATION_COMPLETE.md)
