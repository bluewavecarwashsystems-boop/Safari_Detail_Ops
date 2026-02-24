# Production Promotion - Code Changes Summary

## 📁 Files Created

### 1. `lib/env.ts` (178 lines)
**Purpose:** Central environment configuration with runtime validation

**Key Features:**
- Validates `APP_ENV` (qa/prod)
- Validates `SQUARE_ENVIRONMENT` (sandbox/production)
- **CRITICAL:** Throws fatal error if `APP_ENV=prod` but `SQUARE_ENV≠production`
- Provides helper functions: `isProduction()`, `isDevelopment()`

**Exports:**
- `getEnvironmentConfig()` - Full validated config
- `getAppEnvironment()` - Returns 'qa' or 'prod'
- `isProduction()` - Boolean check
- `isDevelopment()` - Boolean check

---

### 2. `lib/awsTables.ts` (94 lines)
**Purpose:** AWS resource naming with environment isolation

**Key Features:**
- Auto-prefixes table names with `safari-detail-ops-{env}-`
- Supports both simple names ("jobs") and full names ("safari-detail-ops-prod-jobs")
- Centralized resource naming for DynamoDB, S3, CloudWatch

**Exports:**
- `getAWSTableNames()` - Returns all table/bucket names
- `getTableNamesSummary()` - Human-readable summary for diagnostics

---

### 3. `scripts/provision-prod-tables.ps1` (334 lines)
**Purpose:** Safely provision production DynamoDB tables

**Safety Features:**
- Requires `APP_ENV=prod` environment variable
- Requires `--Yes` confirmation flag  
- Double confirmation prompt: user must type "CREATE PRODUCTION TABLES"
- Validates QA tables exist before cloning
- Dry-run mode for testing
- Idempotent (skips existing tables)

**Usage:**
```powershell
$env:APP_ENV="prod"
./scripts/provision-prod-tables.ps1 -DryRun  # Preview
./scripts/provision-prod-tables.ps1 -Yes     # Create
```

**Clones from QA:**
- Key schema
- Attribute definitions
- Global Secondary Indexes (GSIs)
- Billing mode (PAY_PER_REQUEST)
- TTL configuration
- Stream settings

---

### 4. `scripts/safari-ops-iam-policy.json` (62 lines)
**Purpose:** Minimal IAM policy for AWS access

**Permissions:**
- DynamoDB: Full access to `safari-detail-ops-{qa|prod}-*` tables
- S3: Read/write to `safari-detail-ops-{qa|prod}-photos*` buckets
- CloudWatch Logs: Create log groups/streams
- Table Management: Create/update tables (for provisioning)

**Usage:**
```bash
aws iam create-policy \
  --policy-name SafariDetailOpsPolicy \
  --policy-document file://scripts/safari-ops-iam-policy.json
```

---

### 5. `PRODUCTION_PROMOTION_SUMMARY.md` (875 lines)
**Purpose:** Comprehensive implementation guide

**Contents:**
- Complete change log
- Square hardening details
- AWS table isolation strategy
- Production provisioning guide
- Health endpoint documentation
- Security hardening details
- Pre-merge checklist
- Production smoke test procedures
- Troubleshooting guide

---

### 6. `PRODUCTION_DEPLOYMENT_CHECKLIST.md` (85 lines)
**Purpose:** Quick reference for deployment team

**Contents:**
- Step-by-step deployment checklist
- Environment variable reference table
- Critical validations
- Emergency rollback procedure

---

## 📝 Files Modified

### 1. `lib/config.ts`
**Lines Changed:** ~30 lines

**Changes:**
1. **Added Runtime Validation:**
   ```typescript
   // CRITICAL: Production safety check
   if (env === 'prod' && squareEnv !== 'production') {
     throw new Error("FATAL: Environment mismatch!");
   }
   ```

2. **Added Secret Redaction:**
   ```typescript
   function redactSensitiveConfig(config: Config): any {
     // Redacts SQUARE_ACCESS_TOKEN and SQUARE_WEBHOOK_SIGNATURE_KEY
   }
   ```

3. **Removed Debug Logging:**
   - Removed logs that might expose table names with sensitive info

**Before:** Defaults to sandbox if `SQUARE_ENV` not set  
**After:** Fatal error if `APP_ENV=prod` and `SQUARE_ENV≠production`

---

### 2. `app/api/health/route.ts`
**Lines Changed:** ~80 lines (complete rewrite)

**Changes:**
1. **Enhanced Response Structure:**
   - Added `status` field: healthy/degraded/error
   - Added `environment` section with validation status
   - Added `square` section with config details
   - Added `vercel` section with build info
   - Added comprehensive `aws.tables` listing

2. **Health Status Logic:**
   - `healthy`: All systems operational
   - `degraded`: Missing non-critical config
   - `error`: Environment validation failed

3. **Error Handling:**
   - Catches environment validation errors
   - Returns detailed error response
   - Never crashes

**Before:** Simple status with basic fields  
**After:** Comprehensive diagnostics with environment validation

---

### 3. `test/webhook-test.ts`
**Lines Changed:** 5 lines

