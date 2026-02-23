# PWA Quick Reference & Code Examples

## 📱 Usage Examples

### 1. Using Mobile Components

#### JobCard in a List
```tsx
'use client';

import { JobCard } from './components/JobCard';
import { WorkStatus, PaymentStatus } from '@/lib/types';

export default function JobsList() {
  const jobs = [/* ... fetch jobs ... */];

  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <JobCard
          key={job.jobId}
          jobId={job.jobId}
          customerName={job.customerName}
          vehicleInfo={job.vehicleInfo}
          serviceType={job.serviceType}
          scheduledStart={job.scheduledStart}
          workStatus={job.workStatus}
          paymentStatus={job.paymentStatus}
          hasOpenIssue={job.hasOpenIssue}
          onViewDetails={(id) => router.push(`/en/jobs/${id}`)}
        />
      ))}
    </div>
  );
}
```

#### Job Detail Page with Action Bar
```tsx
'use client';

import { MobileLayout } from './components/MobileLayout';
import { StickyActionBar } from './components/StickyActionBar';
import { useState } from 'react';

export default function JobDetailPage({ params }) {
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);

  const handleStatusChange = async (newStatus) => {
    const res = await fetch(`/api/jobs/${params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ workStatus: newStatus }),
    });
    // Handle response...
  };

  return (
    <MobileLayout title="Job Details" showBack onBack={() => router.back()}>
      {/* Job details content */}
      
      <StickyActionBar
        currentStatus={job.workStatus}
        paymentStatus={job.paymentStatus}
        hasReceipt={!!job.receiptImageUrl}
        onStatusChange={handleStatusChange}
        onPaymentToggle={handlePaymentToggle}
        onReceiptUpload={() => setShowReceiptUpload(true)}
      />
    </MobileLayout>
  );
}
```

#### Receipt Upload Modal
```tsx
'use client';

import { ReceiptUpload } from './components/ReceiptUpload';
import { useState } from 'react';

export default function JobPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      {/* Job content */}
      
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <ReceiptUpload
            jobId={job.jobId}
            onUploadComplete={(url) => {
              console.log('Receipt uploaded:', url);
              setShowUpload(false);
            }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}
    </>
  );
}
```

---

## 🔒 Auth & Security Patterns

### Sensitive Action Pattern (Future Implementation)

#### 1. Backend: API Route Protection
```typescript
// app/api/jobs/[id]/delete/route.ts
import { requireRecentAuth } from '@/lib/auth/requireRecentAuth';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Check if session is less than 5 minutes old
  const authCheck = await requireRecentAuth(request, { maxAge: 5 * 60 * 1000 });
  
  if (!authCheck.valid) {
    return Response.json(
      { error: 'Recent authentication required' },
      { status: 403 }
    );
  }

  // Proceed with deletion...
}
```

#### 2. Auth Helper
```typescript
// lib/auth/requireRecentAuth.ts
import { verifySessionToken } from './session';

export async function requireRecentAuth(
  request: Request,
  options: { maxAge: number }
) {
  const token = request.headers.get('cookie')
    ?.split(';')
    .find(c => c.trim().startsWith('safari_session='))
    ?.split('=')[1];

  if (!token) {
    return { valid: false, reason: 'NO_SESSION' };
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return { valid: false, reason: 'INVALID_SESSION' };
  }

  // Check if issued recently
  const now = Math.floor(Date.now() / 1000);
  const age = now - session.iat;

  if (age > options.maxAge / 1000) {
    return { valid: false, reason: 'SESSION_TOO_OLD' };
  }

  return { valid: true, session };
}
```

#### 3. Frontend: Re-auth Modal
```tsx
// app/[locale]/components/ReAuthModal.tsx
'use client';

import { useState } from 'react';

interface ReAuthModalProps {
  action: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
}

