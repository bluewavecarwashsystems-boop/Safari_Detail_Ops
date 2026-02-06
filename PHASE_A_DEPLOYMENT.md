# Phase A Deployment Guide - Endpoint Scaffolding

## Overview
Phase A establishes minimal endpoint scaffolding that returns fast 2xx responses, allowing Square to validate webhook URLs later without actual integration logic.

## Files Modified

### 1. `/lib/config.ts`
- **Changes**: Added defensive mode that never crashes on missing env vars in QA
- **Added**: `franklinLocationId` field to config
- **Changed**: Uses `SQUARE_ENV` env var (not `SQUARE_ENVIRONMENT`)
- **Behavior**: Returns 'qa' as fallback if `APP_ENV` is missing/invalid (Phase A only)

### 2. `/api/health.ts`
- **Changes**: Complete rewrite for Phase A specs
- **Response format**:
  ```json
  {
    "app_env": "qa|prod|unknown",
    "square_env": "sandbox|production|unknown",
    "timestamp": "2026-02-05T12:00:00.000Z",
    "franklin_location_id": "L9ZMZD9TTTTZJ" | null,
    "build": "abc123def456" | null
  }
  ```
- **Behavior**: Never crashes, always returns 200 OK (or 500 with safe defaults)
- **Security**: Does NOT expose secrets

### 3. `/api/square/webhooks/bookings.ts`
- **Changes**: Complete rewrite as Phase A stub
- **Methods**: Accepts both GET and POST
- **Response**: Always returns HTTP 200 with body "OK"
- **Logging**: Logs headers + body length (NOT content)
- **Behavior**: Never crashes on empty/invalid JSON
- **Security**: Removes sensitive headers from logs (x-square-signature, authorization, cookie)
- **Phase A**: NO signature validation, NO Square integration

## Environment Variables Required for Phase A

### Minimal (QA)
```bash
APP_ENV=qa
SQUARE_ENV=sandbox
```

### Optional (will show as null if not set)
```bash
FRANKLIN_SQUARE_LOCATION_ID=<sandbox-location-id>
```

### Not Required Yet (Phase B)
- `SQUARE_ACCESS_TOKEN` - Not needed for Phase A
- `SQUARE_WEBHOOK_SIGNATURE_KEY` - Not needed for Phase A
- AWS credentials - Not needed for Phase A

## Deployment Steps

### 1. Set Environment Variables in Vercel
```bash
# Navigate to Vercel dashboard for ops-qa project
# Settings -> Environment Variables
# Add for "qa" environment:

APP_ENV=qa
SQUARE_ENV=sandbox
FRANKLIN_SQUARE_LOCATION_ID=<leave-blank-for-now>
```

### 2. Deploy to QA
```powershell
# From project root
cd C:\code\Safari_Ops

# Deploy to QA (production deployment)
npx vercel --prod

# Or use Vercel Git integration (recommended)
git add .
git commit -m "Phase A: Minimal endpoint scaffolding for Square webhook validation"
git push origin main
```

### 3. Verify Deployment
The Vercel deployment will provide a URL. Once deployed, test:

```powershell
# Test health endpoint
curl https://ops-qa.thesafaricarwash.com/api/health

# Expected response:
# {
#   "app_env": "qa",
#   "square_env": "sandbox",
#   "timestamp": "2026-02-05T...",
#   "franklin_location_id": null,
#   "build": "abc123..."
# }

# Test webhook endpoint (GET)
curl https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings

# Expected response:
# OK

# Test webhook endpoint (POST)
curl https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings `
  -Method POST `
  -Body '{"test":"data"}' `
  -ContentType 'application/json' `
  -UseBasicParsing

# Expected response:
# OK
```

## Testing Checklist

- [ ] Health endpoint returns 200 OK with correct JSON format
- [ ] `app_env` field shows "qa" (or "unknown" if not set)
- [ ] `square_env` field shows "sandbox" (or "unknown" if not set)
- [ ] `franklin_location_id` shows null (since not set yet)
- [ ] `build` field shows Git SHA (from Vercel)
- [ ] No secrets exposed in health response
- [ ] Webhook endpoint accepts GET requests
- [ ] Webhook endpoint accepts POST requests
- [ ] Webhook endpoint returns "OK" in < 1 second
- [ ] Webhook endpoint never crashes on empty body
- [ ] Webhook endpoint never crashes on invalid JSON
- [ ] Webhook logs show metadata but NOT body content

## Vercel Logs Verification

After deployment, check Vercel logs for webhook requests:

1. Go to Vercel Dashboard → Project → Logs
2. Send test POST to webhook endpoint
3. Look for log entry: `[Phase A Webhook Stub]`
4. Verify it shows: method, timestamp, headers (sanitized), bodyLength
5. Verify it does NOT show: body content, signatures, tokens

## Next Steps (Phase B)

After Phase A is verified working:
1. Set `FRANKLIN_SQUARE_LOCATION_ID` in Vercel env vars (sandbox value)
2. Set `SQUARE_ACCESS_TOKEN` (sandbox)
3. Set `SQUARE_WEBHOOK_SIGNATURE_KEY` (sandbox)
4. Create webhook subscription in Square Developer Dashboard pointing to:
   - `https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings`
5. Begin Phase B implementation (full Square integration)

## Rollback Plan

If Phase A deployment causes issues:
```powershell
# Revert to previous deployment in Vercel Dashboard
# Or deploy previous Git commit:
git revert HEAD
git push origin main
```

## Phase A Success Criteria

✅ Health endpoint is publicly accessible and returns valid JSON  
✅ Webhook endpoint is publicly accessible and returns 200 OK  
✅ Both endpoints respond in < 1 second  
✅ No crashes on missing env vars  
✅ No secrets exposed  
✅ Ready for Square webhook subscription creation (Phase B)  
