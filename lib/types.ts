/**
 * Shared TypeScript types for Safari Detail Ops
 */

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  environment: 'qa' | 'prod';
  version: string;
  timestamp: string;
  services?: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
    };
  };
}

/**
 * Phase B: Authoritative work status model
 */
export enum WorkStatus {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  QC_READY = 'QC_READY',
  WORK_COMPLETED = 'WORK_COMPLETED',
  NO_SHOW_PENDING_CHARGE = 'NO_SHOW_PENDING_CHARGE',
  NO_SHOW_CHARGED = 'NO_SHOW_CHARGED',
  NO_SHOW_FAILED = 'NO_SHOW_FAILED',
}

/**
 * Phase B: Payment status (separate from work status)
 */
export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
}

/**
 * Phase B: User roles (server-enforced)
 */
export enum UserRole {
  TECH = 'TECH',
  QC = 'QC',
  MANAGER = 'MANAGER',
}

/**
 * Phase B: Booking source
 */
export enum BookingSource {
  SQUARE_ONLINE = 'SQUARE_ONLINE',
  PHONE = 'PHONE',
}

/**
 * Phase B: Deprecated old status enum (for migration)
 */
export enum JobStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Phase 3: Audit trail for user actions
 */
export interface UserAudit {
  userId: string;
  name: string;
  role: UserRole;
}

/**
 * Phase 3: Post-completion issue tracking
 */
export interface PostCompletionIssue {
  isOpen: boolean;
  type: 'QC_MISS' | 'CUSTOMER_COMPLAINT' | 'DAMAGE' | 'REDO' | 'OTHER';
  notes?: string;
  openedAt: string;
  openedBy: {
    userId: string;
    name: string;
    role: 'MANAGER';
  };
  resolvedAt?: string;
  resolvedBy?: {
    userId: string;
    name: string;
    role: 'MANAGER';
  };
}

/**
 * Phase 3: Status history entry
 */
export interface StatusHistoryEntry {
  from: WorkStatus | null;
  to: WorkStatus | null;
  event?: 'POST_COMPLETION_ISSUE_OPENED' | 'POST_COMPLETION_ISSUE_RESOLVED' | 'STATUS_CHANGE' | 'PAYMENT_MARKED_PAID' | 'PAYMENT_MARKED_UNPAID';
  changedAt: string;
  changedBy: UserAudit;
  reason?: string;
}

/**
 * Phase 3: Checklist item
 */
export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedAt?: string;
  checkedBy?: UserAudit;
}

/**
 * Phase 3: Photo metadata
 */
export interface PhotoMeta {
  photoId: string;
  s3Key: string;
  publicUrl: string;
  contentType: string;
  uploadedAt: string;
  uploadedBy: UserAudit;
  category?: 'before' | 'after' | 'damage' | 'other';
}

/**
 * Payment toggle: Receipt photo metadata
 */
export interface ReceiptPhoto {
  photoId: string;
  s3Key: string;
  publicUrl: string;
  contentType: string;
  uploadedAt: string;
  uploadedBy: {
    userId: string;
    name: string;
    role: 'MANAGER';
  };
}

/**
 * Payment toggle: Enhanced payment details
 */
export interface Payment {
  status: PaymentStatus;
  amountCents?: number;
  currency?: string;
  paidAt?: string;
  paidBy?: {
    userId: string;
    name: string;
    role: 'MANAGER';
  };
  unpaidReason?: string;
  unpaidNote?: string;
}

/**
 * Phase 3: Cached customer details from Square
 */
export interface CustomerCached {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  cachedAt?: string;
}

/**
 * Job record (DynamoDB schema with Phase 3 enhancements)
 */
export interface Job {
  jobId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicleInfo: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
  };
  serviceType: string;
  status: WorkStatus; // Phase B: Use WorkStatus instead of JobStatus
  workStatus?: WorkStatus; // Phase 3: Alias for status (for backward compatibility)
  bookingId?: string; // Square booking ID
  appointmentTime?: string;
  photos?: string[]; // S3 keys (legacy)
  photosMeta?: PhotoMeta[]; // Phase 3: Enhanced photo metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string | UserAudit; // Phase 3: Enhanced with UserAudit
  // Phase 3: Additional fields
  checklist?: {
    tech?: ChecklistItem[];
    qc?: ChecklistItem[];
  };
  customerCached?: CustomerCached;
  postCompletionIssue?: PostCompletionIssue;
  statusHistory?: StatusHistoryEntry[];
  // Payment toggle: Payment and receipt photos
  payment?: Payment;
  receiptPhotos?: ReceiptPhoto[];
}

/**
 * Phase B: Full job model with all required fields
 */
