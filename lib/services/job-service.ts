/**
 * Job Management Service
 * 
 * High-level service for managing jobs, combining DynamoDB and S3 operations.
 */

import { v4 as uuidv4 } from 'uuid';
import * as dynamodb from '../aws/dynamodb';
import * as s3 from '../aws/s3';
import type { Job, UpdateJobRequest, UserAudit, PhotoMeta, ChecklistItem, CustomerCached } from '../types';
import { WorkStatus, PaymentStatus } from '../types';
import type { ParsedBooking } from '../square/booking-parser';
import { fetchCustomerWithRetry, isCacheStale, toCustomerCached } from '../square/customers-api';

/**
 * Create a job from a Square booking (Phase 3: with customer caching)
 */
export async function createJobFromBooking(booking: ParsedBooking): Promise<Job> {
  const jobId = uuidv4();
  
  // Phase 3: Fetch and cache customer details from Square if available
  let customerCached: CustomerCached | undefined;
  if (booking.customerId) {
    const cachedData = await fetchCustomerWithRetry(booking.customerId, 1);
    if (cachedData) {
      customerCached = cachedData;
    }
  }
  
  // Use cached customer name if available, otherwise use booking name or placeholder
  const displayName = customerCached?.name || 
    booking.customerName || 
    (booking.customerId ? `Customer ${booking.customerId.substring(0, 8)}...` : 'Unknown Customer');
  
  const job: Job = {
    jobId,
    customerId: booking.customerId || '',
    customerName: displayName,
    customerEmail: customerCached?.email || booking.customerEmail,
    customerPhone: customerCached?.phone || booking.customerPhone,
    vehicleInfo: {}, // Will be filled in by staff later
    serviceType: booking.serviceType || 'Detail Service',
    status: mapBookingStatusToJobStatus(booking.status),
    bookingId: booking.bookingId,
    appointmentTime: booking.appointmentTime,
    photos: [],
    photosMeta: [], // Phase 3: Initialize empty photo metadata
    notes: booking.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customerCached, // Phase 3: Cache customer data on job creation
  };

  return dynamodb.createJob(job);
}

/**
 * Update a job from a Square booking update (Phase 3: with customer cache refresh)
 */
export async function updateJobFromBooking(
  jobId: string,
  booking: ParsedBooking
): Promise<Job> {
  const currentJob = await dynamodb.getJob(jobId);
  
  // Phase 3: Refresh customer cache if stale or missing
  let customerCached: CustomerCached | undefined = currentJob?.customerCached;
  if (booking.customerId && (!customerCached || isCacheStale(customerCached.cachedAt))) {
    const cachedData = await fetchCustomerWithRetry(booking.customerId, 1);
    if (cachedData) {
      customerCached = cachedData;
      console.log('[JOB SERVICE] Customer cache refreshed', {
        jobId,
        customerId: booking.customerId,
      });
    }
  }
  
  const displayName = customerCached?.name || booking.customerName || currentJob?.customerName;
  
  const updates: Partial<Job> = {
    status: mapBookingStatusToJobStatus(booking.status),
    appointmentTime: booking.appointmentTime,
    customerName: displayName,
    customerEmail: customerCached?.email || booking.customerEmail,
    customerPhone: customerCached?.phone || booking.customerPhone,
    notes: booking.notes,
    updatedBy: 'square-webhook',
    customerCached, // Phase 3: Update cached customer data
  };
  
  // Remove undefined values to prevent DynamoDB UpdateExpression errors
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  ) as Partial<Job>;
  
  return dynamodb.updateJob(jobId, cleanUpdates);
}

/**
 * Map Square booking status to work status
 */
function mapBookingStatusToJobStatus(bookingStatus: string): WorkStatus {
  switch (bookingStatus.toUpperCase()) {
    case 'ACCEPTED':
    case 'PENDING':
      return WorkStatus.SCHEDULED;
    case 'CANCELLED':
    case 'DECLINED':
      // Note: We don't have a CANCELLED status in WorkStatus, 
      // so we'll keep them as SCHEDULED and handle cancellations separately
      return WorkStatus.SCHEDULED;
    default:
      return WorkStatus.SCHEDULED;
  }
}

/**
 * Get job by ID with photo URLs
 */
export async function getJobWithPhotos(jobId: string): Promise<Job & { photoUrls?: string[] } | null> {
  const job = await dynamodb.getJob(jobId);
  
  if (!job) {
    return null;
  }
  
  // Generate download URLs for all photos
  if (job.photos && job.photos.length > 0) {
    const photoUrls = await Promise.all(
      job.photos.map(key => s3.generateDownloadUrl(key, 3600))
    );
    
    return { ...job, photoUrls };
  }
  
  return job;
}

