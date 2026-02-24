/**
 * NotificationBell Component
 * 
 * Bell icon with unread badge and dropdown for recent notifications
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/hooks/useNotifications';
import type { Notification } from '@/lib/types';

interface NotificationBellProps {
  onNewNotification?: (notification: Notification) => void;
}

export function NotificationBell({ onNewNotification }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleNewNotifications = (newNotifications: Notification[]) => {
    // Show toast for the most recent notification
    if (newNotifications.length > 0 && onNewNotification) {
      // Only toast for high-priority types
      const toastableTypes = [
        'JOB_CREATED',
        'JOB_CANCELLED',
        'JOB_RESCHEDULED',
        'JOB_STATUS_CHANGED',
      ];
      
      const mostRecent = newNotifications[0];
      if (toastableTypes.includes(mostRecent.type)) {
        onNewNotification(mostRecent);
      }
    }
  };

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications({
    onNewNotifications: handleNewNotifications,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.readAt) {
      await markAsRead(notification.notificationId);
    }
    
    // Navigate to job
    setIsOpen(false);
    router.push(`/en/jobs/${notification.jobId}`);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push('/en/manager/notifications');
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
      default:
        return '📢';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
        title="Notifications"
      >
        {/* Bell Icon */}
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
          style={{ maxHeight: '500px' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              <>
                {notifications.slice(0, 15).map(notification => (
                  <button
                    key={notification.notificationId}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                      !notification.readAt ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 text-2xl">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium text-gray-900 ${
                          !notification.readAt ? 'font-semibold' : ''
                        }`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>

                      {/* Unread Indicator */}
                      {!notification.readAt && (
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200">
            <button
              onClick={handleViewAll}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
