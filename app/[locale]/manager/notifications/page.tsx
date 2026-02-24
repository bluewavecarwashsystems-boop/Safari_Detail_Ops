/**
 * Notifications Page
 * 
 * Full list of notifications with filtering and mark-as-read
 */

'use client';

import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { ManagerLayout } from '@/app/components/ManagerLayout';
import type { Notification } from '@/lib/types';
import { useState } from 'react';

export default function NotificationsPage() {
  const router = useRouter();
  const [filterType, setFilterType] = useState<string | null>(null);

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const filteredNotifications = filterType
    ? notifications.filter(n => n.type === filterType)
    : notifications;

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.readAt) {
      await markAsRead(notification.notificationId);
    }
    
    // Navigate to job
    router.push(`/en/jobs/${notification.jobId}`);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'JOB_CREATED':
        return '🆕';
      case 'JOB_CANCELLED':
        return '❌';
      case 'JOB_RESCHEDULED':
        return '📅';
      case 'JOB_STATUS_CHANGED':
        return '🔄';
      case 'JOB_REASSIGNED':
        return '👤';
      case 'SERVICE_CHANGED':
        return '🔧';
      case 'CHECKLIST_UPDATED':
        return '✅';
      case 'ADDONS_UPDATED':
        return '➕';
      case 'PAYMENT_STATUS_CHANGED':
        return '💰';
      default:
        return '📢';
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'JOB_CREATED': 'New Booking',
      'JOB_CANCELLED': 'Cancelled',
      'JOB_RESCHEDULED': 'Rescheduled',
      'JOB_STATUS_CHANGED': 'Status Change',
      'JOB_REASSIGNED': 'Reassigned',
      'SERVICE_CHANGED': 'Service Change',
      'CHECKLIST_UPDATED': 'Checklist',
      'ADDONS_UPDATED': 'Add-ons',
      'PAYMENT_STATUS_CHANGED': 'Payment',
    };
    return labels[type] || type;
  };

  const uniqueTypes = Array.from(new Set(notifications.map(n => n.type)));

  return (
    <ManagerLayout
      title="Notifications"
      subtitle={`${unreadCount} unread`}
      actions={
        unreadCount > 0 ? (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            Mark all read
          </button>
        ) : undefined
      }
    >
      <div className="max-w-4xl mx-auto">
        {/* Filter Tabs */}
        {uniqueTypes.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType(null)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                filterType === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              All ({notifications.length})
            </button>
            {uniqueTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
                  filterType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{getNotificationIcon(type)}</span>
                <span>{getTypeLabel(type)} ({notifications.filter(n => n.type === type).length})</span>
              </button>
            ))}
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {loading && notifications.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {filterType ? 'No notifications of this type' : 'No notifications yet'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredNotifications.map(notification => (
                <button
                  key={notification.notificationId}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                    !notification.readAt ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 text-3xl">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`text-base font-medium text-gray-900 ${
                            !notification.readAt ? 'font-semibold' : ''
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatDateTime(notification.createdAt)}
                            {notification.bookingId && (
                              <span className="ml-2">• Booking: {notification.bookingId.substring(0, 8)}</span>
                            )}
                          </p>
                        </div>

                        {/* Unread Indicator */}
                        {!notification.readAt && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}
