# Twilio SMS Completion Notification Implementation

## Summary

This implementation adds SMS notifications to customers when a job is marked as "Work Done" (WORK_COMPLETED status) using Twilio.

## Implementation Details

### 1. Dependencies Required

Install Twilio SDK:

```bash
npm install twilio
npm install --save-dev @types/twilio
```

### 2. Environment Variables

Add these to your Vercel project settings:

```
TWILIO_ACCOUNT_SID=<your-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>

# Prefer Messaging Service (recommended)
TWILIO_MESSAGING_SERVICE_SID=<your-messaging-service-sid>

# OR use a specific phone number (if no messaging service)
TWILIO_FROM_NUMBER=+1234567890
```

### 3. Files Changed

#### A. Created: `lib/twilio.ts`
- Reusable Twilio client module
- Provides `getTwilioClient()` and `sendSms()` functions
- Validates phone numbers (E.164 format)
- Supports both Messaging Service SID and From Number

#### B. Created: `lib/services/sms-service.ts`
- `sendCompletionSms(jobId)` function
- Implements idempotency check using `completionSmsSentAt`
- Validates customer phone number
- Sends personalized message with optional customer first name
- Updates job record with SMS metadata after successful send
- Graceful error handling and logging

#### C. Modified: `lib/types.ts`
- Added to `Job` interface:
  - `completionSmsSentAt?: string` - ISO timestamp when SMS was sent
  - `completionSmsSid?: string` - Twilio message SID for tracking

#### D. Modified: `lib/services/job-service.ts`
- Updated `updateJobStatus()` function:
  - Checks for status transition to `WORK_COMPLETED`
  - Prevents sending if already in `WORK_COMPLETED` status
  - Calls `sendCompletionSms()` after status update
  - Logs SMS result (success/skip/error)
  - Does NOT fail status update if SMS fails (graceful degradation)

#### E. Created: `scripts/test-completion-sms.ts`
- Test script to manually trigger completion SMS
- Validates environment variables
- Usage: `npx tsx scripts/test-completion-sms.ts <jobId>`

### 4. How It Works

When a job status is updated to `WORK_COMPLETED`:

1. `updateJobStatus()` is called via PATCH `/api/jobs/[jobId]/update`
2. Job status is updated in DynamoDB
3. Function checks if this is a transition TO `WORK_COMPLETED`
4. If yes, `sendCompletionSms()` is called:
   - Checks if SMS was already sent (idempotency via `completionSmsSentAt`)
   - If already sent, returns `{ skipped: true, reason: "already_sent" }`
   - Validates customer phone exists and is E.164 format
   - Sends SMS via Twilio: "Safari Detail Ops: Your vehicle is complete and ready. Questions? Call (615) 431-2770."
   - Updates job with `completionSmsSentAt` and `completionSmsSid`
5. SMS errors are logged but do NOT fail the status update

### 5. Message Template

```
Safari Detail Ops: Your vehicle is complete and ready. Questions? Call (615) 431-2770.
```

Or with customer first name:

```
John, Safari Detail Ops: Your vehicle is complete and ready. Questions? Call (615) 431-2770.
```

### 6. Idempotency

- SMS is sent only ONCE per job
- Checked via `completionSmsSentAt` field
- Safe against:
  - User double-clicking "Mark Complete" button
  - API request retries
  - Re-saving job with same status

### 7. Error Handling

- **Missing phone**: Skips SMS, logs warning
- **Invalid phone format**: Throws error with clear message
- **Missing Twilio credentials**: Throws error at runtime
- **Twilio API error**: Logged but doesn't fail status update
- **Job not found**: Throws error

### 8. Database Changes

No migration needed. DynamoDB schema is flexible:

- `completionSmsSentAt` - Added to Job records when SMS is sent
- `completionSmsSid` - Added to Job records when SMS is sent

These fields are automatically stored via the existing `updateJob()` function.

## Test Plan

### Manual Testing Steps

#### 1. Install Dependencies

```bash
npm install twilio @types/twilio
```

#### 2. Set Environment Variables

