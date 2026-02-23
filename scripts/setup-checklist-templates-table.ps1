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
    Write-Host "❌ Error: Environment must be 'qa' or 'prod'" -ForegroundColor Red
    exit 1
}

$tableName = "safari-detail-ops-$env-checklist-templates"
$region = "us-east-1"

Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  Environment: $env" -ForegroundColor Gray
Write-Host "  Table Name: $tableName" -ForegroundColor Gray
Write-Host "  Region: $region" -ForegroundColor Gray
Write-Host ""

# Check if AWS CLI is installed
$awsVersion = aws --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: AWS CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "   Install from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ AWS CLI found: $awsVersion" -ForegroundColor Green
Write-Host ""

# Check if table already exists
Write-Host "🔍 Checking if table already exists..." -ForegroundColor Yellow
$existingTable = aws dynamodb describe-table --table-name $tableName --region $region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  Table '$tableName' already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to DELETE and recreate it? (yes/no) [default: no]"
    if ($overwrite -eq "yes") {
        Write-Host "🗑️  Deleting existing table..." -ForegroundColor Red
        aws dynamodb delete-table --table-name $tableName --region $region
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Error: Failed to delete table" -ForegroundColor Red
            exit 1
        }
        Write-Host "⏳ Waiting for table deletion..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    } else {
        Write-Host "✅ Keeping existing table. Setup complete." -ForegroundColor Green
        exit 0
    }
}

# Create the table
Write-Host "🔨 Creating table '$tableName'..." -ForegroundColor Yellow
$createResult = aws dynamodb create-table `
    --table-name $tableName `
    --attribute-definitions AttributeName=templateId,AttributeType=S `
    --key-schema AttributeName=templateId,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $region 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Failed to create table" -ForegroundColor Red
    Write-Host $createResult -ForegroundColor Red
    exit 1
}

Write-Host "✅ Table created successfully!" -ForegroundColor Green
Write-Host ""

# Wait for table to be active
Write-Host "⏳ Waiting for table to become active..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$isActive = $false

while ($attempt -lt $maxAttempts -and -not $isActive) {
    Start-Sleep -Seconds 2
    $tableStatus = aws dynamodb describe-table --table-name $tableName --region $region --query "Table.TableStatus" --output text 2>&1
    if ($tableStatus -eq "ACTIVE") {
        $isActive = $true
    } else {
        Write-Host "  Status: $tableStatus (attempt $($attempt + 1)/$maxAttempts)" -ForegroundColor Gray
    }
    $attempt++
}

if (-not $isActive) {
    Write-Host "⚠️  Warning: Table creation timed out, but it may still be in progress" -ForegroundColor Yellow
} else {
    Write-Host "✅ Table is now active!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Update .env with:" -ForegroundColor Gray
Write-Host "     DYNAMODB_CHECKLIST_TEMPLATES_TABLE=checklist-templates" -ForegroundColor White
Write-Host ""
Write-Host "  2. Restart your development server:" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  3. Login as Manager and navigate to:" -ForegroundColor Gray
Write-Host "     /settings/checklists" -ForegroundColor White
Write-Host ""
Write-Host "  4. Create your first checklist template!" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation: CHECKLIST_TEMPLATES_IMPLEMENTATION.md" -ForegroundColor Cyan
Write-Host ""
