# AWS Resources - QA vs Production Mapping

## 📊 Database Type

**Amazon DynamoDB** (NoSQL)

---

## 🗄️ DynamoDB Tables

### 1. Jobs Table

| Environment | Table Name | Purpose |
|-------------|------------|---------|
| **QA** | `safari-detail-ops-qa-jobs` | Job tracking, booking sync (QA data) |
| **Production** | `safari-detail-ops-prod-jobs` | Job tracking, booking sync (PRODUCTION data) |

**Schema:**
- **Primary Key:** `pk` (String) - Format: `JOB#<jobId>`
- **GSI:** `bookingId-index` - Lookup jobs by Square booking ID
- **Billing:** PAY_PER_REQUEST
- **Estimated Size:** ~100 items in QA, production starts empty

**Attributes:**
- `pk`, `jobId`, `bookingId`, `customerName`, `customerPhone`, `vehicleYear`, `vehicleMake`, `vehicleModel`, `vehicleColor`, `serviceType`, `appointmentStart`, `appointmentEnd`, `status`, `techAssignee`, `qcRequired`, `qcStatus`, `paymentReceived`, `paymentAmount`, `notes`, `createdAt`, `updatedAt`

---

### 2. Users Table

| Environment | Table Name | Purpose |
|-------------|------------|---------|
| **QA** | `safari-detail-ops-qa-users` | User accounts, auth (QA test users) |
| **Production** | `safari-detail-ops-prod-users` | User accounts, auth (REAL staff) |

**Schema:**
- **Primary Key:** `pk` (String) - Format: `USER#<userId>`
- **GSI:** `email-index` - Lookup users by email
- **Billing:** PAY_PER_REQUEST
- **Estimated Size:** ~5 items in QA, ~10-20 in production

**Attributes:**
- `pk`, `userId`, `email`, `name`, `role`, `passwordHash`, `isActive`, `createdAt`, `updatedAt`

**Roles:**
- `ADMIN` - Full access
- `MANAGER` - Create/edit jobs
- `TECH` - View/update assigned jobs
- `QC` - View/approve QC

---

### 3. Checklist Templates Table

| Environment | Table Name | Purpose |
|-------------|------------|---------|
| **QA** | `safari-detail-ops-qa-checklist-templates` | QC checklist templates (test templates) |
| **Production** | `safari-detail-ops-prod-checklist-templates` | QC checklist templates (REAL templates) |

**Schema:**
- **Primary Key:** `pk` (String) - Format: `TEMPLATE#<serviceType>#<checklistType>`
- **Billing:** PAY_PER_REQUEST
- **Estimated Size:** ~10 items in QA, ~10 in production (same templates)

**Attributes:**
- `pk`, `templateId`, `serviceType`, `checklistType`, `items`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

---

## 🪣 S3 Buckets

### Photos Bucket

| Environment | Bucket Name | Purpose |
|-------------|-------------|---------|
| **QA** | `safari-detail-ops-qa-photos-<account-id>` | Job photos (test photos) |
| **Production** | `safari-detail-ops-prod-photos-<account-id>` | Job photos (REAL customer photos) |

**Configuration:**
- **Region:** us-east-1
- **Versioning:** Disabled
- **Encryption:** AES-256 (server-side)
- **CORS:** Enabled for direct uploads
- **Lifecycle:** None (photos retained indefinitely)

**Folder Structure:**
```
<bucket-name>/
  jobs/
    <jobId>/
      <timestamp>_<filename>.jpg
      <timestamp>_<filename>.jpg
```

---

## 📝 CloudWatch Log Groups

| Environment | Log Group | Purpose |
|-------------|-----------|---------|
| **QA** | `/aws/lambda/safari-detail-ops-qa` | Application logs |
| **Production** | `/aws/lambda/safari-detail-ops-prod` | Application logs |

**Note:** Safari Detail Ops runs on Vercel (not Lambda), but this naming is reserved for future use.

---

## 🔐 IAM Policy

**Policy Name:** `SafariDetailOpsPolicy`  
**Policy File:** `scripts/safari-ops-iam-policy.json`

**Permissions:**
- ✅ DynamoDB: Full access to both QA and prod tables
- ✅ S3: Full access to both QA and prod buckets
- ✅ CloudWatch: Create/write logs
- ✅ DynamoDB Admin: Create/update tables (for provisioning)

**Attached To:**
- IAM User: `safari-ops-deployer` (or your CI/CD user)

---

## 📊 Environment Variable Mapping

### How Table Names are Resolved

**In Vercel Environment Variables:**
```bash
# QA Preview
APP_ENV=qa
DYNAMODB_JOBS_TABLE=jobs
# Resolves to: safari-detail-ops-qa-jobs

# Production
APP_ENV=prod
DYNAMODB_JOBS_TABLE=jobs
# Resolves to: safari-detail-ops-prod-jobs
```

**Code Implementation:**
```typescript
// lib/config.ts
const prefix = `safari-detail-ops-${env}`;
const jobsTable = `${prefix}-${process.env.DYNAMODB_JOBS_TABLE || 'jobs'}`;
// QA: safari-detail-ops-qa-jobs
// Prod: safari-detail-ops-prod-jobs
```

