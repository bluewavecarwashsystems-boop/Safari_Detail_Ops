# AWS Resources Created - QA Environment

This document tracks the AWS resources that have been created for the Safari Detail Ops QA environment.

## Created on: February 5, 2026

### DynamoDB Table
- **Name:** `safari-detail-ops-qa-jobs`
- **Status:** ACTIVE
- **ARN:** `arn:aws:dynamodb:us-east-1:402562447563:table/safari-detail-ops-qa-jobs`
- **Account:** 402562447563
- **Partition Key:** `jobId` (String)
- **Billing Mode:** PAY_PER_REQUEST (on-demand)
- **Region:** us-east-1

### S3 Bucket
- **Name:** `safari-detail-ops-qa-photos-402562447563`
- **Status:** Active
- **ARN:** `arn:aws:s3:::safari-detail-ops-qa-photos-402562447563`
- **Account:** 402562447563
- **Region:** us-east-1
- **Encryption:** AES-256
- **Public Access:** Blocked (all)
- **Versioning:** Disabled (QA environment)

### Security Configuration
- ✓ Public access blocked on S3 bucket
- ✓ Encryption enabled (AES-256)
- ✓ Resources isolated with project namespace

## Integration Tests

All Phase C integration tests passed:
- ✓ DynamoDB create, read, update, delete operations
- ✓ S3 photo upload and download operations
- ✓ Pre-signed URL generation
- ✓ Job service layer operations

Run tests with:
```bash
npm run test:integration
```

## Next Steps

1. **Deploy to Vercel QA**
   - Update Vercel environment variables with AWS region
   - AWS credentials will be provided via Vercel environment

2. **Configure Square Webhooks**
   - Set webhook URL: `https://ops-qa.thesafaricarwash.com/api/square/webhooks/bookings`
   - Add webhook signature key to Vercel environment

3. **Test End-to-End**
   - Create test booking in Square
   - Verify webhook creates job in DynamoDB
   - Test job management APIs
   - Upload photos via API

## Production Resources (NOT YET CREATED)

When ready for production:
- DynamoDB: `safari-detail-ops-prod-jobs`
- S3: `safari-detail-ops-prod-photos`
- Same configuration with production-level settings (backups, versioning)

See [docs/AWS_SETUP.md](AWS_SETUP.md) for detailed setup instructions.
