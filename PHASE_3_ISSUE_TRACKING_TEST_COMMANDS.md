# Phase 3 Issue Tracking - Manual Test Commands

## Prerequisites
```bash
# Ensure server is running
npm run dev

# Have a MANAGER auth token ready
# Get from login: POST /api/auth/login
```

## Test Sequence

### 1. Create Test Job and Move to WORK_COMPLETED

```bash
# Get a job ID from your system (or create one)
export JOB_ID="your-job-id-here"

# Move job through workflow to WORK_COMPLETED
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session-cookie" \
  -d '{"workStatus": "WORK_COMPLETED"}'
```

**Expected Result**: Job moves to WORK_COMPLETED status

---

### 2. Test Backward Movement Prevention ❌

```bash
# Try to move WORK_COMPLETED job back to QC_READY
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session-cookie" \
  -d '{"workStatus": "QC_READY"}'
```

**Expected Result**:
```json
{
  "error": "Completed jobs cannot be moved backward. Use post-completion issues instead."
}
```
**Status Code**: 400

---

### 3. Open Post-Completion Issue (as MANAGER) ✅

```bash
# Open a QC_MISS issue
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session-cookie" \
  -d '{
    "openPostCompletionIssue": {
      "type": "QC_MISS",
      "notes": "Missed spot on driver side windshield near mirror"
    }
  }'
```

**Expected Result**:
```json
{
  "id": "job_...",
  "workStatus": "WORK_COMPLETED",
  "postCompletionIssue": {
    "isOpen": true,
    "type": "QC_MISS",
    "notes": "Missed spot on driver side windshield near mirror",
    "openedAt": "2025-01-20T...",
    "openedBy": {
      "userId": "user_...",
      "name": "Manager Name",
      "role": "MANAGER"
    }
  },
  "statusHistory": [
    {
      "from": null,
      "to": null,
      "event": "POST_COMPLETION_ISSUE_OPENED",
      "changedBy": {...},
      "changedAt": "2025-01-20T...",
      "reason": "Missed spot on driver side windshield near mirror"
    }
  ]
}
```

---

### 4. Try Opening Issue as Non-MANAGER ❌

```bash
# Try with TECH or QC role session
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-tech-session-cookie" \
  -d '{
    "openPostCompletionIssue": {
      "type": "QC_MISS",
      "notes": "Another issue"
    }
  }'
```

**Expected Result**:
```json
{
  "error": "Only MANAGER role can open post-completion issues"
}
```
**Status Code**: 400

---

### 5. Try Opening Duplicate Issue ❌

```bash
# Try to open another issue when one already exists
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session-cookie" \
  -d '{
    "openPostCompletionIssue": {
      "type": "DAMAGE",
      "notes": "Different issue"
    }
  }'
```

**Expected Result**:
```json
{
  "error": "Job already has an open issue. Resolve it before opening a new one."
}
```
**Status Code**: 400

---

### 6. Resolve Post-Completion Issue ✅

```bash
# Resolve the open issue
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session-cookie" \
  -d '{"resolvePostCompletionIssue": true}'
```

**Expected Result**:
```json
{
  "id": "job_...",
  "workStatus": "WORK_COMPLETED",
  "postCompletionIssue": {
    "isOpen": false,
    "type": "QC_MISS",
    "notes": "Missed spot on driver side windshield near mirror",
    "openedAt": "2025-01-20T...",
    "openedBy": {...},
    "resolvedAt": "2025-01-20T...",
    "resolvedBy": {
      "userId": "user_...",
      "name": "Manager Name",
      "role": "MANAGER"
    }
  },
  "statusHistory": [
    {...},
    {
      "from": null,
      "to": null,
      "event": "POST_COMPLETION_ISSUE_RESOLVED",
      "changedBy": {...},
      "changedAt": "2025-01-20T..."
    }
  ]
}
```

---

### 7. Try Resolving Non-Existent Issue ❌

```bash
# Try to resolve when no open issue exists
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session-cookie" \
  -d '{"resolvePostCompletionIssue": true}'
```

**Expected Result**:
```json
{
  "error": "No open issue to resolve"
}
```
**Status Code**: 400

---

## UI Testing Checklist

### Today Board (`/`)

1. **Before Issue Opened**:
   - [ ] Job card has normal gray border
   - [ ] No issue badge visible

2. **After Issue Opened**:
   - [ ] Job card has red border (`border-red-400`)
   - [ ] Issue badge shows "⚠ Issue Open"
   - [ ] Badge has red background (`bg-red-100 text-red-800`)

