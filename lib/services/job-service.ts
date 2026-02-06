/**
 * Job Management Service
 * 
 * High-level service for managing jobs, combining DynamoDB and S3 operations.
 */

import { v4 as uuidv4 } from 'uuid';
import * as dynamodb from '../aws/dynamodb';
import * as s3 from '../aws/s3';
import type { Job } from '../types';
import { JobStatus } from '../types';
import type { ParsedBooking } from '../square/booking-parser';

/**
 * Create a job from a Square booking
 */
export async function createJobFromBooking(booking: ParsedBooking): Promise<Job> {
  const jobId = uuidv4();
  
  const job: Job = {
    jobId,
    customerId: booking.customerId || '',
    customerName: booking.customerName || 'Unknown Customer',
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    vehicleInfo: {}, // Will be filled in by staff later
    serviceType: booking.serviceType || 'Detail Service',
    status: mapBookingStatusToJobStatus(booking.status),
    bookingId: booking.bookingId,
    appointmentTime: booking.appointmentTime,
    photos: [],
    notes: booking.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'square-webhook',
  };
  
  return dynamodb.createJob(job);
}

/**
 * Update a job from a Square booking update
 */
export async function updateJobFromBooking(
  jobId: string,
  booking: ParsedBooking
): Promise<Job> {
  const updates: Partial<Job> = {
    status: mapBookingStatusToJobStatus(booking.status),
    appointmentTime: booking.appointmentTime,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    notes: booking.notes,
    updatedBy: 'square-webhook',
  };
  
  // Remove undefined values to prevent DynamoDB UpdateExpression errors
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  ) as Partial<Job>;
  
  return dynamodb.updateJob(jobId, cleanUpdates);
}

/**
 * Map Square booking status to job status
 */
function mapBookingStatusToJobStatus(bookingStatus: string): JobStatus {
  switch (bookingStatus.toUpperCase()) {
    case 'ACCEPTED':
    case 'PENDING':
      return JobStatus.PENDING;
    case 'CANCELLED':
    case 'DECLINED':
      return JobStatus.CANCELLED;
    default:
      return JobStatus.PENDING;
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
  status: JobStatus,
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
  status?: JobStatus;
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
