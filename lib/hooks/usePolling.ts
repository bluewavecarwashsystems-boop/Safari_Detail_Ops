/**
 * Real-time Polling Hook
 * 
 * Provides automatic polling with:
 * - Pause when tab is hidden (document.hidden)
 * - Abort controller to prevent overlapping requests
 * - Error handling and last updated tracking
 * - Configurable interval
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PollingOptions {
  /**
   * Whether polling is enabled
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Whether to run immediately on mount
   * @default true
   */
  runOnMount?: boolean;
  
  /**
   * Whether to pause polling when document is hidden
   * @default true
   */
  pauseWhenHidden?: boolean;
}

export interface PollingState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastUpdatedAt: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for automatic polling with pause/resume on visibility change
 * 
 * @param fetcher - Async function to fetch data
 * @param intervalMs - Polling interval in milliseconds
 * @param options - Additional options
 * @returns Polling state and refresh function
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  options: PollingOptions = {}
): PollingState<T> {
  const {
    enabled = true,
    runOnMount = true,
    pauseWhenHidden = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // Track if component is mounted
  const isMounted = useRef(true);
  
  // Track current request to abort if needed
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track interval ID
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch data with abort support
   */
  const fetchData = useCallback(async () => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);
      setError(null);

      const result = await fetcher();

      // Only update state if not aborted and component is still mounted
      if (!abortController.signal.aborted && isMounted.current) {
        // Only update if data actually changed (avoid unnecessary re-renders)
        setData((prevData) => {
          const newDataStr = JSON.stringify(result);
          const prevDataStr = JSON.stringify(prevData);
          return newDataStr !== prevDataStr ? result : prevData;
        });
        setLastUpdatedAt(new Date());
        setLoading(false);
      }
    } catch (err) {
      if (!abortController.signal.aborted && isMounted.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('[usePolling] Fetch error:', error);
        setError(error);
        setLoading(false);
      }
    }
  }, [fetcher]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    isMounted.current = true;

    // Only start polling if enabled
    if (!enabled) {
      return;
    }

    // Run immediately on mount if requested
    if (runOnMount) {
      fetchData();
    }

    // Start polling interval
    const startInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        // Check if document is hidden and pause if requested
        if (pauseWhenHidden && typeof document !== 'undefined' && document.hidden) {
          console.log('[usePolling] Skipping fetch - document hidden');
          return;
        }
        fetchData();
      }, intervalMs);
    };

    startInterval();

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!pauseWhenHidden) {
        return;
      }

      if (typeof document !== 'undefined') {
        if (document.hidden) {
          console.log('[usePolling] Document hidden - pausing interval');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          console.log('[usePolling] Document visible - resuming polling');
          // Fetch immediately when becoming visible
          fetchData();
          // Restart interval
          startInterval();
        }
      }
    };

    if (pauseWhenHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Cleanup
    return () => {
      isMounted.current = false;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [enabled, intervalMs, pauseWhenHidden, runOnMount, fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdatedAt,
    refresh,
  };
}