In your local `.env` or Vercel dashboard:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...  # or TWILIO_FROM_NUMBER
```

#### 3. Test SMS Sending (Direct)

```bash
npx tsx scripts/test-completion-sms.ts <existing-job-id>
```

Expected output:
- ✓ SMS sent successfully with message SID
- Job updated with `completionSmsSentAt` and `completionSmsSid`

#### 4. Test Idempotency

Run the same command again:

```bash
npx tsx scripts/test-completion-sms.ts <same-job-id>
```

Expected output:
- Skipped: true
- Reason: "already_sent"

#### 5. Test via Dashboard

1. Open a job in the dashboard
2. Mark status as "Work Done" (WORK_COMPLETED)
3. Check console logs for SMS success
4. Verify customer receives SMS
5. Check job record for `completionSmsSentAt` and `completionSmsSid`

#### 6. Test Double-Click Protection

1. Quickly click "Mark Complete" twice
2. Only ONE SMS should be sent
3. Second click should skip (already_sent)

#### 7. Test Missing Phone Number

1. Find or create a job with no `customerPhone`
2. Mark as WORK_COMPLETED
3. Status should update successfully
4. SMS should be skipped with reason: "no_phone"

#### 8. Test Invalid Phone Format

1. Update a job's phone to invalid format (e.g., "6155551234" without +1)
2. Mark as WORK_COMPLETED
3. Should log error but status update should still succeed

### Verification Checklist

- [ ] Twilio SDK installed
- [ ] Environment variables set in Vercel
- [ ] SMS sends when job marked WORK_COMPLETED
- [ ] SMS only sends once (idempotent)
- [ ] Correct message template used
- [ ] Customer name included if available
- [ ] `completionSmsSentAt` stored in DB
- [ ] `completionSmsSid` stored in DB
- [ ] No SMS crash if phone missing
- [ ] Status update succeeds even if SMS fails

## API Endpoint Modified

**PATCH** `/api/jobs/[jobId]/update`

Request body:
```json
{
  "status": "WORK_COMPLETED",
  "updatedBy": "tech-123"
}
```

Response (success):
```json
{
  "success": true,
  "data": {
    "jobId": "...",
    "status": "WORK_COMPLETED",
    "completionSmsSentAt": "2026-02-23T10:30:00.000Z",
    "completionSmsSid": "SM...",
    ...
  },
  "timestamp": "2026-02-23T10:30:00.123Z"
}
```

## Monitoring & Debugging

### Check SMS Logs

All SMS operations are logged with prefix `[SMS SERVICE]`:

```
[SMS SERVICE] Completion SMS sent successfully { jobId, phone, messageSid }
[SMS SERVICE] Completion SMS already sent { jobId, sentAt, messageSid }
[SMS SERVICE] No customer phone number { jobId }
[SMS SERVICE] Failed to send completion SMS { jobId, phone, error }
```

### View in Twilio Console

1. Go to Twilio Dashboard → Monitor → Logs → Messaging
2. Filter by date/phone number
3. See delivery status, error codes, etc.

### Retry Failed SMS

If SMS fails due to temporary issues:

1. Clear the `completionSmsSentAt` field in DynamoDB
2. Run test script: `npx tsx scripts/test-completion-sms.ts <jobId>`
3. Or re-save the job status in the dashboard

## Future Enhancements (Not Implemented)

- Delivery status callbacks (Twilio webhooks)
- SMS templates with variables
- Multiple notification types (checkin, reminder, etc.)
- Admin panel to view SMS history
- Retry queue for failed sends
- Support for international numbers
- SMS opt-out management

## Technical Notes

### Why Not Fail Status Update on SMS Error?

The status update succeeds even if SMS fails because:
- Work completion is the critical operation
- SMS is a "nice to have" notification
- Can be retried manually if needed
- Prevents blocking the primary workflow

### Concurrency Safety

DynamoDB's `updateJob()` function handles concurrent updates safely. The idempotency check (`completionSmsSentAt`) prevents duplicate sends even under race conditions.

### Phone Number Format

Customer phones are expected to be stored as E.164 format (e.g., `+16155551234`). If your existing data uses different formats, you may need to:
- Add a normalization helper
- Run a one-time migration script
- Update phone input validation on booking creation
