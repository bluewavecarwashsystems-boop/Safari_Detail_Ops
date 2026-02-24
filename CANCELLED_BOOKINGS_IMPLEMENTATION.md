# Cancelled Bookings Implementation - Complete

**Date:** February 24, 2026  
**Feature:** Display and handle cancelled Square bookings on Safari Detail Ops board

---

## Overview

When a Square booking is cancelled, the system now:
- ✅ Detects cancellation via webhook or reconciliation
- ✅ Updates job status to `CANCELLED` with metadata
- ✅ Displays cancelled jobs visually distinct on the board
- ✅ Prevents workflow actions on cancelled jobs
- ✅ Maintains audit trail of cancellation source

---

## 1. Data Model Changes

### File: `lib/types.ts`

#### A. Added `CANCELLED` to `WorkStatus` enum
```typescript
export enum WorkStatus {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  QC_READY = 'QC_READY',
  WORK_COMPLETED = 'WORK_COMPLETED',
  NO_SHOW_PENDING_CHARGE = 'NO_SHOW_PENDING_CHARGE',
  NO_SHOW_CHARGED = 'NO_SHOW_CHARGED',
  NO_SHOW_FAILED = 'NO_SHOW_FAILED',
  CANCELLED = 'CANCELLED',  // ← NEW
}
```

#### B. Added cancellation metadata to `Job` interface
```typescript
export interface Job {
  // ... existing fields
  
  // Cancellation tracking
  cancelledAt?: string;
  cancelledSource?: 'square' | 'manual';
  cancellationReason?: string;
}
```

**Why these fields:**
- `cancelledAt`: Timestamp when cancellation was detected
- `cancelledSource`: Tracks whether cancelled via Square webhook or manual action
- `cancellationReason`: Stores Square booking status or manual reason

---

## 2. Backend - Cancellation Detection & Persistence

### File: `lib/services/job-service.ts`

#### A. Updated `mapBookingStatusToJobStatus()`
**Change:** Now maps `CANCELLED` and `DECLINED` Square statuses to `WorkStatus.CANCELLED`

```typescript
function mapBookingStatusToJobStatus(bookingStatus: string): WorkStatus {
  switch (bookingStatus.toUpperCase()) {
    case 'ACCEPTED':
    case 'PENDING':
      return WorkStatus.SCHEDULED;
    case 'CANCELLED':
    case 'DECLINED':
      return WorkStatus.CANCELLED;  // ← Changed from SCHEDULED
    default:
      return WorkStatus.SCHEDULED;
  }
}
```

#### B. Updated `createJobFromBooking()`
**Change:** Adds cancellation metadata when creating a cancelled job

```typescript
const mappedStatus = mapBookingStatusToJobStatus(booking.status);
const isCancelled = mappedStatus === WorkStatus.CANCELLED;

const job: Job = {
  // ... existing fields
  status: mappedStatus,
  
  // Add cancellation metadata if booking is cancelled
  ...(isCancelled && {
    cancelledAt: new Date().toISOString(),
    cancelledSource: 'square' as const,
    cancellationReason: `Square booking status: ${booking.status}`,
  }),
};
```

#### C. Updated `updateJobFromBooking()`
**Change:** Adds cancellation metadata when updating to cancelled (idempotent)

```typescript
const mappedStatus = mapBookingStatusToJobStatus(booking.status);
const isCancelled = mappedStatus === WorkStatus.CANCELLED;
const wasAlreadyCancelled = currentJob?.status === WorkStatus.CANCELLED;

const updates: Partial<Job> = {
  // ... existing fields
  
  // Add cancellation metadata if newly cancelled (idempotent)
  ...(isCancelled && !wasAlreadyCancelled && {
    cancelledAt: new Date().toISOString(),
    cancelledSource: 'square' as const,
    cancellationReason: `Square booking status: ${booking.status}`,
  }),
};
```

---

### File: `lib/reconcile/reconcileBookings.ts`

#### Updated `processBooking()` to mark jobs as CANCELLED
**Change:** Previously only logged cancelled bookings, now updates job status

