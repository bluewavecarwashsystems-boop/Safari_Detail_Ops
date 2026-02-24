/**
 * Notification Service
 * 
 * High-level service for creating and managing notifications.
 * Generates notifications for major job events.
 */

import { v4 as uuidv4 } from 'uuid';
import * as notificationsDb from '../aws/notifications';
import type { 
  Notification, 
  NotificationType, 
  Job, 
  WorkStatus 
} from '../types';
import { getConfig } from '../config';

const FRANKLIN_LOCATION_ID = 'L9ZMZD9TTTTZJ';

/**
 * Create a notification for a job event
 */
async function createNotification(params: {
  type: NotificationType;
  jobId: string;
  bookingId?: string;
  title: string;
  message: string;
  payload?: any;
  actor: string;
  dedupeKey?: string;
}): Promise<Notification | null> {
  const { type, jobId, bookingId, title, message, payload, actor, dedupeKey } = params;
  
  // Check for duplicates if dedupeKey provided
  if (dedupeKey) {
    const isDuplicate = await notificationsDb.isDuplicateNotification(
      FRANKLIN_LOCATION_ID,
      dedupeKey,
      5 // Within 5 minutes
    );
    
    if (isDuplicate) {
      console.log('[NOTIFICATION] Skipping duplicate', { type, jobId, dedupeKey });
      return null;
    }
  }
  
  const notification: Notification = {
    notificationId: uuidv4(),
    locationId: FRANKLIN_LOCATION_ID,
    type,
    jobId,
    bookingId,
    title,
    message,
    payload,
    actor,
    createdAt: new Date().toISOString(),
  };
  
  return await notificationsDb.createNotification(notification);
}

/**
 * Notify: New job created
 */
export async function notifyJobCreated(
  job: Job,
  source: 'square' | 'phone',
  eventId?: string,
  actorEmail?: string
): Promise<Notification | null> {
  const sourceLabel = source === 'square' ? 'Online' : 'Phone';
  
  // For phone bookings, use employee email prefix; for online, use customer name
  let message: string;
  if (source === 'phone' && actorEmail) {
    const emailPrefix = actorEmail.split('@')[0];
    message = `${emailPrefix} • ${job.serviceType}`;
  } else {
    message = `${job.customerName} • ${job.serviceType}`;
  }
  
  return await createNotification({
    type: 'JOB_CREATED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: `New ${sourceLabel} Booking`,
    message,
    payload: {
      source,
      customerName: job.customerName,
      serviceType: job.serviceType,
      appointmentTime: job.appointmentTime,
      actorEmail,
    },
    actor: source === 'square' ? (eventId ? `square:${eventId}` : 'square') : (actorEmail ? `phone:${actorEmail}` : 'system'),
    dedupeKey: eventId ? `square:${eventId}` : undefined,
  });
}

/**
 * Notify: Job cancelled
 */
export async function notifyJobCancelled(
  job: Job,
  source: 'square' | 'manual',
  eventId?: string
): Promise<Notification | null> {
  return await createNotification({
    type: 'JOB_CANCELLED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: 'Booking Cancelled',
    message: `${job.customerName} • ${job.serviceType}`,
    payload: {
      source,
      customerName: job.customerName,
      serviceType: job.serviceType,
      cancelledAt: job.cancelledAt,
      cancellationReason: job.cancellationReason,
    },
    actor: source === 'square' ? (eventId ? `square:${eventId}` : 'square') : 'system',
    dedupeKey: eventId ? `square:${eventId}:cancel` : undefined,
  });
}

/**
 * Notify: Job rescheduled (appointment time changed)
 */
export async function notifyJobRescheduled(
  job: Job,
  oldTime: string,
  newTime: string,
  eventId?: string
): Promise<Notification | null> {
  const oldDate = new Date(oldTime);
  const newDate = new Date(newTime);
  
  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };
  
  return await createNotification({
    type: 'JOB_RESCHEDULED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: 'Booking Rescheduled',
    message: `${job.customerName} • ${formatTime(oldDate)} → ${formatTime(newDate)}`,
    payload: {
      oldTime,
      newTime,
      customerName: job.customerName,
    },
    actor: eventId ? `square:${eventId}` : 'square',
    dedupeKey: eventId ? `square:${eventId}:reschedule` : undefined,
  });
}

/**
 * Notify: Job status changed
 */
