# Phase 1 Quick Start Guide

## Prerequisites Checklist
- ✅ Node.js 18+ installed
- ✅ AWS credentials configured
- ✅ DynamoDB access
- ✅ Existing Safari Detail Ops codebase

## Setup Steps (5 Minutes)

### 1. Install Dependencies
```bash
npm install
```

This installs the new `jose` package for JWT handling.

### 2. Generate AUTH_SECRET
```bash
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Mac/Linux
openssl rand -base64 32
```

Copy the output.

### 3. Update .env File
Add these lines to your `.env`:

```bash
AUTH_SECRET=<paste_your_generated_secret>
DYNAMODB_USERS_TABLE=users
```

### 4. Create DynamoDB Users Table

#### Option A: AWS CLI (Recommended)
```bash
aws dynamodb create-table \
  --table-name safari-detail-ops-qa-users \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=email,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
  --global-secondary-indexes \
    "[{
      \"IndexName\": \"email-index\",
      \"KeySchema\": [{\"AttributeName\":\"email\",\"KeyType\":\"HASH\"}],
      \"Projection\": {\"ProjectionType\":\"ALL\"},
      \"ProvisionedThroughput\": {\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
    }]" \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-east-1
```

#### Option B: AWS Console
1. Go to DynamoDB Console
2. Create table: `safari-detail-ops-qa-users`
3. Partition key: `pk` (String)
4. Create GSI:
   - Index name: `email-index`
   - Partition key: `email` (String)
   - Projection: All attributes

### 5. Create First Admin User
```bash
npm run seed-admin
```

Follow the prompts:
- Name: Your Name
- Email: your.email@example.com
- Password: (minimum 8 characters)
- Confirm password

### 6. Start Development Server
```bash
npm run dev
```

### 7. Test Login
1. Open browser: http://localhost:3000
2. Should redirect to `/login`
3. Enter your admin credentials
4. Should redirect to home page after login

## Verification Tests

### Test 1: Login Works ✅
- Visit http://localhost:3000/login
- Enter admin email and password
- Should redirect to `/` after success

### Test 2: Session Persists ✅
- After login, close browser
- Open http://localhost:3000 again
- Should stay logged in

### Test 3: Settings Page ✅
- Visit http://localhost:3000/settings
- Should show your profile info
- Role should be "MANAGER"

### Test 4: Logout Works ✅
- Click logout button in settings
- Should redirect to login page
- Trying to access `/settings` should redirect to login

### Test 5: API Protection ✅
Open browser console and run:
```javascript
// Should work (logged in)
fetch('/api/auth/me').then(r => r.json()).then(console.log)

// Logout
fetch('/api/auth/logout', {method: 'POST'})

// Should return 401 (logged out)
fetch('/api/auth/me').then(r => r.json()).then(console.log)
```

## Troubleshooting

### "AUTH_SECRET must be set" Error
- Check `.env` file has `AUTH_SECRET=<your secret>`
- Restart dev server: `npm run dev`

### "Cannot find module 'jose'"
- Run: `npm install`
- The jose package needs to be installed

### Seed Script Fails
- Verify DynamoDB table exists: `safari-detail-ops-qa-users`
- Check AWS credentials: `aws sts get-caller-identity`
- Verify `DYNAMODB_USERS_TABLE=users` in `.env`

### Login Returns 500 Error
- Check AWS credentials are configured
- Verify DynamoDB table has GSI: `email-index`
- Check `.env` has all required variables

## Next Steps

1. ✅ Authentication working
2. Add more users (rerun seed script or create via code)
3. Test all protected routes
4. Deploy to Vercel (see PHASE_1_AUTH_IMPLEMENTATION.md)

## File Reference

**New Files:**
- `lib/auth/password.ts` - Password utilities
- `lib/auth/session.ts` - JWT session management
- `lib/auth/requireAuth.ts` - API route protection
- `lib/services/user-service.ts` - User DynamoDB operations
- `app/api/auth/login/route.ts` - Login endpoint
- `app/api/auth/logout/route.ts` - Logout endpoint
- `app/api/auth/me/route.ts` - Get current user
- `app/login/page.tsx` - Login page UI
- `app/settings/page.tsx` - Settings page UI
- `middleware.ts` - Route protection
- `scripts/seed-admin-user.ts` - Create admin user

**Modified Files:**
- `.env.example` - Added auth variables
- `package.json` - Added jose dependency

## Support Files
- `PHASE_1_AUTH_IMPLEMENTATION.md` - Complete documentation
- `PHASE_1_QUICK_START.md` - This file

---

**Total Setup Time:** ~5 minutes  
**Status:** ✅ Ready to use
