/**
 * Timezone Utilities for Safari Detail Ops
 * 
 * Provides timezone-aware date operations for filtering the Today's Board.
 * Uses the configured location timezone to ensure accurate date boundaries.
 */

import { startOfDay, endOfDay, parseISO, isWithinInterval } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Location timezone (configurable via environment variable)
 * Default: America/New_York (Eastern Time)
 * 
 * To use a different timezone, set LOCATION_TIMEZONE in .env:
 * LOCATION_TIMEZONE=America/Los_Angeles
 * LOCATION_TIMEZONE=America/Chicago
 * LOCATION_TIMEZONE=America/Denver
 */
export const LOCATION_TIMEZONE = process.env.LOCATION_TIMEZONE || 'America/New_York';

/**
 * Get the start of day (00:00:00) for a given date in the location timezone
 * Returns an ISO string in UTC
 * 
 * @param date - Date string (ISO) or Date object (defaults to today)
 * @returns ISO string representing start of day in UTC
 * 
 * Example:
 * - Input: '2026-02-23' in America/New_York
 * - Returns: '2026-02-23T05:00:00.000Z' (midnight EST = 5am UTC)
 */
export function getStartOfDayInTimezone(date?: string | Date): string {
  const localDate = date ? (typeof date === 'string' ? parseISO(date) : date) : new Date();
  const startOfDayLocal = startOfDay(localDate);
  const startOfDayUtc = fromZonedTime(startOfDayLocal, LOCATION_TIMEZONE);
  return startOfDayUtc.toISOString();
}

/**
 * Get the end of day (23:59:59.999) for a given date in the location timezone
 * Returns an ISO string in UTC
 * 
 * @param date - Date string (ISO) or Date object (defaults to today)
 * @returns ISO string representing end of day in UTC
 * 
 * Example:
 * - Input: '2026-02-23' in America/New_York
 * - Returns: '2026-02-24T04:59:59.999Z' (11:59:59 PM EST = 4:59:59 AM next day UTC)
 */
export function getEndOfDayInTimezone(date?: string | Date): string {
  const localDate = date ? (typeof date === 'string' ? parseISO(date) : date) : new Date();
  const endOfDayLocal = endOfDay(localDate);
  const endOfDayUtc = fromZonedTime(endOfDayLocal, LOCATION_TIMEZONE);
  return endOfDayUtc.toISOString();
}

/**
 * Check if a timestamp (in UTC) falls within a specific date in the location timezone
 * 
 * @param timestamp - ISO timestamp to check (UTC)
 * @param boardDate - Date to check against (defaults to today)
 * @returns true if timestamp is within the board date in location timezone
 * 
 * Example:
 * - timestamp: '2026-02-23T20:00:00Z' (8pm UTC)
 * - boardDate: '2026-02-23'
 * - timezone: America/New_York (EST = UTC-5)
 * - Local time: 3pm EST on Feb 23
 * - Returns: true (within Feb 23 in EST)
 */
export function isTimestampOnBoardDate(
  timestamp: string,
  boardDate?: string | Date
): boolean {
  const startOfDay = getStartOfDayInTimezone(boardDate);
  const endOfDay = getEndOfDayInTimezone(boardDate);
  
  const timestampDate = parseISO(timestamp);
  const start = parseISO(startOfDay);
  const end = parseISO(endOfDay);
  
  return isWithinInterval(timestampDate, { start, end });
}

/**
 * Get today's date as a string in YYYY-MM-DD format in the location timezone
 * 
 * @returns Date string in YYYY-MM-DD format in location timezone
 */
export function getTodayInTimezone(): string {
  const now = new Date();
  const localNow = toZonedTime(now, LOCATION_TIMEZONE);
  return localNow.toISOString().split('T')[0];
}

/**
 * Convert a UTC timestamp to a human-readable date/time in the location timezone
 * 
 * @param timestamp - ISO timestamp (UTC)
 * @returns Date object in location timezone
 */
export function toLocationTime(timestamp: string): Date {
  return toZonedTime(parseISO(timestamp), LOCATION_TIMEZONE);
}

/**
 * Get day boundaries for logging/debugging
 * 
 * @param boardDate - Date to get boundaries for (defaults to today)
 * @returns Object with start and end ISO strings
 */
export function getDayBoundaries(boardDate?: string | Date): {
  start: string;
  end: string;
  timezone: string;
  boardDate: string;
} {
  const start = getStartOfDayInTimezone(boardDate);
  const end = getEndOfDayInTimezone(boardDate);
  const dateStr = boardDate 
    ? (typeof boardDate === 'string' ? boardDate : boardDate.toISOString().split('T')[0])
    : getTodayInTimezone();
  
  return {
    start,
    end,
    timezone: LOCATION_TIMEZONE,
    boardDate: dateStr,
  };
}
