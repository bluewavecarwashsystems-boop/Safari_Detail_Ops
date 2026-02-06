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
 * Job status enum
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
