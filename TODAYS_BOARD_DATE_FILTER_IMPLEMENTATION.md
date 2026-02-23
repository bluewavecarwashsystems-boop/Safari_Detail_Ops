# Today's Board Date Filtering - Implementation Complete

## Summary

Successfully implemented timezone-safe date filtering for Safari Detail Ops "Today's Board" Kanban to prevent future jobs from appearing in the Scheduled column.

## Problem Fixed

**Before**: The Scheduled column showed ALL jobs regardless of date, including future bookings, making the board noisy and creating risk of accidentally checking in future customers.

**After**: The board now shows ONLY jobs scheduled for the selected date (default: today) in the location's timezone. Future jobs are filtered out, while in-progress jobs are preserved to avoid disappearing mid-workflow.

---

## Implementation Details

### 1. **Dependencies Added**
- Installed `date-fns-tz` for timezone-aware date operations

### 2. **New Files Created**

#### `lib/utils/timezone.ts`
Centralized timezone utilities for the application:
- `getStartOfDayInTimezone()` - Get 00:00:00 of a date in location timezone as UTC
- `getEndOfDayInTimezone()` - Get 23:59:59.999 of a date in location timezone as UTC
- `isTimestampOnBoardDate()` - Check if a UTC timestamp falls within a specific date
- `getTodayInTimezone()` - Get today's date string in location timezone
- `toLocationTime()` - Convert UTC timestamp to location time
- `getDayBoundaries()` - Get day boundaries for debugging

**Configuration**: Uses `LOCATION_TIMEZONE` environment variable (default: `America/New_York`)

#### `lib/utils/board-filters.ts`
Centralized job filtering logic:
- `filterJobsByBoardDate()` - Filters jobs to show only those for the board date
- `getFilteringStats()` - Returns filtering statistics for debugging

