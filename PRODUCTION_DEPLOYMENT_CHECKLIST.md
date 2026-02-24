# Production Deployment - Quick Reference

## 🚀 Pre-Deployment Checklist

### 1. Provision Production Tables

```powershell
$env:APP_ENV="prod"
./scripts/provision-prod-tables.ps1 -DryRun  # Preview first
./scripts/provision-prod-tables.ps1 -Yes     # Create tables
```

### 2. Configure Vercel Production Environment

**Vercel Dashboard → Settings → Environment Variables → Production**

| Variable | Value | Notes |
|----------|-------|-------|
| `APP_ENV` | `prod` | ⚠️ REQUIRED |
| `SQUARE_ENV` | `production` | ⚠️ MUST be "production" |
| `SQUARE_ACCESS_TOKEN` | `<prod-token>` | From Square production dashboard |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | `<prod-key>` | From Square webhook settings |
| `FRANKLIN_SQUARE_LOCATION_ID` | `<prod-location>` | Production location ID |
| `SQUARE_TEAM_MEMBER_ID` | `<prod-member>` | Production team member |
| `DYNAMODB_JOBS_TABLE` | `jobs` | Auto-prefixed |
| `DYNAMODB_USERS_TABLE` | `users` | Auto-prefixed |
| `DYNAMODB_CHECKLIST_TEMPLATES_TABLE` | `checklist-templates` | Auto-prefixed |
| `S3_PHOTOS_BUCKET` | `photos` | Auto-prefixed |
| `AWS_REGION` | `us-east-1` | |
| `AWS_ACCESS_KEY_ID` | `<key>` | From IAM user |
| `AWS_SECRET_ACCESS_KEY` | `<secret>` | From IAM user |

### 3. Deploy to Production

```bash
vercel --prod
```

### 4. Verify Deployment

```bash
# Should return: app_env=prod, square_env=production, environment_validated=true
curl https://ops.thesafaricarwash.com/api/health | jq
```

### 5. Configure Square Webhook

1. Go to Square Production Dashboard → Webhooks
2. Create subscription:
   - **URL:** `https://ops.thesafaricarwash.com/api/square/webhooks/bookings`
   - **Events:** `booking.created`, `booking.updated`
3. Copy signature key → Update Vercel `SQUARE_WEBHOOK_SIGNATURE_KEY`

### 6. Create Admin User

```powershell
$env:APP_ENV="prod"
npx tsx scripts/seed-admin-user.ts
```

---

## ⚠️ Critical Validations

### Before Going Live

- [ ] Health endpoint returns `environment_validated: true`
- [ ] Health endpoint shows `app_env: "prod"` and `square_env: "production"`
- [ ] All table names show `safari-detail-ops-prod-*` prefix
- [ ] Square webhook signature validates successfully
- [ ] Test booking creates job in production DynamoDB table
- [ ] Photo upload works to production S3 bucket

---

## 🚨 Emergency Rollback

If critical issue found:

1. **Immediate:** Revert Vercel deployment
   ```bash
   vercel rollback
   ```

2. **DNS:** Point `ops.thesafaricarwash.com` back to QA temporarily

3. **Square:** Disable production webhook subscription

4. **Notify:** Alert team of rollback

---

## 📞 Support

- **Documentation:** `PRODUCTION_PROMOTION_SUMMARY.md`
- **Logs:** Vercel Dashboard → Deployments → View Logs
- **Health Check:** `https://ops.thesafaricarwash.com/api/health`
