#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Provision Production DynamoDB Tables for Safari Detail Ops
    
.DESCRIPTION
    This script creates production DynamoDB tables by cloning the structure
    from QA tables. Ensures complete environment isolation.
    
    SAFETY FEATURES:
    - Requires APP_ENV=prod environment variable
    - Requires explicit --yes confirmation flag
    - Double confirmation prompt before creating tables
    - Validates QA tables exist before attempting replication
    - Dry-run mode available for testing
    
.PARAMETER DryRun
    Preview actions without creating tables
    
.PARAMETER Yes
    Skip confirmation prompts (use with caution)
    
.EXAMPLE
    # Dry run to preview actions
    $env:APP_ENV="prod"; ./scripts/provision-prod-tables.ps1 -DryRun
    
.EXAMPLE
    # Create production tables (requires confirmation)
    $env:APP_ENV="prod"; ./scripts/provision-prod-tables.ps1 -Yes
#>

param(
    [switch]$DryRun,
    [switch]$Yes,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$region = "us-east-1"
$qaPrefix = "safari-detail-ops-qa"
$prodPrefix = "safari-detail-ops-prod"

# Table definitions
$tables = @(
    @{
        Name = "jobs"
        QATable = "$qaPrefix-jobs"
        ProdTable = "$prodPrefix-jobs"
    },
    @{
        Name = "users"
        QATable = "$qaPrefix-users"
        ProdTable = "$prodPrefix-users"
    },
    @{
        Name = "checklist-templates"
        QATable = "$qaPrefix-checklist-templates"
        ProdTable = "$prodPrefix-checklist-templates"
    }
)

# Colors for output
function Write-Header($message) { Write-Host "`n$message`n" -ForegroundColor Cyan }
function Write-Success($message) { Write-Host "[OK] $message" -ForegroundColor Green }
function Write-Warning($message) { Write-Host "[WARNING] $message" -ForegroundColor Yellow }
function Write-Error($message) { Write-Host "[ERROR] $message" -ForegroundColor Red }
function Write-Info($message) { Write-Host "  $message" -ForegroundColor Gray }

Write-Header "================================================================"
Write-Header "  Safari Detail Ops - Production Table Provisioning"
Write-Header "================================================================"

# SAFETY CHECK 1: Verify APP_ENV=prod
Write-Header "Safety Check 1: Environment Validation"
$appEnv = $env:APP_ENV
if ($appEnv -ne "prod") {
    Write-Error "SAFETY ABORT: APP_ENV must be set to 'prod'"
    Write-Info "Current APP_ENV: $appEnv"
    Write-Info "Set environment variable: `$env:APP_ENV='prod'"
    exit 1
}
Write-Success "Environment validated: APP_ENV=$appEnv"

# SAFETY CHECK 2: Verify --yes flag
Write-Header "Safety Check 2: Confirmation Flag"
if (-not $Yes -and -not $DryRun) {
    Write-Error "SAFETY ABORT: --Yes flag required for production provisioning"
    Write-Info "This is a safety measure to prevent accidental execution"
    Write-Info "Run with: ./scripts/provision-prod-tables.ps1 -Yes"
    Write-Info "Or preview with: ./scripts/provision-prod-tables.ps1 -DryRun"
    exit 1
}
if ($DryRun) {
    Write-Warning "DRY RUN MODE: No tables will be created"
} else {
    Write-Success "Confirmation flag validated"
}

# Check AWS CLI
Write-Header "Checking AWS CLI"
try {
    $awsVersion = aws --version 2>&1
    Write-Success "AWS CLI found: $awsVersion"
} catch {
    Write-Error "AWS CLI not found. Install from https://aws.amazon.com/cli/"
    exit 1
}

# Verify AWS credentials
Write-Header "Verifying AWS Credentials"
try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    Write-Success "AWS Account: $($identity.Account)"
    Write-Info "User: $($identity.Arn)"
} catch {
    Write-Error "AWS credentials not configured"
    Write-Info "Run: aws configure"
    exit 1
}

# Verify QA tables exist
Write-Header "Verifying QA Tables Exist"
$missingTables = @()
foreach ($table in $tables) {
    try {
        $null = aws dynamodb describe-table --table-name $table.QATable --region $region 2>&1
        Write-Success "Found: $($table.QATable)"
    } catch {
        Write-Error "Missing: $($table.QATable)"
        $missingTables += $table.QATable
    }
}