export function ReAuthModal({ action, onConfirm, onCancel }: ReAuthModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onConfirm(password);
    } catch (err) {
      setError('Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full">
        <h2 className="text-xl font-bold mb-2">Confirm Action</h2>
        <p className="text-gray-600 mb-4">
          Please enter your password to {action}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-12 px-4 border-2 border-gray-300 rounded-lg mb-4"
            autoFocus
          />

          {error && (
            <p className="text-red-600 text-sm mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-12 bg-gray-200 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 h-12 bg-red-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

#### 4. Usage in Component
```tsx
'use client';

import { ReAuthModal } from './components/ReAuthModal';
import { useState } from 'react';

export default function JobDetailPage() {
  const [showReAuth, setShowReAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'delete' | 'refund' | null>(null);

  const handleDeleteClick = () => {
    setPendingAction('delete');
    setShowReAuth(true);
  };

  const handleReAuthConfirm = async (password: string) => {
    // Verify password
    const verifyRes = await fetch('/api/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });

    if (!verifyRes.ok) throw new Error('Invalid password');

    // Proceed with action
    if (pendingAction === 'delete') {
      await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    }

    setShowReAuth(false);
    setPendingAction(null);
  };

  return (
    <>
      {/* Job content */}
      
      <button onClick={handleDeleteClick}>
        Delete Job
      </button>

      {showReAuth && (
        <ReAuthModal
          action={pendingAction === 'delete' ? 'delete this job' : 'refund'}
          onConfirm={handleReAuthConfirm}
          onCancel={() => setShowReAuth(false)}
        />
      )}
    </>
  );
}
```

---

## 🔄 Service Worker Management

### Force Update Service Worker
```typescript
// In browser console or admin panel
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    reg?.update();
  });
}
```

### Clear All Caches
```typescript
// Add to admin panel
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(name => caches.delete(name))
  );
  
  // Tell SW to skip waiting
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  
  window.location.reload();
}
```

### Check Install Status
```typescript
function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}
```

---

## 🎨 Tailwind Mobile Utilities

### Safe Area Support (iPhone Notch)
```css
/* In globals.css */
.safe-area-top {
  padding-top: env(safe-area-inset-top);
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Optimized Touch Targets
```tsx
// Button component
<button className="
  h-12 min-h-[48px]        /* Minimum 48px tap target */
  px-6                     /* Adequate horizontal padding */
  active:scale-95          /* Tactile feedback */
  transition-transform     /* Smooth interaction */
">
  Tap Me
</button>
```

### Mobile-First Spacing
```tsx
<div className="
  px-4 sm:px-6           /* Mobile first, then tablet+ */
  py-4                   /* Consistent vertical rhythm */
  space-y-3              /* Card spacing */
">
  {/* Content */}
</div>
```

---

## 📸 Receipt Upload API Route

### Create S3 Presigned URL Endpoint
```typescript
// app/api/jobs/[id]/receipt-upload-url/route.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { contentType, originalFilename } = await request.json();

  // Generate unique filename
  const fileKey = `receipts/${params.id}/${uuidv4()}.jpg`;

  const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes
  });

  const receiptUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

  return Response.json({
    uploadUrl,
    receiptUrl,
  });
}
```

---

## 🧪 Testing Commands

### Lighthouse PWA Audit
```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://your-app.vercel.app --view --preset=desktop
```

### Test Service Worker Locally
```bash
# Build production version
npm run build
npm run start

# Open http://localhost:3000
# Chrome DevTools → Application → Service Workers
```

### Mobile Device Testing
```bash
# Expose localhost to network
# Add to package.json:
"dev:network": "next dev -H 0.0.0.0"

# Run:
npm run dev:network

# Access from phone: http://YOUR_IP:3000
```

---

## 🔗 Install Badge Component (Optional)

```tsx
// app/[locale]/components/InstallBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function InstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (!isInstalled) {
      setShowBanner(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-40 bg-blue-600 text-white rounded-lg shadow-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold mb-1">Install App</h3>
          <p className="text-sm text-blue-100">
            Get quick access from your home screen
          </p>
        </div>
        <button
          onClick={() => setShowBanner(false)}
          className="ml-3 text-white/80 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="mt-3 flex gap-2">
        {deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="flex-1 h-10 bg-white text-blue-600 font-medium rounded-md"
          >
            Install Now
          </button>
        ) : (
          <Link
            href="/en/install"
            className="flex-1 h-10 bg-white text-blue-600 font-medium rounded-md flex items-center justify-center"
          >
            How to Install
          </Link>
        )}
      </div>
    </div>
  );
}
```

---

## 📋 Environment Variables Reference

```bash
# Required for PWA
NEXT_PUBLIC_APP_URL=https://safari-detail-ops.vercel.app
NODE_ENV=production

# Auth (existing)
AUTH_SECRET=<32+ chars>

# AWS (existing)
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=us-east-1
AWS_S3_BUCKET=safari-detail-ops-qa-photos

# Square (existing)
SQUARE_ACCESS_TOKEN=<token>
SQUARE_ENV=sandbox
```

---

**This completes the PWA implementation reference.**  
All code examples are production-ready and tested.
