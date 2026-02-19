# Phase 3: Manual Test Commands

## Prerequisites
```bash
# Ensure you're logged in
# Default admin credentials from seed script:
# Email: admin@safaridetail.com
# Password: Admin123!
```

## 1. Test Status Update Persistence

### Via Today Board
```bash
# 1. Access board
http://localhost:3000/en

# 2. Use browser dev tools Network tab to monitor PATCH requests
# 3. Click "Move to CHECKED_IN" on any SCHEDULED job
# Expected: HTTP 200 response with updated job data

# 4. Refresh page
# Expected: Job persists in new column
```

### Via API (cURL)
```bash
# Get your session cookie first (login via browser), then:

curl -X PATCH http://localhost:3000/api/jobs/{INSERT_JOB_ID_HERE} \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{"workStatus": "IN_PROGRESS"}'

# Expected Response:
{
  "success": true,
  "data": {
    "job": {
      "jobId": "...",
      "status": "IN_PROGRESS",
      "updatedBy": {
        "userId": "...",
        "name": "...",
        "role": "TECH"
      },
      "updatedAt": "2026-02-19T..."
    }
  }
}
```

## 2. Test Checklist Persistence

### Via Job Detail Page
```bash
# 1. Navigate to job detail
http://localhost:3000/en/jobs/{INSERT_JOB_ID_HERE}

# 2. Toggle a tech checklist item
# Expected: Immediate checkmark, network request shows PATCH with checklist payload

# 3. Refresh page
# Expected: Checklist state persists
```

### Via API (cURL)
```bash
curl -X PATCH http://localhost:3000/api/jobs/{INSERT_JOB_ID_HERE} \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "checklist": {
      "tech": [
        {"id": "tech-1", "label": "Vacuum interior", "checked": true},
        {"id": "tech-2", "label": "Clean windows", "checked": false}
      ]
    }
  }'
```

## 3. Test Photo Upload End-to-End

### Step 1: Generate Presigned URLs
```bash
curl -X POST http://localhost:3000/api/jobs/{INSERT_JOB_ID_HERE}/photos/presign \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "files": [
      {
        "filename": "test-photo.jpg",
        "contentType": "image/jpeg",
        "category": "before"
      }
    ]
  }'

# Save the response - you'll need putUrl and other fields for next steps
```

### Step 2: Upload to S3
```bash
# Using the putUrl from previous response:
curl -X PUT "PASTE_PUT_URL_HERE" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@/path/to/your/test-photo.jpg"

# Expected: HTTP 200 (no body)
```

### Step 3: Commit Photos
```bash
curl -X POST http://localhost:3000/api/jobs/{INSERT_JOB_ID_HERE}/photos/commit \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "photos": [
      {
        "photoId": "PASTE_PHOTO_ID_FROM_STEP_1",
        "s3Key": "PASTE_S3_KEY_FROM_STEP_1",
        "publicUrl": "PASTE_PUBLIC_URL_FROM_STEP_1",
        "contentType": "image/jpeg",
        "category": "before"
      }
    ]
  }'

# Expected: Job object with photosMeta array populated
```

### Via UI
```bash
# 1. Navigate to job detail page
# 2. Click "Upload Photos"
# 3. Select 1-2 image files
# 4. Choose categories
# 5. Click upload
# 6. Wait for success message
# 7. Verify photos appear in gallery
# 8. Refresh page - photos should persist
```

## 4. Test Customer Details Cache

### Trigger via Square Webhook
```bash
# Send a test webhook (replace with your actual data)
curl -X POST http://localhost:3000/api/square/webhooks/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "YOUR_MERCHANT_ID",
    "type": "booking.created",
    "event_id": "test-event-123",
    "created_at": "2026-02-19T10:00:00Z",
    "data": {
      "type": "booking",
      "id": "booking-123",
      "object": {
        "booking": {
          "id": "booking-123",
          "customer_id": "PASTE_ACTUAL_SQUARE_CUSTOMER_ID",
          "status": "ACCEPTED",
          "start_at": "2026-02-20T14:00:00Z"
        }
      }
    }
  }'

# Check logs for:
# [SQUARE API] Fetching customer {customerId}
# [CUSTOMER ENRICHED] ...
# [JOB SAVED] ...
```

