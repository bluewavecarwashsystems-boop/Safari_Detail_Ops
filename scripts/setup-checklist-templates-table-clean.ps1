# Checklist Templates - AWS DynamoDB Setup Script
# Run this script to create the checklist templates table

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Safari Detail Ops - Checklist Templates" -ForegroundColor Cyan
Write-Host "DynamoDB Table Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get environment
$env = Read-Host "Enter environment (qa/prod) [default: qa]"
if ([string]::IsNullOrWhiteSpace($env)) {
    $env = "qa"
}

if ($env -ne "qa" -and $env -ne "prod") {
    Write-Host "ERROR: Environment must be 'qa' or 'prod'" -ForegroundColor Red
    exit 1
}

$tableName = "safari-detail-ops-$env-checklist-templates"
$region = "us-east-1"

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Environment: $env"
Write-Host "  Table Name: $tableName"
Write-Host "  Region: $region"
Write-Host ""

# Check if AWS CLI is installed
try {
    $awsVersion = aws --version 2>&1 | Out-String
    Write-Host "AWS CLI found: $($awsVersion.Trim())" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Install from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if table already exists
Write-Host "Checking if table already exists..." -ForegroundColor Yellow
try {
    aws dynamodb describe-table --table-name $tableName --region $region 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "WARNING: Table '$tableName' already exists!" -ForegroundColor Yellow
        $overwrite = Read-Host "Do you want to DELETE and recreate it? (yes/no) [default: no]"
        if ($overwrite -eq "yes") {
            Write-Host "Deleting existing table..." -ForegroundColor Red
            aws dynamodb delete-table --table-name $tableName --region $region 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "ERROR: Failed to delete table" -ForegroundColor Red
                exit 1
            }
            Write-Host "Waiting for table deletion..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
        } else {
            Write-Host "Keeping existing table. Setup complete." -ForegroundColor Green
            exit 0
        }
    }
} catch {
    # Table doesn't exist, continue with creation
}

# Create the table
Write-Host "Creating table '$tableName'..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name $tableName `
    --attribute-definitions AttributeName=templateId,AttributeType=S `
    --key-schema AttributeName=templateId,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $region 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create table" -ForegroundColor Red
    exit 1
}

Write-Host "Table created successfully!" -ForegroundColor Green
Write-Host ""

# Wait for table to become active
Write-Host "Waiting for table to become active..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$tableActive = $false

while (-not $tableActive -and $attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempt++
    
    $tableStatus = (aws dynamodb describe-table --table-name $tableName --region $region --query "Table.TableStatus" --output text 2>&1).Trim()
    
    if ($tableStatus -eq "ACTIVE") {
        $tableActive = $true
    } else {
        Write-Host "  Status: $tableStatus (attempt $attempt of $maxAttempts)"
    }
}

if ($tableActive) {
    Write-Host "Table is now active!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Table creation is taking longer than expected" -ForegroundColor Yellow
    Write-Host "Check AWS Console to verify table status" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Restart your development server:"
Write-Host "     npm run dev"
Write-Host ""
Write-Host "  2. Login as Manager and navigate to:"
Write-Host "     /settings/checklists"
Write-Host ""
Write-Host "  3. Create your first checklist template!"
Write-Host ""
Write-Host "Documentation: CHECKLIST_TEMPLATES_IMPLEMENTATION.md" -ForegroundColor Cyan
Write-Host ""
