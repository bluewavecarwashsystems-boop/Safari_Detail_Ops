/**
 * Notifications Hook
 * 
 * Polls for notifications every 15 seconds and provides toast alerts for new notifications
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification } from '@/lib/types';

const FRANKLIN_LOCATION_ID = 'L9ZMZD9TTTTZJ';
const POLL_INTERVAL_MS = 15000; // 15 seconds

interface UseNotificationsOptions {
  enabled?: boolean;
  onNewNotifications?: (notifications: Notification[]) => void;
}

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsResult {
  const { enabled = true, onNewNotifications } = options;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const lastCheckTimestamp = useRef<string | null>(null);
  const previousNotificationIds = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        locationId: FRANKLIN_LOCATION_ID,
        limit: '50',
      });
      
      if (lastCheckTimestamp.current) {
        params.append('since', lastCheckTimestamp.current);
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        const newNotifications = data.data.notifications as Notification[];
        
        // Detect new notifications for toasts
        if (onNewNotifications && lastCheckTimestamp.current) {
          const newIds = new Set(newNotifications.map(n => n.notificationId));
          const addedNotifications = newNotifications.filter(
            n => !previousNotificationIds.current.has(n.notificationId)
          );
          
          if (addedNotifications.length > 0) {
            onNewNotifications(addedNotifications);
          }
        }
        
        // Update state
        setNotifications(prev => {
          // Merge new notifications with existing
          const existingIds = new Set(prev.map(n => n.notificationId));
          const merged = [...prev];
          
          for (const notification of newNotifications) {
            if (!existingIds.has(notification.notificationId)) {
              merged.push(notification);
            }
          }
          
          // Sort by createdAt descending
          merged.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Keep only the latest 50
          return merged.slice(0, 50);
        });
        
        setUnreadCount(data.data.unreadCount);
        setError(null);
        
        // Update tracking
        lastCheckTimestamp.current = new Date().toISOString();
        previousNotificationIds.current = new Set(
          [...previousNotificationIds.current, ...newNotifications.map(n => n.notificationId)]
        );
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onNewNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.notificationId === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/notifications/read-all?locationId=${FRANKLIN_LOCATION_ID}`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      
      // Update local state
      const readAt = new Date().toISOString();
      setNotifications(prev =>
        prev.map(n => ({ ...n, readAt }))
      );
      
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchNotifications();

    // Set up polling
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