/**
 * Add photo to job
 */
export async function addPhotoToJob(
  jobId: string,
  filename: string,
  content: Buffer,
  contentType: string = 'image/jpeg'
): Promise<{ job: Job; photoKey: string; photoUrl: string }> {
  // Upload photo to S3
  const photoKey = await s3.uploadPhoto(jobId, filename, content, contentType);
  
  // Get current job
  const job = await dynamodb.getJob(jobId);
  
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  // Add photo key to job
  const photos = [...(job.photos || []), photoKey];
  const updatedJob = await dynamodb.updateJob(jobId, { photos });
  
  // Generate download URL
  const photoUrl = await s3.generateDownloadUrl(photoKey, 3600);
  
  return { job: updatedJob, photoKey, photoUrl };
}

/**
 * Remove photo from job
 */
export async function removePhotoFromJob(jobId: string, photoKey: string): Promise<Job> {
  // Get current job
  const job = await dynamodb.getJob(jobId);
  
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  // Remove photo key from job
  const photos = (job.photos || []).filter(key => key !== photoKey);
  const updatedJob = await dynamodb.updateJob(jobId, { photos });
  
  // Delete photo from S3
  await s3.deletePhoto(photoKey);
  
  return updatedJob;
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: WorkStatus,
  updatedBy?: string
): Promise<Job> {
  return dynamodb.updateJob(jobId, { status, updatedBy });
}

/**
 * Update job vehicle information
 */
export async function updateJobVehicle(
  jobId: string,
  vehicleInfo: Job['vehicleInfo'],
  updatedBy?: string
): Promise<Job> {
  return dynamodb.updateJob(jobId, { vehicleInfo, updatedBy });
}

/**
 * List jobs with filters
 */
export async function listJobs(options?: {
  status?: WorkStatus;
  customerId?: string;
  limit?: number;
  nextToken?: string;
}): Promise<{ jobs: Job[]; nextToken?: string }> {
  return dynamodb.listJobs(options);
}

/**
 * Delete job and all associated photos
 */
export async function deleteJobCompletely(jobId: string): Promise<void> {
  // Delete all photos
  await s3.deleteJobPhotos(jobId);
  
  // Delete job record
  await dynamodb.deleteJob(jobId);
}

/**
 * Phase 3: Update job with audit trail
 * 
 * Supports partial updates for workStatus, checklist, notes, vehicleInfo, post-completion issues
 */