if ($missingTables.Count -gt 0) {
    Write-Error "`nABORT: Cannot proceed - missing QA tables"
    Write-Info "Missing tables: $($missingTables -join ', ')"
    Write-Info "Create QA tables first before provisioning production"
    exit 1
}

# Check if prod tables already exist
Write-Header "Checking Production Tables Status"
$existingTables = @()
foreach ($table in $tables) {
    try {
        $null = aws dynamodb describe-table --table-name $table.ProdTable --region $region 2>&1
        Write-Warning "Already exists: $($table.ProdTable)"
        $existingTables += $table.ProdTable
    } catch {
        Write-Info "Not found: $($table.ProdTable) (will be created)"
    }
}

if ($existingTables.Count -gt 0) {
    Write-Warning "`nSome production tables already exist:"
    foreach ($t in $existingTables) {
        Write-Info "  - $t"
    }
    if (-not $DryRun) {
        $response = Read-Host "`nSkip existing tables and create missing ones? (yes/no)"
        if ($response -ne "yes") {
            Write-Info "Operation cancelled"
            exit 0
        }
    }
}

# FINAL CONFIRMATION
if (-not $DryRun -and -not $Force) {
    Write-Header "WARNING - FINAL CONFIRMATION"
    Write-Warning "You are about to create PRODUCTION DynamoDB tables:"
    foreach ($table in $tables) {
        if ($table.ProdTable -notin $existingTables) {
            Write-Info "  - $($table.ProdTable)"
        }
    }
    Write-Info "`nRegion: $region"
    Write-Info "Account: $($identity.Account)"
    
    Write-Host "`nType 'CREATE PRODUCTION TABLES' to confirm: " -ForegroundColor Yellow -NoNewline
    $confirmation = Read-Host
    
    if ($confirmation -ne "CREATE PRODUCTION TABLES") {
        Write-Info "`nOperation cancelled"
        exit 0
    }
}

if ($Force) {
    Write-Warning "FORCING table creation (confirmation bypassed)"
}

# Create production tables
Write-Header "Creating Production Tables"

