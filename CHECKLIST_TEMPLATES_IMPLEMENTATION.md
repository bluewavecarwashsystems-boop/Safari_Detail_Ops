# Checklist Templates Implementation - Complete Guide

## 📋 Overview

This implementation adds **dynamic checklist templates** to Safari Detail Ops Dashboard. Managers can create and edit TECH and QC checklist templates per service type, which are automatically snapshotted into jobs at check-in time.

### Key Features

- ✅ **Manager-editable templates** for TECH and QC checklists per service
- ✅ **Version tracking** for template changes
- ✅ **Automatic snapshotting** into jobs at check-in
- ✅ **Soft delete** (items are hidden, not removed)
- ✅ **Required flag** for critical items
- ✅ **RBAC enforcement** (Manager-only template editing)
- ✅ **Template isolation** (changes don't affect existing jobs)

---

## 🏗 Architecture

### Database

**New DynamoDB Table:** `safari-detail-ops-{env}-checklist-templates`

**Primary Key:** `templateId` (String) - Format: `{serviceType}#{type}` (e.g., `"Full Detail#TECH"`)

**Schema:**
```typescript
{
  templateId: "Full Detail#TECH",
  serviceType: "Full Detail",
  type: "TECH" | "QC",
  version: 1,
  isActive: true,
  items: [
    {
      id: "uuid",
      label: "Vacuum interior",
      sortOrder: 0,
      isRequired: true,
      isActive: true
    }
  ],
  createdAt: "2026-02-23T...",
  updatedAt: "2026-02-23T...",
  updatedBy: {
    userId: "...",
    name: "Manager Name",
    role: "MANAGER"
  }
}
```

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/services/{serviceType}/templates` | Get TECH and QC templates for a service | Manager |
| POST | `/api/templates/items` | Add item to template | Manager |
| PUT | `/api/templates/items/{itemId}` | Update template item | Manager |
| DELETE | `/api/templates/items/{itemId}` | Soft delete template item | Manager |
| PUT | `/api/templates/reorder` | Reorder template items | Manager |
| POST | `/api/jobs/{jobId}/initialize-checklists` | Snapshot templates into job | Auth |

### Files Created

```
lib/
  types.ts (updated)                  - Added ChecklistTemplate types
  config.ts (updated)                 - Added checklistTemplatesTable config
  services/
    checklist-template-service.ts     - Template CRUD operations

app/api/
  services/[serviceType]/templates/
    route.ts                          - GET templates
  templates/
    items/
      route.ts                        - POST add item
      [itemId]/
        route.ts                      - PUT/DELETE item
    reorder/
      route.ts                        - PUT reorder items
  jobs/[jobId]/initialize-checklists/
    route.ts                          - POST initialize checklists

app/[locale]/settings/checklists/
  page.tsx                            - Manager UI for template editing
```

---

## 🚀 Setup Instructions

### Step 1: Create DynamoDB Table

Run this AWS CLI command to create the checklist templates table:

```powershell
# QA Environment
aws dynamodb create-table `
  --table-name safari-detail-ops-qa-checklist-templates `
  --attribute-definitions AttributeName=templateId,AttributeType=S `
  --key-schema AttributeName=templateId,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --region us-east-1

# Production Environment (when ready)
aws dynamodb create-table `
  --table-name safari-detail-ops-prod-checklist-templates `
  --attribute-definitions AttributeName=templateId,AttributeType=S `
  --key-schema AttributeName=templateId,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --region us-east-1
```

**Verify table creation:**
```powershell
aws dynamodb describe-table `
  --table-name safari-detail-ops-qa-checklist-templates `
  --region us-east-1 `
  --query "Table.[TableName,TableStatus,ItemCount]"
```

### Step 2: Update Environment Variables

Add to `.env` (optional, uses defaults):

```bash
# Checklist Templates Table (defaults to safari-detail-ops-{env}-checklist-templates)
DYNAMODB_CHECKLIST_TEMPLATES_TABLE=checklist-templates
```

The config automatically namespaces it as: `safari-detail-ops-qa-checklist-templates`

### Step 3: Install Dependencies

The implementation uses existing dependencies, but verify you have:

```powershell
npm install uuid @types/uuid
```

### Step 4: Deploy to Vercel (if needed)

Add environment variable to Vercel:

```powershell
vercel env add DYNAMODB_CHECKLIST_TEMPLATES_TABLE
# Enter: checklist-templates
```

Then redeploy:

```powershell
git add -A
git commit -m "feat: Add dynamic checklist templates for Manager control"
git push origin master
```

---

## 📖 Usage Guide

### For Managers: Editing Templates

1. **Navigate to Templates Page:**
   - Go to Settings → Checklist Templates
   - Or directly to: `/settings/checklists`

2. **Select Service Type:**
   - Choose from common service types (Full Detail, Express Detail, etc.)
   - Or enter a custom service type

3. **Edit TECH or QC Templates:**
   - Switch between tabs: **TECH** | **QC**
   - Add items using the input box
   - Edit items inline by clicking the edit icon
   - Mark items as required using the star icon
   - Delete items using the trash icon
   - Items are soft-deleted (hidden, not removed)

4. **Version Tracking:**
   - Each change increments the version number
   - Last update timestamp and user are tracked

### For Techs: Using Checklists on Jobs

**Automatic Initialization:**
- When a job moves to `CHECKED_IN` status, call the initialization endpoint
- Checklists are automatically created from templates
- Changing templates later does NOT affect existing jobs

**Manual Initialization (if needed):**
```powershell
# Example: Initialize checklists for a job
$jobId = "YOUR_JOB_ID"
$serviceType = "Full Detail"

curl http://localhost:3000/api/jobs/$jobId/initialize-checklists `
  -X POST `
  -H "Content-Type: application/json" `
  -H "Cookie: safari_session=YOUR_SESSION_TOKEN" `
  -d "{\"serviceType\": \"$serviceType\"}"
```

---

## 🔒 Security & RBAC

### Permission Matrix

| Action | Manager | Tech | QC |
|--------|---------|------|-----|
| View templates | ✅ | ❌ | ❌ |
| Edit templates | ✅ | ❌ | ❌ |
| Initialize checklists | ✅ | ✅ | ✅ |
| Toggle checklist items | ✅ | ✅ (TECH only) | ✅ (QC only) |

### Enforcement

- **API Level:** All template endpoints use `requireRole([UserRole.MANAGER])`
- **Middleware:** Already enforces authentication on all API routes
- **Client Level:** UI only shows template editor to Managers

---

## 🧪 Testing

### Test 1: Create TECH Template

```powershell
# Login as Manager first and get session token
$sessionToken = "YOUR_SESSION_TOKEN_FROM_BROWSER"

# Add items to TECH checklist for "Full Detail" service
curl http://localhost:3000/api/templates/items `
  -X POST `
  -H "Content-Type: application/json" `
  -H "Cookie: safari_session=$sessionToken" `
  -d '{
    "serviceType": "Full Detail",
    "type": "TECH",
    "label": "Vacuum carpets and seats",
    "isRequired": true
  }'

curl http://localhost:3000/api/templates/items `
  -X POST `
  -H "Content-Type: application/json" `
  -H "Cookie: safari_session=$sessionToken" `
  -d '{
    "serviceType": "Full Detail",
    "type": "TECH",
    "label": "Clean dashboard",
    "isRequired": false
  }'
```

### Test 2: Get Templates

```powershell
curl http://localhost:3000/api/services/Full%20Detail/templates `
  -H "Cookie: safari_session=$sessionToken"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "templates": {
      "TECH": {
        "templateId": "Full Detail#TECH",
        "serviceType": "Full Detail",
        "type": "TECH",
        "version": 2,
        "isActive": true,
        "items": [
          {
            "id": "uuid-1",
            "label": "Vacuum carpets and seats",
            "sortOrder": 0,
            "isRequired": true,
            "isActive": true
          },
          {
            "id": "uuid-2",
            "label": "Clean dashboard",
            "sortOrder": 1,
            "isRequired": false,
            "isActive": true
          }
        ],
        "createdAt": "2026-02-23T...",
        "updatedAt": "2026-02-23T..."
      }
    }
  }
}
```

### Test 3: Update Item

```powershell
$itemId = "uuid-1"  # Replace with actual item ID from Test 2