export async function updateJobWithAudit(
  jobId: string,
  updates: UpdateJobRequest,
  userAudit: UserAudit
): Promise<Job | null> {
  const currentJob = await dynamodb.getJob(jobId);
  
  if (!currentJob) {
    return null;
  }

  const updateData: Partial<Job> = {
    updatedAt: new Date().toISOString(),
    updatedBy: userAudit,
  };

  const statusHistory = currentJob.statusHistory || [];

  // Update work status
  if (updates.workStatus !== undefined) {
    updateData.status = updates.workStatus;
    
    // Add status history entry for status change
    statusHistory.push({
      from: currentJob.status,
      to: updates.workStatus,
      event: 'STATUS_CHANGE',
      changedAt: new Date().toISOString(),
      changedBy: userAudit,
    });
  }

  // Handle opening post-completion issue
  if (updates.openPostCompletionIssue) {
    updateData.postCompletionIssue = {
      isOpen: true,
      type: updates.openPostCompletionIssue.type,
      notes: updates.openPostCompletionIssue.notes,
      openedAt: new Date().toISOString(),
      openedBy: {
        userId: userAudit.userId,
        name: userAudit.name,
        role: 'MANAGER' as const,
      },
    };

    // Add status history entry for issue opened
    statusHistory.push({
      from: currentJob.status,
      to: currentJob.status,
      event: 'POST_COMPLETION_ISSUE_OPENED',
      changedAt: new Date().toISOString(),
      changedBy: userAudit,
      reason: updates.openPostCompletionIssue.notes,
    });
  }

  // Handle resolving post-completion issue
  if (updates.resolvePostCompletionIssue && currentJob.postCompletionIssue) {
    updateData.postCompletionIssue = {
      ...currentJob.postCompletionIssue,
      isOpen: false,
      resolvedAt: new Date().toISOString(),
      resolvedBy: {
        userId: userAudit.userId,
        name: userAudit.name,
        role: 'MANAGER' as const,
      },
    };

    // Add status history entry for issue resolved
    statusHistory.push({
      from: currentJob.status,
      to: currentJob.status,
      event: 'POST_COMPLETION_ISSUE_RESOLVED',
      changedAt: new Date().toISOString(),
      changedBy: userAudit,
    });
  }

  // Update checklist with audit trail
  if (updates.checklist) {
    const currentChecklist = currentJob.checklist || {};
    updateData.checklist = {
      tech: updates.checklist.tech || currentChecklist.tech || [],
      qc: updates.checklist.qc || currentChecklist.qc || [],
    };
  }

  // Update notes
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }

  // Update vehicle info
  if (updates.vehicleInfo !== undefined) {
    updateData.vehicleInfo = {
      ...currentJob.vehicleInfo,
      ...updates.vehicleInfo,
    };
  }

  // Handle payment status updates
  if (updates.payment) {
    const now = new Date().toISOString();
    const currentPayment = currentJob.payment || { status: PaymentStatus.UNPAID };

    if (updates.payment.status === PaymentStatus.PAID) {
      // Mark as PAID
      updateData.payment = {
        ...currentPayment,
        status: PaymentStatus.PAID,
        paidAt: now,
        paidBy: {
          userId: userAudit.userId,
          name: userAudit.name,
          role: 'MANAGER' as const,
        },
        // Clear unpaid reason/note when marking as paid
        unpaidReason: undefined,
        unpaidNote: undefined,
      };

      // Add payment history entry
      statusHistory.push({
        from: null,
        to: null,
        event: 'PAYMENT_MARKED_PAID',
        changedAt: now,
        changedBy: userAudit,
      });
    } else if (updates.payment.status === PaymentStatus.UNPAID) {
      // Mark as UNPAID
      updateData.payment = {
        ...currentPayment,
        status: PaymentStatus.UNPAID,
        unpaidReason: updates.payment.unpaidReason,
        unpaidNote: updates.payment.unpaidNote,
        // Keep paidAt/paidBy for history if they exist
      };

      // Add payment history entry
      statusHistory.push({
        from: null,
        to: null,
        event: 'PAYMENT_MARKED_UNPAID',
        changedAt: now,
        changedBy: userAudit,
        reason: `${updates.payment.unpaidReason}${updates.payment.unpaidNote ? `: ${updates.payment.unpaidNote}` : ''}`,
      });
    }
  }

  // Phase 5: Handle no-show operations
  if (updates.noShow) {
    const now = new Date().toISOString();
    
    if (updates.noShow.status === 'NO_SHOW') {
      // Mark as NO_SHOW
      updateData.noShow = {
        status: 'NO_SHOW',
        reason: updates.noShow.reason,
        notes: updates.noShow.notes,
        updatedAt: now,
        updatedBy: {
          userId: userAudit.userId,
          name: userAudit.name,
          role: 'MANAGER' as const,
        },
      };

      // Add audit trail
      statusHistory.push({
        from: currentJob.status,
        to: currentJob.status,
        event: 'NO_SHOW_MARKED',
        changedAt: now,
        changedBy: userAudit,
        reason: `${updates.noShow.reason}${updates.noShow.notes ? `: ${updates.noShow.notes}` : ''}`,
      });
    } else if (updates.noShow.status === 'RESOLVED') {
      // Resolve NO_SHOW
      const currentNoShow = currentJob.noShow;
      if (currentNoShow) {
        updateData.noShow = {
          ...currentNoShow,
          status: 'RESOLVED',
          resolvedAt: now,
          resolvedBy: {
            userId: userAudit.userId,
            name: userAudit.name,
            role: 'MANAGER' as const,
          },
        };

        // Update notes if provided
        if (updates.noShow.notes) {
          updateData.noShow.notes = updates.noShow.notes;
        }

        // Add audit trail
        statusHistory.push({
          from: currentJob.status,
          to: currentJob.status,
          event: 'NO_SHOW_RESOLVED',
          changedAt: now,
          changedBy: userAudit,
          reason: updates.noShow.notes,
        });
      }
    }
  }

  // Update status history if there are any changes
  if (statusHistory.length > 0) {
    updateData.statusHistory = statusHistory;
  }

  return dynamodb.updateJob(jobId, updateData);
}

/**
 * Phase 3: Generate presigned URLs for photo uploads
 */
