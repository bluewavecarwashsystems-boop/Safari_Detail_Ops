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
 * Job record (future DynamoDB schema)
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
  status: JobStatus;
  bookingId?: string; // Square booking ID
  appointmentTime?: string;
  photos?: string[]; // S3 keys
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
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