curl http://localhost:3000/api/templates/items/$itemId `
  -X PUT `
  -H "Content-Type: application/json" `
  -H "Cookie: safari_session=$sessionToken" `
  -d '{
    "serviceType": "Full Detail",
    "type": "TECH",
    "itemId": "'$itemId'",
    "label": "Thoroughly vacuum carpets and seats"
  }'
```

### Test 4: Initialize Job Checklists

```powershell
$jobId = "YOUR_JOB_ID"  # Use a real job ID from your system

curl http://localhost:3000/api/jobs/$jobId/initialize-checklists `
  -X POST `
  -H "Content-Type: application/json" `
  -H "Cookie: safari_session=$sessionToken" `
  -d '{
    "serviceType": "Full Detail"
  }'
```

### Test 5: Verify RBAC

```powershell
# Try to access templates as non-Manager (should fail with 403)
$techSessionToken = "TECH_USER_SESSION_TOKEN"

curl http://localhost:3000/api/services/Full%20Detail/templates `
  -H "Cookie: safari_session=$techSessionToken"
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

### Test 6: UI Testing

1. Login as **Manager**
2. Go to `/settings/checklists`
3. Select "Full Detail" service
4. Add a few TECH items
5. Switch to QC tab
6. Add a few QC items
7. Edit an item inline
8. Mark an item as required (star icon)
9. Delete an item (soft delete)
10. Verify version number increments

---

## 🔄 Integration with Job Workflow