export async function generatePresignedUploadUrls(
  jobId: string,
  files: Array<{ filename: string; contentType: string; category?: PhotoMeta['category'] }>
): Promise<Array<{
  photoId: string;
  s3Key: string;
  putUrl: string;
  publicUrl: string;
  contentType: string;
  category?: PhotoMeta['category'];
}>> {
  const config = await import('../config').then(m => m.getConfig());
  
  const uploads = await Promise.all(
    files.map(async (file) => {
      const photoId = uuidv4();
      
      // Generate presigned PUT URL (5 minutes expiry) - this returns the actual S3 key
      const { url: putUrl, key: s3Key } = await s3.generateUploadUrl(jobId, file.filename, file.contentType, 300);
      
      // Build public URL using the actual S3 key
      const publicUrl = `https://${config.aws.s3.photosBucket}.s3.${config.aws.region}.amazonaws.com/${s3Key}`;
      
      return {
        photoId,
        s3Key,
        putUrl,
        publicUrl,
        contentType: file.contentType,
        category: file.category,
      };
    })
  );

  return uploads;
}

/**
 * Phase 3: Commit uploaded photos to job metadata
 */
export async function commitPhotosToJob(
  jobId: string,
  photos: Array<{
    photoId: string;
    s3Key: string;
    publicUrl: string;
    contentType: string;
    category?: 'before' | 'after' | 'damage' | 'other';
  }>,
  userAudit: UserAudit
): Promise<Job | null> {
  const currentJob = await dynamodb.getJob(jobId);
  
  if (!currentJob) {
    return null;
  }

  const newPhotosMeta: PhotoMeta[] = photos.map(photo => ({
    photoId: photo.photoId,
    s3Key: photo.s3Key,
    publicUrl: photo.publicUrl,
    contentType: photo.contentType,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userAudit,
    category: photo.category,
  }));

  const existingPhotosMeta = currentJob.photosMeta || [];
  const updatedPhotosMeta = [...existingPhotosMeta, ...newPhotosMeta];

  return dynamodb.updateJob(jobId, {
    photosMeta: updatedPhotosMeta,
    updatedAt: new Date().toISOString(),
    updatedBy: userAudit,
  });
}

/**
 * Payment toggle: Generate presigned URLs for receipt uploads
 */
export async function generatePresignedReceiptUrls(
  jobId: string,
  files: Array<{ filename: string; contentType: string }>
): Promise<Array<{
  photoId: string;
  s3Key: string;
  putUrl: string;
  publicUrl: string;
  contentType: string;
}>> {
  const config = await import('../config').then(m => m.getConfig());
  
  const uploads = await Promise.all(
    files.map(async (file) => {
      const photoId = uuidv4();
      const timestamp = Date.now();
      const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Receipt-specific S3 key convention
      const s3Key = `jobs/${jobId}/receipts/${photoId}-${sanitizedFilename}`;
      
      // Generate presigned PUT URL (5 minutes expiry)
      const client = s3.getS3Client();
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const command = new PutObjectCommand({
        Bucket: config.aws.s3.photosBucket,
        Key: s3Key,
        ContentType: file.contentType,
        Metadata: {
          jobId,
          type: 'receipt',
        },
      });
      
      const putUrl = await getSignedUrl(client, command, { expiresIn: 300 });
      
      // Build public URL
      const publicUrl = `https://${config.aws.s3.photosBucket}.s3.${config.aws.region}.amazonaws.com/${s3Key}`;
      
      return {
        photoId,
        s3Key,
        putUrl,
        publicUrl,
        contentType: file.contentType,
      };
    })
  );

  return uploads;
}

/**
 * Payment toggle: Commit uploaded receipts to job record
 */
export async function commitReceiptsToJob(
  jobId: string,
  receipts: Array<{
    photoId: string;
    s3Key: string;
    publicUrl: string;
    contentType: string;
  }>,
  userAudit: UserAudit
): Promise<Job | null> {
  const currentJob = await dynamodb.getJob(jobId);
  
  if (!currentJob) {
    return null;
  }

  const newReceipts = receipts.map(receipt => ({
    photoId: receipt.photoId,
    s3Key: receipt.s3Key,
    publicUrl: receipt.publicUrl,
    contentType: receipt.contentType,
    uploadedAt: new Date().toISOString(),
    uploadedBy: {
      userId: userAudit.userId,
      name: userAudit.name,
      role: 'MANAGER' as const,
    },
  }));

  const existingReceipts = currentJob.receiptPhotos || [];
  const updatedReceipts = [...existingReceipts, ...newReceipts];

  return dynamodb.updateJob(jobId, {
    receiptPhotos: updatedReceipts,
    updatedAt: new Date().toISOString(),
    updatedBy: userAudit,
  });
}
