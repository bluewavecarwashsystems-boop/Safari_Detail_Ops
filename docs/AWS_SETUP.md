# AWS Resource Setup for Safari Detail Ops

This document describes the AWS resources required for the Safari Detail Ops project.

## ⚠️ IMPORTANT: Project Isolation

This AWS account hosts multiple projects. All resources MUST use the namespace:
```
safari-detail-ops-<env>-<resource>
```

Where `<env>` is either `qa` or `prod`.

## Required AWS Resources

### 1. DynamoDB Table - Jobs

**QA Environment:**
- Table Name: `safari-detail-ops-qa-jobs`
- Partition Key: `jobId` (String)
- Billing Mode: PAY_PER_REQUEST (on-demand)
- Point-in-Time Recovery: Disabled (for QA)
- Encryption: AWS owned key

**PROD Environment:**
- Table Name: `safari-detail-ops-prod-jobs`
- Partition Key: `jobId` (String)
- Billing Mode: PAY_PER_REQUEST (on-demand)
- Point-in-Time Recovery: Enabled
- Encryption: AWS managed key (aws/dynamodb)

**Global Secondary Indexes (Optional - for future optimization):**
- Index Name: `bookingId-index`
  - Partition Key: `bookingId` (String)
  - Projection: ALL

### 2. S3 Bucket - Photos

**QA Environment:**
- Bucket Name: `safari-detail-ops-qa-photos`
- Region: us-east-1
- Versioning: Disabled
- Encryption: AES-256
- Public Access: Block all public access
- Lifecycle Policy: Delete objects after 30 days

**PROD Environment:**
- Bucket Name: `safari-detail-ops-prod-photos`
- Region: us-east-1
- Versioning: Enabled
- Encryption: AES-256
- Public Access: Block all public access
- Lifecycle Policy: Move to Glacier after 90 days

**Folder Structure:**
```
jobs/
  {jobId}/
    photos/
      {timestamp}-{filename}
```

### 3. CloudWatch Log Group

**QA Environment:**
- Log Group: `/aws/lambda/safari-detail-ops-qa`
- Retention: 7 days

**PROD Environment:**
- Log Group: `/aws/lambda/safari-detail-ops-prod`
- Retention: 30 days

### 4. IAM Role & Policies

**Role Name:** `safari-detail-ops-<env>-execution-role`

**Trust Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Inline Policy - DynamoDB Access:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/safari-detail-ops-<env>-*"
      ]
    }
  ]
}
```

**Inline Policy - S3 Access:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::safari-detail-ops-<env>-*",
        "arn:aws:s3:::safari-detail-ops-<env>-*/*"
      ]
    }
  ]
}
```

**Managed Policies:**
- `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`

## Setup Commands

### Create DynamoDB Table (QA)

```bash
aws dynamodb create-table \
  --table-name safari-detail-ops-qa-jobs \
  --attribute-definitions \
    AttributeName=jobId,AttributeType=S \
  --key-schema \
    AttributeName=jobId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Create DynamoDB Table (PROD)

```bash
aws dynamodb create-table \
  --table-name safari-detail-ops-prod-jobs \
  --attribute-definitions \
    AttributeName=jobId,AttributeType=S \
  --key-schema \
    AttributeName=jobId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --point-in-time-recovery-enabled \
  --region us-east-1
```

### Create S3 Bucket (QA)

```bash
aws s3api create-bucket \
  --bucket safari-detail-ops-qa-photos \
  --region us-east-1

aws s3api put-public-access-block \
  --bucket safari-detail-ops-qa-photos \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption \
  --bucket safari-detail-ops-qa-photos \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

### Create S3 Bucket (PROD)

```bash
aws s3api create-bucket \
  --bucket safari-detail-ops-prod-photos \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket safari-detail-ops-prod-photos \
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block \
  --bucket safari-detail-ops-prod-photos \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption \
  --bucket safari-detail-ops-prod-photos \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

## Verification

After creating resources, verify they exist:

```bash
# Verify DynamoDB table
aws dynamodb describe-table --table-name safari-detail-ops-qa-jobs --region us-east-1

# Verify S3 bucket
aws s3 ls | grep safari-detail-ops-qa-photos

# List all Safari Detail Ops resources
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=safari-detail-ops
```

## Cost Estimates

**QA Environment (Monthly):**
- DynamoDB: ~$5-10 (assuming low traffic)
- S3: ~$1-3 (assuming < 1GB storage)
- CloudWatch Logs: ~$1
- **Total: ~$7-14/month**

**PROD Environment (Monthly):**
- DynamoDB: ~$10-25 (depends on traffic)
- S3: ~$3-10 (depends on photo volume)
- CloudWatch Logs: ~$2-5
- **Total: ~$15-40/month**

## Tags (Recommended)

Add these tags to all resources for cost tracking:

```json
{
  "Project": "safari-detail-ops",
  "Environment": "qa|prod",
  "ManagedBy": "terraform|manual",
  "CostCenter": "safari-operations"
}
```

## Next Steps

1. Review this document and confirm resource names
2. Execute setup commands in QA environment first
3. Test application with QA resources
4. Once verified, create PROD resources
5. Update environment variables in Vercel with resource names
6. Deploy application