### Recommended Check-In Flow

When a job moves to `CHECKED_IN` status:

1. **Call Initialize Checklists:**
   ```typescript
   await fetch(`/api/jobs/${jobId}/initialize-checklists`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ serviceType: job.serviceType })
   });
   ```

2. **Update Job Status:**
   ```typescript
   await fetch(`/api/jobs/${jobId}`, {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ workStatus: 'CHECKED_IN' })
   });
   ```

### Example: Auto-Initialize on Check-In

Add this to your job status update logic:

```typescript
// In app/api/jobs/[jobId]/route.ts (PATCH handler)
if (body.workStatus === WorkStatus.CHECKED_IN) {
  // Check if checklists need initialization
  const job = await dynamodb.getJob(jobId);
  
  if (!job.checklist || (!job.checklist.tech && !job.checklist.qc)) {
    try {
      // Auto-initialize checklists
      await fetch(`http://localhost:3000/api/jobs/${jobId}/initialize-checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: job.serviceType })
      });
    } catch (error) {
      console.error('Failed to auto-initialize checklists:', error);
      // Continue with status update anyway
    }
  }
}
```

---

## 🎨 Future Enhancements

### Phase 1 (Current) ✅
- ✅ Templates per service + type
- ✅ Add/edit/delete items
- ✅ Required flag
- ✅ Soft delete
- ✅ Version tracking
- ✅ RBAC enforcement

### Phase 2 (Future)
- [ ] **Drag-and-drop reordering** (integrate @dnd-kit/core)
- [ ] **Duplicate templates** across services
- [ ] **Template history/rollback**
- [ ] **Bulk import/export** (JSON/CSV)
- [ ] **Template preview** before applying
- [ ] **Multi-location templates** (when multi-location expansion happens)

### Drag-and-Drop Integration (TODO)

To add drag-and-drop:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Integrate in `app/[locale]/settings/checklists/page.tsx`:

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// ... add DndContext wrapper and call reorder API on drag end
```

---

## 📊 Monitoring & Debugging

### Check Template Data in DynamoDB

```powershell
# List all templates
aws dynamodb scan `
  --table-name safari-detail-ops-qa-checklist-templates `
  --region us-east-1

# Get specific template
aws dynamodb get-item `
  --table-name safari-detail-ops-qa-checklist-templates `
  --key '{"templateId": {"S": "Full Detail#TECH"}}' `
  --region us-east-1
```

### Check Job Checklists

```powershell
# Get job and check checklist field
aws dynamodb get-item `
  --table-name safari-detail-ops-qa-jobs `
  --key '{"jobId": {"S": "YOUR_JOB_ID"}}' `
  --region us-east-1 `
  --query "Item.checklist"
```

### Logs

Check Vercel logs or local console for:
- `[ChecklistInit] Initialized checklists for job...`
- Template CRUD operations
- RBAC enforcement logs

---

## ❓ FAQ

### Q: What happens if I change a template after jobs are created?
**A:** Existing jobs are NOT affected. Only new jobs will use the updated template.

### Q: Can I restore deleted items?
**A:** Yes, items are soft-deleted (isActive=false). You can manually update them in DynamoDB or add a "Restore" feature in the UI.

### Q: Can Techs see templates?
**A:** No, only Managers can view/edit templates. Techs only see the checklist items copied into their jobs.

### Q: What if a service doesn't have templates?
**A:** Empty checklists are created. Managers should create templates BEFORE jobs are checked in.

### Q: Can I have different templates per location?
**A:** Not yet. This is planned for "multi-location expansion" (Phase 2+).

### Q: How do I bulk-create templates?
**A:** Use the POST API in a loop, or manually insert via AWS Console/CLI for now.

---

## 🚨 Troubleshooting

### Issue: "Table does not exist" error

**Solution:** Create the DynamoDB table (see Setup Step 1)

### Issue: 403 Forbidden when accessing templates

**Solution:** Ensure you're logged in as a Manager role

### Issue: Checklists not initializing

**Solution:** 
1. Check job has `serviceType` field
2. Verify templates exist for that service
3. Check that job doesn't already have checklists
4. Review logs for errors

### Issue: Template changes not saving

**Solution:**
1. Check AWS credentials are configured
2. Verify table exists and is accessible
3. Check Vercel environment variables
4. Review CloudWatch logs

---

## 📝 Summary

This implementation provides a complete, production-ready checklist template system with:

- **Manager control** over checklist content
- **Version tracking** for audit trails
- **Template isolation** (no impact on existing jobs)
- **RBAC enforcement** at API and UI levels
- **Scalable architecture** ready for multi-location expansion

The system is **modular**, **type-safe**, and follows existing patterns in your codebase.

---

**Implementation Date:** February 23, 2026  
**Developer:** GitHub Copilot (Claude Sonnet 4.5)  
**Project:** Safari Detail Ops Dashboard  
**Feature:** Dynamic Checklist Templates