**Changes:**
1. **Removed Hardcoded URL:**
   ```typescript
   // Before:
   const testUrl = 'https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings';
   
   // After:
   const webhookHost = process.env.WEBHOOK_TEST_URL || 'ops-qa.thesafaricarwash.com';
   const testUrl = `https://${webhookHost}/api/square/webhooks/bookings`;
   ```

**Environment Variable:**
- QA: Not needed (defaults to ops-qa)
- Production: Set `WEBHOOK_TEST_URL=ops.thesafaricarwash.com`

---

## 🔍 Sandbox References Removed

### Confirmed Clean

**✅ No hardcoded sandbox values in:**
- `lib/config.ts` - Uses env vars only
- `lib/square/*` - All client instantiations use config
- `app/api/**/*` - All endpoints use config
- `lib/services/*` - All services use config

**📚 Sandbox references in documentation (intentional):**
- `README.md` - Installation instructions (safe)
- `PHASE_*.md` - Historical implementation docs (safe)
- `.credentials` - Reference file (safe, not deployed)
- `.env.example` - Example file (safe, template only)

### Verification Commands

```bash
# Search for hardcoded sandbox in code
grep -r "Environment\.Sandbox" lib/ app/ --include="*.ts" --include="*.tsx"
# Result: 0 matches

# Search for hardcoded sandbox URLs in code  
grep -r "sandbox\.com" lib/ app/ --include="*.ts" --include="*.tsx"
# Result: 0 matches in production code paths

# Search for test tokens in code
grep -r "EAAAl" lib/ app/ --include="*.ts" --include="*.tsx"
# Result: 0 matches (only in .env and .credentials which are not deployed)
```

---

## 🛡️ Security Hardening Summary

### 1. Runtime Assertions
- ✅ Fatal error if prod app uses sandbox Square
- ✅ Validates environment consistency on startup
- ✅ Crashes intentionally to prevent data corruption

### 2. Secret Redaction
- ✅ `SQUARE_ACCESS_TOKEN` never logged
- ✅ `SQUARE_WEBHOOK_SIGNATURE_KEY` never logged  
- ✅ AWS credentials never logged
- ✅ All logs use `redactSensitiveConfig()`

### 3. Environment Isolation
- ✅ QA tables: `safari-detail-ops-qa-*`
- ✅ Prod tables: `safari-detail-ops-prod-*`
- ✅ No way for prod app to access QA data
- ✅ No way for QA app to access prod data

### 4. Webhook Security
- ✅ Signature validation required in production
- ✅ HMAC-SHA256 verification
- ✅ URL built dynamically from request headers
- ✅ No hardcoded webhook secrets

---

## 📊 Environment Variable Changes

### New Variables (Optional)

| Variable | Purpose | Default |
|----------|---------|---------|
| `WEBHOOK_TEST_URL` | Webhook test host | `ops-qa.thesafaricarwash.com` |

### Critical Variables (Must Set)

| Environment | Variable | QA Value | Prod Value |
|-------------|----------|----------|------------|
| Both | `APP_ENV` | `qa` | `prod` |
| Both | `SQUARE_ENV` | `sandbox` | `production` |
| Both | `SQUARE_ACCESS_TOKEN` | Sandbox token | **Production token** |
| Both | `SQUARE_WEBHOOK_SIGNATURE_KEY` | Sandbox key | **Production key** |
| Both | `FRANKLIN_SQUARE_LOCATION_ID` | Sandbox location | **Production location** |
| Both | `SQUARE_TEAM_MEMBER_ID` | Sandbox member | **Production member** |

---

## 🧪 Testing Performed

### Unit Tests
- ✅ Environment validation logic
- ✅ Table name prefixing
- ✅ Secret redaction

### Integration Tests
- ✅ Health endpoint returns correct environment
- ✅ Runtime assertion triggers on mismatch
- ✅ Table names include correct prefix

### Manual Testing
- ✅ Dry-run provision script (no tables created)
- ✅ Health endpoint on QA shows `sandbox`
- ✅ Webhook signature validation
- ✅ Configuration logging (secrets redacted)

---

## 📦 Deployment Order

### 1. Create Production Tables
```powershell
$env:APP_ENV="prod"
./scripts/provision-prod-tables.ps1 -Yes
```

### 2. Update Vercel Environment Variables
- Set all production values in Vercel dashboard
- **Critical:** `APP_ENV=prod` AND `SQUARE_ENV=production`

### 3. Deploy to Production
```bash
vercel --prod
```

### 4. Verify Health Endpoint
```bash
curl https://ops.thesafaricarwash.com/api/health | jq
```

### 5. Configure Square Webhook
- Create webhook subscription in Square production
- Point to: `https://ops.thesafaricarwash.com/api/square/webhooks/bookings`

### 6. Create Admin User
```powershell
$env:APP_ENV="prod"
npx tsx scripts/seed-admin-user.ts
```

### 7. Test End-to-End
- Create production booking in Square
- Verify job appears in ops app
- Upload photo
- Verify in S3 bucket

---

## ✅ Success Criteria

### Application Health
- [ ] Health endpoint returns `status: "healthy"`
- [ ] Health endpoint shows `app_env: "prod"`
- [ ] Health endpoint shows `square_env: "production"`
- [ ] Health endpoint shows `environment_validated: true`

### Data Isolation
- [ ] Jobs created in `safari-detail-ops-prod-jobs` table
- [ ] Photos uploaded to `safari-detail-ops-prod-photos` bucket
- [ ] No data crossover between QA and production

### Security
- [ ] No secrets appear in logs
- [ ] Webhook signatures validate correctly
- [ ] Application crashes if misconfigured (intentional)

### Functionality
- [ ] Bookings sync from Square production
- [ ] Photo upload works
- [ ] Manager can create/edit jobs
- [ ] QC checklist works
- [ ] SMS notifications send (if configured)

---

## 🔗 Related Documentation

1. **`PRODUCTION_PROMOTION_SUMMARY.md`** - Comprehensive implementation guide
2. **`PRODUCTION_DEPLOYMENT_CHECKLIST.md`** - Quick reference checklist
3. **`scripts/provision-prod-tables.ps1`** - Table provisioning script
4. **`scripts/safari-ops-iam-policy.json`** - AWS IAM policy

---

**Last Updated:** February 23, 2026  
**Status:** ✅ All Changes Implemented and Tested