```typescript
// Handle cancelled bookings
if (isCancelledBooking(booking)) {
  if (existingJob) {
    console.log('[RECONCILE] Booking cancelled', {
      bookingId,
      jobId: existingJob.jobId,
      currentStatus: existingJob.status,
    });
    
    // Update job to CANCELLED status if not already cancelled
    if (existingJob.status !== WorkStatus.CANCELLED) {
      if (!dryRun) {
        await dynamodb.updateJob(existingJob.jobId, {
          status: WorkStatus.CANCELLED,
          cancelledAt: new Date().toISOString(),
          cancelledSource: 'square',
          cancellationReason: `Square booking status: ${booking.status}`,
          updatedBy: 'reconciliation',
        });
        console.log('[RECONCILE] Job marked as CANCELLED', {
          jobId: existingJob.jobId,
          bookingId,
        });
      }
    }
    result.cancelled++;
  } else {
    // Cancelled booking with no job - skip
    result.skipped++;
  }
  return;
}
```

**Key points:**
- ✅ Reconciliation acts as failsafe if webhooks are missed
- ✅ Idempotent - won't re-update already cancelled jobs
- ✅ Respects dry-run mode for testing

---

### File: `app/api/square/webhooks/bookings/route.ts`

**No changes required** - webhook handler calls `createJobFromBooking()` and `updateJobFromBooking()`, which now handle cancellations automatically.

**Square cancellation event field:**
- Square booking object has `status` field
- Values indicating cancellation: `"CANCELLED"`, `"DECLINED"`
- These map to `WorkStatus.CANCELLED` via `mapBookingStatusToJobStatus()`

---

## 3. API Guards - Prevent Actions on Cancelled Jobs

### File: `app/api/jobs/[jobId]/route.ts` (PATCH endpoint)

**Added guard after job fetch:**
```typescript
if (!currentJob) {
  // ... 404 error
}

// RULE: CANCELLED jobs cannot be modified (except for viewing)
if (currentJob.status === WorkStatus.CANCELLED) {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'JOB_CANCELLED',
      message: 'Cancelled jobs cannot be modified. The booking was cancelled in Square.',
    },
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response, { status: 409 });
}

// ... rest of validation
```

**Protected operations:**
- ✅ Status transitions (cannot start, complete, etc.)
- ✅ Checklist updates
- ✅ Payment toggles
- ✅ Photo uploads
- ✅ Post-completion issues
- ✅ Vehicle info updates

---

### File: `app/api/jobs/[jobId]/update/route.ts` (PATCH endpoint)

**Added similar guard:**
```typescript
// Check if job is cancelled before allowing updates
const { getJob } = await import('@/lib/aws/dynamodb');
const currentJob = await getJob(jobId);

if (currentJob && currentJob.status === 'CANCELLED' as WorkStatus) {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'JOB_CANCELLED',
      message: 'Cancelled jobs cannot be modified. The booking was cancelled in Square.',
    },
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response, { status: 409 });
}
```

---

## 4. Board UI Changes

### File: `app/[locale]/page.tsx` (Today's Board)

#### A. Added cancelled column definition
```typescript
const columns = [
  { status: WorkStatus.SCHEDULED, title: t('status.scheduled'), color: '#64748B' },
  { status: WorkStatus.CHECKED_IN, title: t('status.checkedIn'), color: '#2563EB' },
  { status: WorkStatus.IN_PROGRESS, title: t('status.inProgress'), color: '#F47C20' },
  { status: WorkStatus.QC_READY, title: t('status.qcReady'), color: '#7C3AED' },
  { status: WorkStatus.WORK_COMPLETED, title: t('status.workCompleted'), color: '#16A34A' },
];

// Separate section for cancelled jobs (displayed at the bottom)
const cancelledColumn = { status: WorkStatus.CANCELLED, title: 'Cancelled', color: '#9CA3AF' };
```

#### B. Added cancelled jobs section (renders below main columns)
**Visual treatment:**
- **Badge:** Safari orange (`#F47C20`) background, white text, bold, "CANCELLED" (top-right)
- **Card styling:**
  - `opacity-60` - dimmed visibility
  - `filter: grayscale(0.5)` - subtle desaturation
  - Gray border and left accent
  - Strikethrough on service name and price
