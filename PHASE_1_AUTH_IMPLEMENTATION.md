# Phase 1: Authentication + RBAC + Settings - Implementation Complete

## Overview

This document describes the complete implementation of Phase 1 authentication system for Safari Detail Ops. The system provides secure, production-ready authentication using JWT tokens stored in HTTP-only cookies, with role-based access control (RBAC) for TECH, QC, and MANAGER roles.

## Architecture

### Authentication Flow
1. User submits credentials to `/api/auth/login`
2. Server validates credentials against DynamoDB users table
3. Server creates JWT token signed with `AUTH_SECRET`
4. JWT stored in HTTP-only cookie (`safari_session`)
5. Middleware validates session on all protected routes
6. Frontend accesses user info via `/api/auth/me`

### Security Features
- ✅ HTTP-only cookies (not accessible via JavaScript)
- ✅ Secure password hashing using scrypt
- ✅ JWT tokens with 7-day expiration
- ✅ Edge-compatible session verification (Vercel)
- ✅ CSRF protection via SameSite cookies
- ✅ Timing-safe password comparison
- ✅ Generic error messages (prevents email enumeration)

---

## Files Added/Modified

### New Files Created

#### Authentication Libraries
- **`lib/auth/password.ts`** - Password hashing and verification using Node.js scrypt
- **`lib/auth/session.ts`** - JWT session management with Web Crypto API
- **`lib/auth/requireAuth.ts`** - API route protection wrappers

#### Services
- **`lib/services/user-service.ts`** - DynamoDB user management operations

#### API Routes
- **`app/api/auth/login/route.ts`** - POST endpoint for user login
- **`app/api/auth/logout/route.ts`** - POST endpoint to clear session
- **`app/api/auth/me/route.ts`** - GET endpoint to fetch current user

#### Middleware
- **`middleware.ts`** - Route protection and session validation

#### Frontend Pages
- **`app/login/page.tsx`** - Login form with email/password
- **`app/settings/page.tsx`** - User profile, language selector, logout

#### Scripts
- **`scripts/seed-admin-user.ts`** - Interactive script to create first MANAGER account

### Modified Files
- **`.env.example`** - Added `DYNAMODB_USERS_TABLE` and `AUTH_SECRET`
- **`package.json`** - Added `jose` library for JWT handling

---

## Environment Variables

Add these to your `.env` file:

```bash
# Authentication
AUTH_SECRET=<generate_a_secure_random_string_minimum_32_characters>

# DynamoDB Users Table
DYNAMODB_USERS_TABLE=users
```

### Generate AUTH_SECRET

Use one of these methods:

```bash
# Method 1: OpenSSL
openssl rand -base64 32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Method 3: PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## DynamoDB Setup

### Users Table Schema

**Table Name:** `safari-detail-ops-<env>-users` (or as configured in `DYNAMODB_USERS_TABLE`)

**Primary Key:**
- Partition Key: `pk` (String) - Format: `USER#<userId>`

**Global Secondary Index (GSI):**
- **Index Name:** `email-index`
- **Partition Key:** `email` (String)
- **Projection:** ALL

### Create Users Table (AWS CLI)

```bash
# For QA environment
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

# For Production environment
aws dynamodb create-table \
  --table-name safari-detail-ops-prod-users \
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

### User Record Schema

```typescript
{
  pk: "USER#<uuid>",           // Primary key
  userId: "<uuid>",             // User identifier
  email: "user@example.com",    // Normalized email (lowercase)
  name: "John Doe",             // Full name
  role: "MANAGER" | "QC" | "TECH",
  passwordHash: "<scrypt_hash>",
  isActive: true,               // Account status
  createdAt: "2026-02-19T10:00:00.000Z",
  updatedAt: "2026-02-19T10:00:00.000Z",
  lastLoginAt?: "2026-02-19T10:30:00.000Z"  // Optional
}
```

---

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install the new `jose` package for JWT handling.

### 2. Configure Environment

```bash
# Copy the updated .env.example if needed
cp .env.example .env