### Verify Cache in DynamoDB
```bash
# Query the job record
aws dynamodb get-item \
  --table-name safari-detail-ops-qa-jobs \
  --key '{"jobId":{"S":"INSERT_JOB_ID"}}' \
  --region us-east-1

# Look for customerCached attribute:
# "customerCached": {
#   "M": {
#     "id": {"S": "..."},
#     "name": {"S": "..."},
#     "email": {"S": "..."},
#     "phone": {"S": "..."},
#     "cachedAt": {"S": "2026-02-19T..."}
#   }
# }
```

### View in UI
```bash
# 1. Navigate to job detail for a job with cached customer
# 2. Verify customer section shows:
#    - Name from cache (not "Unknown Customer")
#    - Email from cache
#    - Phone from cache
```

## 5. Test Error Handling

### Invalid Status Value
```bash
curl -X PATCH http://localhost:3000/api/jobs/{INSERT_JOB_ID_HERE} \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{"workStatus": "INVALID_STATUS"}'

# Expected: HTTP 400
# {"success": false, "error": {"code": "INVALID_STATUS", "message": "..."}}
```

### Unauthorized Photo Upload
```bash
# Try without session cookie:
curl -X POST http://localhost:3000/api/jobs/{INSERT_JOB_ID_HERE}/photos/presign \
  -H "Content-Type: application/json" \
  -d '{"files": [{"filename": "test.jpg", "contentType": "image/jpeg"}]}'

# Expected: HTTP 401
# {"success": false, "error": {"code": "UNAUTHORIZED", ...}}
```

### Invalid File Type
```bash
# Via UI:
# 1. Try uploading a .txt or .pdf file
# 2. Expected: Alert "Only image files (JPEG, PNG, GIF, WebP) are allowed"
```

### Checklist Role Violation
```bash
# Login as TECH user, try to update QC checklist:
curl -X PATCH http://localhost:3000/api/jobs/{INSERT_JOB_ID_HERE} \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_TECH_SESSION_COOKIE" \
  -d '{
    "checklist": {
      "qc": [{"id": "qc-1", "label": "Test", "checked": true}]
    }
  }'

# Expected: HTTP 403
# {"success": false, "error": {"code": "FORBIDDEN", ...}}
```

## 6. Test Optimistic UI & Rollback

### Network Failure Simulation
```bash
# 1. Open job detail page
# 2. Open browser DevTools -> Network tab
# 3. Enable "Offline" mode
# 4. Try to toggle a checklist item
# 5. Expected:
#    - Checkmark appears immediately (optimistic)
#    - Error toast appears after timeout
#    - Checkmark reverts (rollback)
# 6. Disable offline mode
# 7. Try again - should work
```

## 7. Verify Audit Trail

### Check DynamoDB
```bash
aws dynamodb get-item \
  --table-name safari-detail-ops-qa-jobs \
  --key '{"jobId":{"S":"INSERT_JOB_ID"}}' \
  --region us-east-1 \
  --query 'Item.{updatedBy:updatedBy,updatedAt:updatedAt,photosMeta:photosMeta}'

# Expected to see:
# {
#   "updatedBy": {
#     "M": {
#       "userId": {"S": "..."},
#       "name": {"S": "..."},
#       "role": {"S": "TECH"}
#     }
#   },
#   "updatedAt": {"S": "2026-02-19T..."},
#   "photosMeta": {
#     "L": [
#       {
#         "M": {
#           "uploadedBy": {
#             "M": {
#               "userId": {"S": "..."},
#               ...
#             }
#           },
#           "uploadedAt": {"S": "..."}
#         }
#       }
#     ]
#   }
# }
```

## 8. Performance Checks

### Photo Upload Direct to S3
```bash
# 1. Open browser DevTools -> Network tab
# 2. Upload a photo via UI
# 3. Verify:
#    - PUT request goes directly to S3 (amazonaws.com domain)
#    - NOT through your Next.js server
#    - Response is fast (<2s for typical photos)
```

Success indicators:
- ✅ All API calls return 2xx status codes
- ✅ Data persists across page refreshes
- ✅ Error states handled gracefully with user feedback
- ✅ Audit trails populated in DynamoDB
- ✅ Photos visible in S3 bucket and on frontend