- **No action buttons** - only "View Details" link via card click
- **Message:** "Booking cancelled in Square" (replaces action button area)

```tsx
{/* Cancelled Jobs Section */}
{(() => {
  const cancelledJobs = jobs.filter(job => job.workStatus === WorkStatus.CANCELLED);
  if (cancelledJobs.length === 0) return null;
  
  return (
    <div className="mt-8">
      <div className="bg-white border-b p-4 mb-4 rounded-t-2xl">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cancelledColumn.color }}></span>
          <span>{cancelledColumn.title}</span>
          <span className="ml-auto px-3 py-1 text-xs rounded-full font-medium bg-gray-100">
            {cancelledJobs.length}
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 px-1">
        {cancelledJobs.map((job) => (
          <div
            key={job.jobId}
            className="bg-white rounded-2xl p-4 border border-gray-300 opacity-60 relative"
            style={{ 
              boxShadow: 'var(--sf-shadow)',
              borderLeft: `4px solid ${cancelledColumn.color}`,
              filter: 'grayscale(0.5)'
            }}
          >
            {/* CANCELLED Badge */}
            <div className="absolute top-2 right-2 bg-[#F47C20] text-white px-3 py-1 rounded-full text-xs font-bold">
              CANCELLED
            </div>

            <Link href={`/${locale}/jobs/${job.jobId}`} className="block hover:opacity-90 transition">
              <div className="flex items-start justify-between mb-2 pr-24">
                <div className="font-semibold text-sm">{job.customerName}</div>
              </div>
              {job.payment?.amountCents && (
                <div className="text-sm font-semibold mb-2 line-through">
                  ${(job.payment.amountCents / 100).toFixed(2)}
                </div>
              )}
              <div className="text-xs mb-2">{job.vehicleInfo}</div>
              <div className="text-sm font-medium mb-1 line-through">{job.serviceType}</div>
              <div className="text-xs font-medium">
                {new Date(job.scheduledStart).toLocaleTimeString(/* ... */)}
              </div>
            </Link>
            
            {/* No action buttons for cancelled jobs */}
            <div className="mt-3 text-xs text-center" style={{ color: 'var(--sf-muted)' }}>
              Booking cancelled in Square
            </div>
          </div>
        ))}
      </div>
    </div>
  );
})()}
```

**Design Notes:**
- ✅ Cancelled jobs appear in separate section below main columns
- ✅ Safari orange badge matches brand
- ✅ Dimmed/grayscale styling makes cancellation obvious
- ✅ Strikethrough on service name and price indicates void
- ✅ No workflow buttons prevent accidental actions
- ✅ "View Details" link still available for reference

---

### File: `app/[locale]/components/JobCard.tsx`

**Added CANCELLED to status colors and labels:**
```typescript
const statusColors: Record<WorkStatus, string> = {
  // ... existing statuses
  [WorkStatus.CANCELLED]: 'bg-gray-100 text-gray-700 border-gray-300',
};

const statusLabels: Record<WorkStatus, string> = {
  // ... existing statuses
  [WorkStatus.CANCELLED]: 'Cancelled',
};
```

---

### File: `app/[locale]/components/StickyActionBar.tsx`

**Prevented actions on cancelled jobs:**
```typescript
const getNextStatuses = (): { status: WorkStatus; label: string; icon: string }[] => {
  // No actions available for cancelled jobs
  if (currentStatus === WorkStatus.CANCELLED) {
    return [];
  }
  
  switch (currentStatus) {
    // ... existing cases
  }
};
```

---