---

## 🔄 Data Migration Notes

### QA → Production

**DO NOT copy data from QA to Production!**

Reason:
- QA contains test bookings and fake customer data
- Production should start empty and populate from real Square bookings
- Users table: Create fresh admin user in production via seed script

**Correct Approach:**
1. ✅ Provision production tables (schema only, no data)
2. ✅ Create admin user in production
3. ✅ Configure Square webhook for production
4. ✅ Let production sync real bookings from Square

---

## 🧪 Verification Commands

### List All Tables

```bash
# List QA tables
aws dynamodb list-tables --region us-east-1 | grep "safari-detail-ops-qa"

# List Production tables  
aws dynamodb list-tables --region us-east-1 | grep "safari-detail-ops-prod"
```

### Describe Table

```bash
# QA jobs table
aws dynamodb describe-table \
  --table-name safari-detail-ops-qa-jobs \
  --region us-east-1

# Production jobs table
aws dynamodb describe-table \
  --table-name safari-detail-ops-prod-jobs \
  --region us-east-1
```

### Scan Table (Check Data)

```bash
# QA jobs (should have test data)
aws dynamodb scan \
  --table-name safari-detail-ops-qa-jobs \
  --limit 5 \
  --region us-east-1

# Production jobs (should be empty initially)
aws dynamodb scan \
  --table-name safari-detail-ops-prod-jobs \
  --limit 5 \
  --region us-east-1
```

### List S3 Buckets

```bash
# List all Safari Ops buckets
aws s3 ls | grep safari-detail-ops

# Expected output:
# safari-detail-ops-qa-photos-402562447563
# safari-detail-ops-prod-photos-402562447563
```

---

## 📋 Table Creation Status

### QA Tables (Already Exist)

- ✅ `safari-detail-ops-qa-jobs`
- ✅ `safari-detail-ops-qa-users`
- ✅ `safari-detail-ops-qa-checklist-templates`
- ✅ `safari-detail-ops-qa-photos-<account>` (S3)

### Production Tables (To Be Created)

- ⏳ `safari-detail-ops-prod-jobs` - Create with provision script
- ⏳ `safari-detail-ops-prod-users` - Create with provision script
- ⏳ `safari-detail-ops-prod-checklist-templates` - Create with provision script
- ⏳ `safari-detail-ops-prod-photos-<account>` (S3) - Create manually or via script

**How to Create:**
```powershell
$env:APP_ENV="prod"
./scripts/provision-prod-tables.ps1 -Yes
```

---

## 🔒 Isolation Verification

### Test 1: Health Endpoint Shows Correct Tables

**QA:**
```bash
curl https://ops-qa.thesafaricarwash.com/api/health | jq '.aws.tables'
```
**Expected:**
```json
{
  "DynamoDB Jobs": "safari-detail-ops-qa-jobs",
  "DynamoDB Users": "safari-detail-ops-qa-users",
  "DynamoDB Checklist Templates": "safari-detail-ops-qa-checklist-templates",
  "S3 Photos Bucket": "safari-detail-ops-qa-photos"
}
```

**Production:**
```bash
curl https://ops.thesafaricarwash.com/api/health | jq '.aws.tables'
```
**Expected:**
```json
{
  "DynamoDB Jobs": "safari-detail-ops-prod-jobs",
  "DynamoDB Users": "safari-detail-ops-prod-users",
  "DynamoDB Checklist Templates": "safari-detail-ops-prod-checklist-templates",
  "S3 Photos Bucket": "safari-detail-ops-prod-photos"
}
```

### Test 2: Create Job Only Writes to Correct Table

**QA:**
1. Create booking in Square sandbox
2. Webhook triggers, job created
3. Verify job in `safari-detail-ops-qa-jobs` only

**Production:**
1. Create booking in Square production
2. Webhook triggers, job created
3. Verify job in `safari-detail-ops-prod-jobs` only
4. Verify NO data in QA tables

---

## 💰 Cost Estimate

### DynamoDB

**Billing Mode:** PAY_PER_REQUEST (on-demand)

**Expected Monthly Costs:**
- QA: $0-5/month (light testing)
- Production: $5-20/month (depends on booking volume)
- Combined: ~$25/month maximum

### S3

**Storage:** Depends on photo count/size

**Expected Monthly Costs:**
- QA: $0-2/month (test photos)
- Production: $2-10/month (depends on booking volume)
- Combined: ~$12/month maximum

**Total AWS Cost: ~$37/month maximum**

---

## 📞 Support Resources

- **AWS Console:** https://console.aws.amazon.com
- **DynamoDB Console:** https://console.aws.amazon.com/dynamodb
- **S3 Console:** https://s3.console.aws.amazon.com
- **IAM Console:** https://console.aws.amazon.com/iam
- **Health Endpoints:**
  - QA: https://ops-qa.thesafaricarwash.com/api/health
  - Prod: https://ops.thesafaricarwash.com/api/health

---

**Last Updated:** February 23, 2026  
**Status:** QA tables exist ✅ | Production tables pending creation ⏳