export interface JobV2 {
  // Identity
  jobId: string;
  squareBookingId: string;
  locationId: string; // Franklin location ID from Square

  // Booking source
  bookingSource: BookingSource;
  cardOnFile: boolean; // false for PHONE bookings

  // Customer info (from Square)
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;

  // Vehicle info (entered by staff)
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleColor?: string;
  licensePlate?: string;
  plateNorm?: string; // Normalized for searching (uppercase, no spaces/dashes)

  // Service details (from Square)
  serviceVariationId: string;
  serviceVariationName?: string;
  scheduledStart: string; // ISO timestamp
  scheduledEnd?: string; // ISO timestamp
  durationMinutes?: number;

  // Work status (authoritative)
  workStatus: WorkStatus;
  
  // Check-in data (required before IN_PROGRESS)
  checkedInAt?: string;
  checkedInBy?: string; // User ID or name
  checkinPhotosRequired: number; // e.g., 4
  checkinPhotos: string[]; // S3 keys

  // Work execution
  workStartedAt?: string;
  workStartedBy?: string;
  timerStartedAt?: string; // For elapsed time display
  timerPausedAt?: string;
  timerTotalPausedMs?: number;
  
  // Checklist (simple string array for V1)
  checklist: { label: string; completed: boolean }[];
  
  // QC
  qcReadyAt?: string;
  qcApprovedAt?: string;
  qcApprovedBy?: string;
  qcNotes?: string;
  
  // Work completion
  workCompletedAt?: string;
  workCompletedBy?: string;
  customerNotifiedAt?: string; // Set when workStatus becomes WORK_COMPLETED
  
  // Payment (separate from work status)
  payment: {
    status: PaymentStatus;
    amountCents?: number;
    paidAt?: string;
    paidBy?: string; // Who recorded payment (MANAGER typically)
    method?: string; // 'cash' | 'card_on_site' | 'square_online'
  };
  
  // No-show handling (manager only)
  noShow?: {
    markedAt: string;
    markedBy: string;
    attemptedChargeAt?: string;
    chargeResult?: 'SUCCESS' | 'FAILED';
    notes?: string;
  };
  
  // Notes
  staffNotes?: string; // Internal notes
  customerNotes?: string; // From Square booking
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  version: number; // For optimistic locking (from Square booking version)
}


/**
 * Square webhook event (Phase B)
 */
export interface SquareWebhookEvent {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object: any;
  };
}

/**
 * Square booking webhook payload (Phase B)
 */
export interface SquareBookingWebhook extends SquareWebhookEvent {
  type: 'booking.created' | 'booking.updated';
  data: {
    type: 'booking';
    id: string;
    object: {
      booking: any; // Square Booking object
    };
  };
}

/**
 * Phase 3: API Request/Response Types
 */

/**
 * PATCH /api/jobs/[jobId] request body
 */
export interface UpdateJobRequest {
  workStatus?: WorkStatus;
  checklist?: {
    tech?: ChecklistItem[];
    qc?: ChecklistItem[];
  };
  notes?: string;
  vehicleInfo?: Job['vehicleInfo'];
  openPostCompletionIssue?: {
    type: PostCompletionIssue['type'];
    notes?: string;
  };
  resolvePostCompletionIssue?: boolean;
  payment?: {
    status: PaymentStatus;
    unpaidReason?: string;
    unpaidNote?: string;
  };
}

/**
 * POST /api/jobs/[jobId]/photos/presign request/response
 */
export interface PresignPhotoRequest {
  files: Array<{
    filename: string;
    contentType: string;
    category?: PhotoMeta['category'];
  }>;
}

export interface PresignPhotoResponse {
  uploads: Array<{
    photoId: string;
    s3Key: string;
    putUrl: string;
    publicUrl: string;
    contentType: string;
    category?: PhotoMeta['category'];
  }>;
}

/**
 * POST /api/jobs/[jobId]/photos/commit request
 */
export interface CommitPhotosRequest {
  photos: Array<{
    photoId: string;
    s3Key: string;
    publicUrl: string;
    contentType: string;
    category?: PhotoMeta['category'];
  }>;
}

/**
 * Payment toggle: POST /api/jobs/[jobId]/receipts/presign request/response
 */
export interface PresignReceiptRequest {
  files: Array<{
    filename: string;
    contentType: string;
  }>;
}

export interface PresignReceiptResponse {
  uploads: Array<{
    photoId: string;
    s3Key: string;
    putUrl: string;
    publicUrl: string;
    contentType: string;
  }>;
}

/**
 * Payment toggle: POST /api/jobs/[jobId]/receipts/commit request
 */
export interface CommitReceiptsRequest {
  photos: Array<{
    photoId: string;
    s3Key: string;
    publicUrl: string;
    contentType: string;
  }>;
}