## 5. Summary of Changes by File

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/types.ts` | Model | Added `CANCELLED` to `WorkStatus` enum + cancellation metadata fields to `Job` |
| `lib/services/job-service.ts` | Backend | Updated status mapping + added cancellation metadata on create/update |
| `lib/reconcile/reconcileBookings.ts` | Backend | Reconciliation now updates jobs to CANCELLED (failsafe) |
| `app/api/jobs/[jobId]/route.ts` | API Guard | Reject all modifications to cancelled jobs (409 Conflict) |
| `app/api/jobs/[jobId]/update/route.ts` | API Guard | Reject all updates to cancelled jobs (409 Conflict) |
| `app/[locale]/page.tsx` | UI | Cancelled jobs section with dimmed cards, CANCELLED badge, no actions |
| `app/[locale]/components/JobCard.tsx` | UI | Added CANCELLED status colors and label |
| `app/[locale]/components/StickyActionBar.tsx` | UI | No actions available for CANCELLED status |

---

## 6. Square Cancellation Detection

**Square webhook event indicates cancellation via:**
- **Field:** `data.object.booking.status`
- **Values:** `"CANCELLED"` or `"DECLINED"`

**Detection points:**
1. **Webhook (real-time):** `app/api/square/webhooks/bookings/route.ts`
   - Calls `createJobFromBooking()` or `updateJobFromBooking()`
   - Status automatically mapped to `WorkStatus.CANCELLED`
   
2. **Reconciliation (failsafe):** `lib/reconcile/reconcileBookings.ts`
   - Runs periodically (cron/manual)
   - Fetches recent bookings from Square API
   - Calls `isCancelledBooking(booking)` to detect `status === 'CANCELLED'`
   - Updates job to `WorkStatus.CANCELLED` if not already set

---

## 7. Testing Checklist

### Backend
- [x] Cancel booking in Square → webhook received
- [x] Job status updated to `CANCELLED`
- [x] Cancellation metadata populated (`cancelledAt`, `cancelledSource`, `cancellationReason`)
- [x] Reconciliation detects and updates cancelled bookings
- [x] Idempotent: repeated reconciliation doesn't duplicate updates

### API Guards
- [x] PATCH `/api/jobs/{jobId}` rejects updates with 409 error
- [x] PATCH `/api/jobs/{jobId}/update` rejects updates with 409 error
- [x] Error message: "Cancelled jobs cannot be modified. The booking was cancelled in Square."

### Board UI
- [x] Cancelled jobs appear in separate "Cancelled" section at bottom
- [x] Orange "CANCELLED" badge visible in top-right
- [x] Card is dimmed (`opacity-60`) and desaturated (`grayscale(0.5)`)
- [x] Service name and price have strikethrough
- [x] No workflow buttons (Start, Complete, etc.)
- [x] "View Details" link still works
- [x] Message: "Booking cancelled in Square"

### Job Detail Page
- [x] Cancelled status displayed correctly
- [x] Workflow buttons hidden/disabled
- [x] Error shown if attempting to update cancelled job via API

---

## 8. Future Enhancements (Optional)

These were not implemented but could be added:

1. **Reinstate Job (Manager-only)**
   - Allow managers to "un-cancel" a job if booking was mistakenly cancelled
   - Would require storing original status before cancellation

2. **Cancellation Reason from Square**
   - Square API doesn't provide cancellation reason in webhook
   - Could fetch from Order API if available

3. **Email Notification**
   - Notify manager when booking is cancelled via webhook
   - Requires email service integration

4. **Analytics**
   - Track cancellation rate by service type
   - Identify patterns (time of day, customer segments)

---

## 9. Acceptance Criteria - Status

✅ **Cancel booking in Square → job updates to CANCELLED within seconds/minutes**  
✅ **Cancelled card is visually obvious (orange badge, dimmed, strikethrough)**  
✅ **Cancelled jobs cannot be worked (no action buttons, API rejects updates)**  
✅ **Board remains stable; no breaking changes to active jobs**  
✅ **Reconciliation catches missed webhook events**  

---

## 10. Production Deployment Notes

1. **No database migration required** - DynamoDB is schemaless, new fields added on write
2. **Backward compatible** - existing jobs without cancellation fields work normally
3. **Safe to deploy** - no breaking changes to existing job workflows
4. **Monitoring points:**
   - Watch for 409 errors in API logs (expected for attempted updates to cancelled jobs)
   - Monitor webhook processing for cancellation events
   - Track reconciliation results for missed cancellations

---

## End of Implementation Document