3. **After Issue Resolved**:
   - [ ] Badge updates to show resolved state
   - [ ] Border changes to normal

### Job Detail Page (`/jobs/[jobId]`)

#### Before Job is WORK_COMPLETED
- [ ] Issue section NOT visible

#### After Job is WORK_COMPLETED (No Issue)
- [ ] Issue section visible
- [ ] "Report Issue" button displayed
- [ ] Click button opens modal

#### Issue Modal
- [ ] Modal has backdrop overlay
- [ ] Dropdown shows all 5 issue types:
  - QC_MISS
  - CUSTOMER_COMPLAINT
  - DAMAGE
  - REDO
  - OTHER
- [ ] Notes textarea allows input
- [ ] Cancel button closes modal
- [ ] Submit button submits and closes modal
- [ ] Success toast appears after submit
- [ ] Buttons disabled during submission

#### After Issue Opened
- [ ] Issue card appears with red border
- [ ] Issue type displayed (formatted with spaces)
- [ ] "OPEN" badge visible (red background)
- [ ] Notes displayed
- [ ] Metadata shows:
  - Opened by: [Manager Name]
  - Opened at: [Timestamp]
- [ ] "Mark Issue Resolved" button visible

#### After Issue Resolved
- [ ] Issue card has green border
- [ ] "RESOLVED" badge visible (green background)
- [ ] Resolution metadata shows:
  - Resolved by: [Manager Name]
  - Resolved at: [Timestamp]
- [ ] "Mark Issue Resolved" button hidden

---

## Test Issue Types

### QC_MISS
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "QC_MISS",
      "notes": "Missed cleaning dashboard vents"
    }
  }'
```

### CUSTOMER_COMPLAINT
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "CUSTOMER_COMPLAINT",
      "notes": "Customer reported water spots still visible"
    }
  }'
```

### DAMAGE
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "DAMAGE",
      "notes": "Tech accidentally scratched paint near door handle"
    }
  }'
```

### REDO
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "REDO",
      "notes": "Entire job needs to be redone due to wrong products used"
    }
  }'
```

### OTHER
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "OTHER",
      "notes": "Customer vehicle towed before job completion"
    }
  }'
```

---

## Status History Verification

```bash
# Fetch job and inspect statusHistory
curl "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Cookie: session=your-session-cookie"
```

**Verify statusHistory contains**:
1. Entry with `event: "STATUS_CHANGE"` for each status transition
2. Entry with `event: "POST_COMPLETION_ISSUE_OPENED"` when issue opened
3. Entry with `event: "POST_COMPLETION_ISSUE_RESOLVED"` when issue resolved
4. Each entry has:
   - `changedBy` (userId, name, role)
   - `changedAt` (ISO timestamp)
   - `from`/`to` (for status changes)
   - `reason` (optional)

---

## Edge Cases to Test

### 1. Missing Notes (Should Work)
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "QC_MISS"
    }
  }'
```
✅ Should succeed (notes are optional)

### 2. Invalid Issue Type
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "INVALID_TYPE"
    }
  }'
```
❌ Should fail with "Invalid issue type"

### 3. Empty Notes String
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "OTHER",
      "notes": ""
    }
  }'
```
✅ Should succeed (empty string is valid)

### 4. Very Long Notes (1000+ characters)
```bash
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{
    "openPostCompletionIssue": {
      "type": "OTHER",
      "notes": "'"$(python3 -c "print('A' * 1000)")"'"
    }
  }'
```
✅ Should succeed (no length limit enforced)

---

## Performance Testing

### Concurrent Issue Operations
```bash
# Terminal 1: Open issue
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{"openPostCompletionIssue": {"type": "QC_MISS"}}' &

# Terminal 2: Try to open another immediately
curl -X PATCH "http://localhost:3000/api/jobs/$JOB_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-manager-session" \
  -d '{"openPostCompletionIssue": {"type": "DAMAGE"}}' &

wait
```
**Expected**: One succeeds, one fails with "already has an open issue"

---

## Cleanup

```bash
# To reset a job for retesting, delete the postCompletionIssue manually in DynamoDB
# or create a new job for testing
```

---

## Success Criteria

✅ All backward movement attempts from WORK_COMPLETED fail  
✅ Only MANAGER can open/resolve issues  
✅ Issue lifecycle (open → resolve) works correctly  
✅ Status history captures all events  
✅ UI updates reflect backend state  
✅ Toast notifications appear on success/failure  
✅ Modal UX is intuitive and responsive  
✅ No TypeScript or compilation errors
