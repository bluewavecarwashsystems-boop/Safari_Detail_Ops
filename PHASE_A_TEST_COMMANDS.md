# Phase A - Quick Test Commands

## After deploying to QA, run these PowerShell commands:

### Test Health Endpoint
```powershell
$response = curl https://ops-qa.thesafaricarwash.com/api/health -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Expected output:**
```json
{
  "app_env": "qa",
  "square_env": "sandbox",
  "timestamp": "2026-02-05T...",
  "franklin_location_id": null,
  "build": "abc123..."
}
```

### Test Webhook Endpoint (GET)
```powershell
curl https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings -UseBasicParsing
```

**Expected output:**
```
OK
```

### Test Webhook Endpoint (POST with body)
```powershell
$headers = @{"Content-Type" = "application/json"}
$body = '{"test":"data","eventType":"booking.created"}'
$response = curl https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings `
  -Method POST `
  -Headers $headers `
  -Body $body `
  -UseBasicParsing

Write-Host "Status: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"
```

**Expected output:**
```
Status: 200
Response: OK
```

### Test Webhook Endpoint (POST with empty body)
```powershell
$response = curl https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings `
  -Method POST `
  -UseBasicParsing

Write-Host "Status: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"
```

**Expected output:**
```
Status: 200
Response: OK
```

### Test Webhook Endpoint (POST with invalid JSON)
```powershell
$headers = @{"Content-Type" = "application/json"}
$body = '{invalid json content'
$response = curl https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings `
  -Method POST `
  -Headers $headers `
  -Body $body `
  -UseBasicParsing

Write-Host "Status: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"
```

**Expected output:**
```
Status: 200
Response: OK
```

## What to check in Vercel Logs

After running the POST tests above:

1. Go to: https://vercel.com/dashboard → Safari Detail Ops (QA) → Logs
2. Filter by: `/api/square/webhooks/bookings`
3. Look for entries like:
   ```
   [Phase A Webhook Stub] {
     method: "POST",
     timestamp: "2026-02-05T...",
     headers: { ... },
     bodyLength: 42
   }
   ```
4. Verify NO sensitive data is logged (no x-square-signature values, etc.)

## All Tests Passing?

✅ Health endpoint returns correct JSON format  
✅ Health shows app_env="qa" and square_env="sandbox"  
✅ Webhook returns "OK" for GET requests  
✅ Webhook returns "OK" for POST with valid JSON  
✅ Webhook returns "OK" for POST with empty body  
✅ Webhook returns "OK" for POST with invalid JSON  
✅ All responses are fast (< 1 second)  
✅ Vercel logs show requests without exposing secrets  

**If all checks pass → Phase A is complete! ✅**

Ready to proceed with:
1. Setting Square webhook subscription URL in Square Developer Dashboard
2. Implementing Phase B (full Square integration with signature validation)