**Filtering Rules**:
1. SCHEDULED jobs: Only show if `appointmentTime` is on the board date
2. Active jobs (CHECKED_IN, IN_PROGRESS, QC_READY): Keep on board if from today or earlier (prevents disappearing mid-workflow)
3. WORK_COMPLETED jobs: Always excluded (belong to history, not today's board)
4. Fallback: If no `appointmentTime`, use `createdAt` timestamp

#### `test/board-filter.test.ts`
Comprehensive unit tests covering:
- Timezone conversion edge cases (11:30 PM, 12:15 AM)
- Day boundary calculations
- Job filtering by date
- Active job preservation
- Completed job exclusion
- Edge cases (midnight boundaries, missing timestamps)

**Test Results**: ✅ All 12 tests passing

---

### 3. **Files Modified**

#### `app/api/jobs/route.ts`
Enhanced the jobs API to support board date filtering:
- Added `boardDate` query parameter (defaults to today in location timezone)
- Applies `filterJobsByBoardDate()` to all fetched jobs
- Logs filtering statistics (boundaries, counts, excluded jobs)
- Returns `boardDate` and `timezone` in API response

**API Usage**:
```typescript
GET /api/jobs?boardDate=2026-02-23
```

#### `app/[locale]/page.tsx` (Today's Board)
Updated the main board page:
- Added `boardDate` state (defaults to today)
- Passes `boardDate` to API call
- Added date picker UI with "Today" quick button
- Displays selected date in user's locale
- Refetches jobs when date changes

**UI Changes**:
- Date picker control in header
- "Today" button to reset to current date
- Date display updates dynamically

#### `app/[locale]/page_clean.tsx`
Applied identical changes to the clean version of the board page.

---

## Configuration

### Timezone Setting

Set your location timezone in environment variables (`.env` or Vercel settings):

```bash
LOCATION_TIMEZONE=America/New_York  # Eastern Time (default)
# or
LOCATION_TIMEZONE=America/Los_Angeles  # Pacific Time
LOCATION_TIMEZONE=America/Chicago      # Central Time
LOCATION_TIMEZONE=America/Denver       # Mountain Time
```

**Note**: All date filtering uses this timezone to determine "today" and day boundaries.

---

## How It Works

### Date Filtering Flow

1. **Frontend**: User selects date (or uses default today)
2. **API Call**: `GET /api/jobs?boardDate=2026-02-23`
3. **Server**:
   - Fetches all jobs from DynamoDB
   - Calculates day boundaries in location timezone:
     - Start: `2026-02-23T05:00:00Z` (midnight EST = 5am UTC)
     - End: `2026-02-24T04:59:59.999Z` (11:59:59 PM EST)
   - Filters jobs using `filterJobsByBoardDate()`
   - Logs stats for debugging
4. **Response**: Returns only jobs for the selected date
5. **Frontend**: Displays filtered jobs in Kanban columns

### Timezone Conversion Example

**Scenario**: Booking at 11:30 PM EST on Feb 23
- Square stores as: `2026-02-24T04:30:00Z` (UTC)
- Our filter converts to EST: `2026-02-23 23:30:00`
- Result: ✅ Included on Feb 23 board

**Scenario**: Booking at 12:15 AM EST on Feb 24
- Square stores as: `2026-02-24T05:15:00Z` (UTC)
- Our filter converts to EST: `2026-02-24 00:15:00`
- Result: ❌ NOT included on Feb 23 board

---

## Testing

### Run Unit Tests

```bash
npx tsx test/board-filter.test.ts
```

**All tests pass** (12/12):
- ✅ Late night booking (11:30 PM) correctly included
- ✅ Early morning booking (12:15 AM next day) correctly excluded
- ✅ Day boundaries calculated correctly
- ✅ SCHEDULED jobs filtered to board date only
- ✅ Active jobs from past kept on board
- ✅ Completed jobs excluded
- ✅ Edge cases (midnight, missing timestamps)

### Manual Testing

1. **Create test bookings** in Square for:
   - Today at various times (should appear)
   - Tomorrow (should NOT appear in Scheduled)
   - Yesterday but checked-in (should appear in Checked In column)

2. **Test date picker**:
   - Change date → jobs refresh
   - Click "Today" → returns to current date
   - Future date → only future scheduled jobs appear

3. **Test timezone boundaries**:
   - Book at 11:59 PM local time → should appear on that day's board
   - Book at 12:01 AM local time → should appear on next day's board

---

## Logging & Debugging

### Server-Side Logs

The API route logs detailed filtering info:

```javascript
[JOBS API] Board date filtering applied {
  boardDate: '2026-02-23',
  timezone: 'America/New_York',
  startBoundary: '2026-02-23T05:00:00.000Z',
  endBoundary: '2026-02-24T04:59:59.999Z',
  totalFetched: 15,
  totalIncluded: 8,
  totalExcluded: 7,
  byStatus: {
    SCHEDULED: 5,
    CHECKED_IN: 2,
    IN_PROGRESS: 1
  }
}
```

### Client-Side Logs

The frontend logs job counts:

```javascript
[TODAY BOARD] Jobs loaded {
  boardDate: '2026-02-23',
  count: 8,
  timezone: 'America/New_York'
}
```

---

## Key Design Decisions

### 1. Server-Side Filtering
**Decision**: Filter jobs in the API route, not just the frontend.
**Rationale**: 
- Single source of truth
- Reduces data transfer
- Easier to debug
- Consistent across all clients

### 2. Preserve Active Jobs
**Decision**: Jobs in CHECKED_IN, IN_PROGRESS, QC_READY from earlier dates stay on today's board.
**Rationale**:
- Prevents jobs from disappearing mid-workflow
- Staff can complete jobs that started yesterday
- Maintains workflow continuity

### 3. Exclude Completed Jobs
**Decision**: WORK_COMPLETED jobs never appear on today's board.
**Rationale**:
- Completed jobs belong to history
- Keeps board focused on active work
- Reduces clutter

### 4. Configurable Timezone
**Decision**: Use environment variable for location timezone.
**Rationale**:
- Works correctly for any location
- No hardcoded timezone assumptions
- Easy to update if business relocates

### 5. Date Picker in UI
**Decision**: Add date picker even though default is "today".
**Rationale**:
- Managers can review past/future days
- Useful for planning
- Flexibility without complexity

---

## Breaking Changes

**None**. The implementation is backward-compatible:
- Existing API calls work (default to today)
- No database schema changes
- No changes to job structure
- Frontend gracefully handles missing `boardDate` param

---

## Performance Considerations

### Current Implementation
- Fetches all jobs from DynamoDB
- Filters in-memory (fast for <100 jobs)
- No additional database queries

### Future Optimization (if needed)
If the job count grows significantly:
1. Add GSI on DynamoDB with `appointmentTime` as sort key
2. Query by date range directly in DynamoDB
3. Filter only for edge cases (active jobs from past)

**Current scale**: Expected <50 jobs per day, filtering is negligible (<1ms).

---

## Summary of Changes

### ✅ What Changed

1. **Installed** `date-fns-tz` for timezone support
2. **Created** timezone utilities (`lib/utils/timezone.ts`)
3. **Created** board filtering utilities (`lib/utils/board-filters.ts`)
4. **Enhanced** jobs API route with date filtering
5. **Updated** Today's Board page with date picker
6. **Added** comprehensive unit tests
7. **Documented** implementation and testing

### 🎯 Key Benefits

- ✅ Scheduled column shows ONLY today's jobs (no future clutter)
- ✅ Timezone-safe (works correctly across DST changes)
- ✅ Active jobs preserved (no mid-workflow disappearances)
- ✅ Flexible date selection (can view past/future days)
- ✅ Well-tested (12/12 tests passing)
- ✅ Production-ready logging and debugging
- ✅ Zero breaking changes

### 🚀 Production Deployment

**Before deploying**, set the timezone in Vercel:
```bash
vercel env add LOCATION_TIMEZONE
# Enter: America/New_York (or your location)
```

Then deploy as usual:
```bash
git add .
git commit -m "feat: Add date filtering to Today's Board"
git push
```

---

## Future Enhancements (Optional)

1. **Polling/Refresh**: Auto-refresh board every 30s to catch new bookings
2. **Date Range View**: Add week view for managers
3. **Yesterday's Carryover**: Highlight jobs from previous day
4. **Timezone Display**: Show current location time in header
5. **Date Presets**: "Yesterday", "Tomorrow" quick buttons

---

## Questions?

- **Q**: What if a job crosses midnight?
  - **A**: It stays on the day it started (scheduled date), not the completion date.

- **Q**: What timezone is used?
  - **A**: Set via `LOCATION_TIMEZONE` env var (default: America/New_York).

- **Q**: Do completed jobs from today appear?
  - **A**: No, completed jobs are excluded from all board views.

- **Q**: Can I view tomorrow's schedule?
  - **A**: Yes, use the date picker to select any date.

---

**Implementation Status**: ✅ Complete and Tested
**Tests Status**: ✅ All Passing (12/12)
**Deployment Status**: 🟡 Ready for Production