export async function notifyJobStatusChanged(
  job: Job,
  oldStatus: WorkStatus,
  newStatus: WorkStatus,
  userId?: string
): Promise<Notification | null> {
  // Only notify for meaningful status changes
  const notifiableStatuses = [
    'CHECKED_IN',
    'IN_PROGRESS',
    'QC_READY',
    'WORK_COMPLETED',
    'NO_SHOW_PENDING_CHARGE',
    'CANCELLED',
  ];
  
  if (!notifiableStatuses.includes(newStatus)) {
    return null;
  }
  
  const statusLabels: Record<WorkStatus, string> = {
    'SCHEDULED': 'Scheduled',
    'CHECKED_IN': 'Checked In',
    'IN_PROGRESS': 'In Progress',
    'QC_READY': 'QC Ready',
    'WORK_COMPLETED': 'Completed',
    'NO_SHOW_PENDING_CHARGE': 'No Show',
    'NO_SHOW_CHARGED': 'No Show Charged',
    'NO_SHOW_FAILED': 'No Show Failed',
    'CANCELLED': 'Cancelled',
  };
  
  return await createNotification({
    type: 'JOB_STATUS_CHANGED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: 'Status Updated',
    message: `${job.customerName} • ${statusLabels[newStatus]}`,
    payload: {
      oldStatus,
      newStatus,
      customerName: job.customerName,
    },
    actor: userId ? `user:${userId}` : 'system',
  });
}

/**
 * Notify: Service changed
 */
export async function notifyServiceChanged(
  job: Job,
  oldService: string,
  newService: string,
  eventId?: string
): Promise<Notification | null> {
  return await createNotification({
    type: 'SERVICE_CHANGED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: 'Service Changed',
    message: `${job.customerName} • ${oldService} → ${newService}`,
    payload: {
      oldService,
      newService,
      customerName: job.customerName,
    },
    actor: eventId ? `square:${eventId}` : 'square',
    dedupeKey: eventId ? `square:${eventId}:service` : undefined,
  });
}

/**
 * Notify: Team member reassigned
 */
export async function notifyTeamMemberChanged(
  job: Job,
  oldMember: string | undefined,
  newMember: string | undefined,
  eventId?: string
): Promise<Notification | null> {
  if (!oldMember && !newMember) {
    return null;
  }
  
  const message = oldMember && newMember
    ? `${job.customerName} • Reassigned`
    : newMember
    ? `${job.customerName} • Assigned`
    : `${job.customerName} • Unassigned`;
  
  return await createNotification({
    type: 'JOB_REASSIGNED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: 'Team Member Changed',
    message,
    payload: {
      oldMember,
      newMember,
      customerName: job.customerName,
    },
    actor: eventId ? `square:${eventId}` : 'square',
    dedupeKey: eventId ? `square:${eventId}:member` : undefined,
  });
}

/**
 * Notify: Checklist updated
 */
export async function notifyChecklistUpdated(
  job: Job,
  checklistType: 'tech' | 'qc',
  userId?: string
): Promise<Notification | null> {
  const typeLabel = checklistType === 'tech' ? 'Tech' : 'QC';
  
  return await createNotification({
    type: 'CHECKLIST_UPDATED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: `${typeLabel} Checklist Updated`,
    message: `${job.customerName}`,
    payload: {
      checklistType,
      customerName: job.customerName,
    },
    actor: userId ? `user:${userId}` : 'system',
  });
}

/**
 * Notify: Add-ons changed
 */
export async function notifyAddonsUpdated(
  job: Job,
  addons: string[],
  userId?: string
): Promise<Notification | null> {
  return await createNotification({
    type: 'ADDONS_UPDATED' as NotificationType,
    jobId: job.jobId,
    bookingId: job.bookingId,
    title: 'Add-ons Updated',
    message: `${job.customerName} • ${addons.join(', ')}`,
    payload: {
      addons,
      customerName: job.customerName,
    },
    actor: userId ? `user:${userId}` : 'system',
  });
}

/**
 * Get notifications for location
 */
export async function getNotifications(
  locationId: string,
  since?: string,
  limit?: number
): Promise<Notification[]> {
  return await notificationsDb.getNotifications(locationId, since, limit);
}

/**
 * Get unread count
 */
export async function getUnreadCount(locationId: string): Promise<number> {
  return await notificationsDb.getUnreadCount(locationId);
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  return await notificationsDb.markAsRead(notificationId);
}

/**
 * Mark all notifications as read for location
 */
export async function markAllAsRead(locationId: string): Promise<number> {
  return await notificationsDb.markAllAsRead(locationId);
}