# Add required variables to .env
AUTH_SECRET=<your_generated_secret>
DYNAMODB_USERS_TABLE=users
```

### 3. Create DynamoDB Users Table

Use the AWS CLI commands above or create via AWS Console:
- Table name: `safari-detail-ops-qa-users`
- Primary key: `pk` (String)
- GSI: `email-index` on `email` attribute

### 4. Create First Admin User

```bash
npm run seed-admin
```

Or manually:

```bash
ts-node scripts/seed-admin-user.ts
```

Follow the prompts to create the first MANAGER account.

### 5. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000/login

---

## Protected Routes

### App Routes (Pages)
All routes except `/login` and public assets require authentication:
- `/` (redirects to `/login` if not authenticated)
- `/today` ✅ Protected
- `/calendar` ✅ Protected
- `/jobs/:jobId` ✅ Protected
- `/settings` ✅ Protected

### API Routes

**Protected (require authentication):**
- `/api/jobs/*` - All job endpoints
- `/api/admin/*` - Admin endpoints
- `/api/cron/*` - Cron job endpoints (if exists)

**Public (no authentication required):**
- `/api/auth/login` - Login endpoint
- `/api/auth/logout` - Logout endpoint
- `/api/health` - Health check
- `/api/square/webhooks/*` - Square webhook handlers

---

## API Endpoint Documentation

### POST /api/auth/login

Login with email and password.

**Request:**
```json
{
  "email": "admin@safaridetail.com",
  "password": "securepassword123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "email": "admin@safaridetail.com",
      "name": "Admin User",
      "role": "MANAGER",
      "isActive": true,
      "createdAt": "2026-02-19T10:00:00.000Z",
      "updatedAt": "2026-02-19T10:00:00.000Z"
    }
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

### GET /api/auth/me

Get current user session information.

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "email": "admin@safaridetail.com",
      "name": "Admin User",
      "role": "MANAGER"
    }
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Not authenticated"
  }
}
```

### POST /api/auth/logout

Clear session cookie and logout.

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Usage Examples

### Protecting API Routes

Use the `requireAuth` wrapper in your API routes:

```typescript
import { requireAuth } from '@/lib/auth/requireAuth';

export const GET = requireAuth(async (request, session) => {
  // session.sub = userId
  // session.email = user email
  // session.name = user name
  // session.role = user role (TECH, QC, MANAGER)
  
  return NextResponse.json({
    success: true,
    data: { message: "Protected data" }
  });
});
```

### Role-Based Protection

Require specific roles:

```typescript
import { requireRole } from '@/lib/auth/requireAuth';
import { UserRole } from '@/lib/types';

// Only MANAGER can access
export const POST = requireRole(
  [UserRole.MANAGER],
  async (request, session) => {
    // Manager-only logic
    return NextResponse.json({ success: true });
  }
);

// MANAGER or QC can access
export const GET = requireRole(
  [UserRole.MANAGER, UserRole.QC],
  async (request, session) => {
    // QC or Manager logic
    return NextResponse.json({ success: true });
  }
);
```

### Client-Side User Info

Fetch current user in React components:

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function MyComponent() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.data.user);
        }
      });
  }, []);

  return <div>Welcome, {user?.name}</div>;
}
```

---

## Manual Testing Plan

### Test 1: Create Admin User
```bash
ts-node scripts/seed-admin-user.ts
```
- Enter name, email, password
- Verify user created successfully
- Confirm userId is displayed

### Test 2: Login Flow
1. Visit http://localhost:3000/
2. Should redirect to `/login`
3. Enter admin credentials
4. Should redirect to `/` after successful login
5. Verify no errors in browser console

### Test 3: Protected Routes
1. While logged in, visit `/settings`
2. Should display user profile
3. Verify name, email, and role are correct
4. Verify logout button is present

### Test 4: API Authentication
```bash
# Test without auth (should fail)
curl http://localhost:3000/api/jobs

# Login first, then test with cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'

# Now test with cookie (should succeed)
curl -b cookies.txt http://localhost:3000/api/jobs
```

### Test 5: Session Persistence
1. Login successfully
2. Close browser tab
3. Open new tab to http://localhost:3000/
4. Should remain logged in
5. Session should persist for 7 days

### Test 6: Logout Flow
1. Click logout button in `/settings`
2. Should redirect to `/login`
3. Try accessing `/settings` directly
4. Should redirect back to `/login`

### Test 7: Invalid Credentials
1. Go to `/login`
2. Enter wrong password
3. Should see error: "Invalid email or password"
4. Should not reveal if email exists

### Test 8: Square Webhook (Public)
```bash
# Verify webhook endpoint is still public
curl http://localhost:3000/api/square/webhooks/bookings \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Should return response (not 401)
```

---

## Adding More Users

### Option 1: Create Script for Each Role

Modify `seed-admin-user.ts` to accept role as parameter:

```typescript
// Add role selection
const roleInput = await question('Enter role (MANAGER/QC/TECH): ');
const role = roleInput.toUpperCase() as UserRole;
```

### Option 2: Management API Endpoint

Create `/api/admin/users/create` endpoint (MANAGER only):

```typescript
export const POST = requireRole([UserRole.MANAGER], async (req, session) => {
  const { email, name, role, password } = await req.json();
  const passwordHash = await hashPassword(password);
  const user = await createUser({ email, name, role, passwordHash });
  return NextResponse.json({ success: true, data: { user: toSafeUser(user) } });
});
```

---

## Troubleshooting

### "AUTH_SECRET must be set" Error
- Ensure `AUTH_SECRET` is defined in `.env`
- Minimum 32 characters required
- Restart dev server after adding

### "DYNAMODB_USERS_TABLE environment variable is not set"
- Add `DYNAMODB_USERS_TABLE=users` to `.env`
- Restart dev server

### Login Returns 500 Error
- Check DynamoDB table exists
- Verify AWS credentials are configured
- Check CloudWatch logs for details
- Ensure GSI `email-index` exists

### Session Not Persisting
- Check browser cookies (should see `safari_session`)
- Verify cookie is `HttpOnly` and `Secure` (in production)
- Check middleware is running (add console.log in middleware.ts)

### Edge Runtime Errors
- Ensure using `jose` library (not `jsonwebtoken`)
- Don't use Node.js crypto in middleware
- Use Web Crypto API for edge compatibility

---

## Security Considerations

### Production Checklist
- ✅ Use strong `AUTH_SECRET` (32+ characters, random)
- ✅ Enable HTTPS in production (automatic on Vercel)
- ✅ Set `secure: true` in cookie options (automatic in production)
- ✅ Passwords hashed with scrypt (salt + key derivation)
- ✅ Timing-safe password comparison
- ✅ JWT token signed and verified
- ✅ HTTP-only cookies (not accessible via JavaScript)
- ✅ SameSite cookie attribute set
- ✅ Session expiration (7 days)

### Future Enhancements (Out of Scope for Phase 1)
- Password reset via email
- Two-factor authentication (2FA)
- Session revocation/invalidation
- Password complexity requirements
- Rate limiting on login endpoint
- Audit logging for authentication events
- Remember me functionality

---

## Deployment to Vercel

### 1. Set Environment Variables

In Vercel dashboard, add:
- `AUTH_SECRET` - Your secure secret key
- `DYNAMODB_USERS_TABLE` - `users`
- All existing AWS and Square variables

### 2. Deploy

```bash
vercel --prod
```

### 3. Create Production Admin User

After deployment:

```bash
# Set production environment
APP_ENV=prod ts-node scripts/seed-admin-user.ts
```

Or create via AWS Console:
1. Open DynamoDB
2. Select `safari-detail-ops-prod-users` table
3. Create item with proper schema
4. Use seed script output format

---

## Next Steps (Phase 2 - Out of Scope)

- User management UI for MANAGER role
- Password reset flow
- User activity logging
- Session management page
- Role permissions matrix UI
- Internationalization (i18n) for language selector
- Email notifications

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review AWS CloudWatch logs
3. Check browser console for frontend errors
4. Review middleware logs in Vercel dashboard

---

**Implementation Date:** February 19, 2026  
**Version:** Phase 1 - Complete  
**Status:** ✅ Production Ready