foreach ($table in $tables) {
    if ($table.ProdTable -in $existingTables) {
        Write-Info "Skipping: $($table.ProdTable) (already exists)"
        continue
    }
    
    Write-Host "`nProcessing: $($table.Name)" -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Info "``[DRY RUN``] Would describe QA table: $($table.QATable)"
        Write-Info "``[DRY RUN``] Would create production table: $($table.ProdTable)"
        continue
    }
    
    # Get QA table description
    Write-Info "Reading schema from: $($table.QATable)"
    $qaTableJson = aws dynamodb describe-table --table-name $table.QATable --region $region
    $qaTable = $qaTableJson | ConvertFrom-Json
    
    # Extract table properties and save to temp files WITHOUT BOM
    $tempPath = Join-Path $env:TEMP "dynamodb-provision-$(Get-Date -Format 'yyyyMMddHHmmss')"
    New-Item -ItemType Directory -Path $tempPath -Force | Out-Null
    
    $keySchemaFile = Join-Path $tempPath "key-schema.json"
    $attributeDefFile = Join-Path $tempPath "attribute-definitions.json"
    $gsiFile = Join-Path $tempPath "gsi.json"
    
    # Create UTF8 encoding without BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    
    # Write JSON files without BOM
    $keySchemaJson = $qaTable.Table.KeySchema | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($keySchemaFile, $keySchemaJson, $utf8NoBom)
    
    $attributeDefJson = $qaTable.Table.AttributeDefinitions | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($attributeDefFile, $attributeDefJson, $utf8NoBom)
    
    $billingMode = $qaTable.Table.BillingModeSummary.BillingMode
    
    # Handle Global Secondary Indexes
    $hasGSI = $false
    if ($qaTable.Table.GlobalSecondaryIndexes) {
        $gsis = @()
        foreach ($gsi in $qaTable.Table.GlobalSecondaryIndexes) {
            $gsiObj = @{
                IndexName = $gsi.IndexName
                KeySchema = $gsi.KeySchema
                Projection = $gsi.Projection
            }
            if ($billingMode -eq "PROVISIONED") {
                $gsiObj.ProvisionedThroughput = @{
                    ReadCapacityUnits = $gsi.ProvisionedThroughput.ReadCapacityUnits
                    WriteCapacityUnits = $gsi.ProvisionedThroughput.WriteCapacityUnits
                }
            }
            $gsis += $gsiObj
        }
        $gsiJson = $gsis | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($gsiFile, $gsiJson, $utf8NoBom)
        $hasGSI = $true
    }
    
    # Create table using file:// protocol for JSON parameters
    Write-Info "Creating table: $($table.ProdTable)"
    try {
        $createParams = @(
            'dynamodb', 'create-table',
            '--table-name', $table.ProdTable,
            '--region', $region,
            '--key-schema', "file://$keySchemaFile",
            '--attribute-definitions', "file://$attributeDefFile",
            '--billing-mode', $billingMode
        )
        
        if ($hasGSI) {
            $createParams += '--global-secondary-indexes'
            $createParams += "file://$gsiFile"
        }
        
        if ($billingMode -eq "PROVISIONED") {
            $createParams += '--provisioned-throughput'
            $createParams += "ReadCapacityUnits=$($qaTable.Table.ProvisionedThroughput.ReadCapacityUnits),WriteCapacityUnits=$($qaTable.Table.ProvisionedThroughput.WriteCapacityUnits)"
        }
        
        & aws @createParams | Out-Null
        Write-Success "Table created: $($table.ProdTable)"
        
        # Clean up temp files
        Remove-Item -Path $tempPath -Recurse -Force
    } catch {
        Write-Error "Failed to create table: $($table.ProdTable)"
        Write-Info "Error: $_"
        # Clean up temp files on error
        if (Test-Path $tempPath) {
            Remove-Item -Path $tempPath -Recurse -Force
        }
        continue
    }
    
    # Wait for table to be active
    Write-Info "Waiting for table to become active..."
    $maxWait = 60
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
        
        try {
            $status = aws dynamodb describe-table --table-name $table.ProdTable --region $region | ConvertFrom-Json
            if ($status.Table.TableStatus -eq "ACTIVE") {
                Write-Success "Table is ACTIVE"
                break
            }
            Write-Host "." -NoNewline
        } catch {
            Write-Host "." -NoNewline
        }
    }
    
    if ($waited -ge $maxWait) {
        Write-Warning "Table creation timeout - check AWS console"
    }
    
    # Copy TTL settings if present
    if ($qaTable.Table.TimeToLiveDescription -and $qaTable.Table.TimeToLiveDescription.TimeToLiveStatus -eq "ENABLED") {
        Write-Info "Configuring TTL..."
        $ttlAttribute = $qaTable.Table.TimeToLiveDescription.AttributeName
        aws dynamodb update-time-to-live `
            --table-name $table.ProdTable `
            --region $region `
            --time-to-live-specification "Enabled=true,AttributeName=$ttlAttribute" | Out-Null
        Write-Success "TTL configured: $ttlAttribute"
    }
    
    # Copy Stream settings if present
    if ($qaTable.Table.StreamSpecification -and $qaTable.Table.StreamSpecification.StreamEnabled) {
        Write-Info "Stream is enabled on QA table (configure manually if needed)"
    }
}

# Summary
Write-Header "================================================================"
if ($DryRun) {
    Write-Success "DRY RUN COMPLETE"
    Write-Info "No tables were created. Review the output above."
} else {
    Write-Success "PRODUCTION TABLES PROVISIONED"
    Write-Info "`nCreated tables:"
    foreach ($table in $tables) {
        if ($table.ProdTable -notin $existingTables) {
            Write-Info "  [OK] $($table.ProdTable)"
        }
    }
}

Write-Header "Next Steps:"
Write-Info "1. Verify tables in AWS Console"
Write-Info "2. Update Vercel production environment variables:"
Write-Info "     - APP_ENV=prod"
Write-Info "     - SQUARE_ENVIRONMENT=production"
Write-Info "     - DYNAMODB_JOBS_TABLE=jobs"
Write-Info "     - DYNAMODB_USERS_TABLE=users"
Write-Info "     - DYNAMODB_CHECKLIST_TEMPLATES_TABLE=checklist-templates"
Write-Info "3. Deploy to production"
Write-Info "4. Test health endpoint: https://ops.thesafaricarwash.com/api/health"
Write-Header "================================================================"
