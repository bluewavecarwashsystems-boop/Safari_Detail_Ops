/**
 * Board Filtering Utilities
 * 
 * Centralized filtering logic for the Today's Board.
 * Ensures only jobs scheduled for the selected date appear in the Scheduled column.
 */

import type { Job, WorkStatus } from '../types';
import { WorkStatus as WS } from '../types';
import { isTimestampOnBoardDate } from './timezone';

/**
 * Filter jobs to only include those scheduled for a specific board date.
 * 
 * Rules:
 * 1. Jobs with appointmentTime on the board date are included
 * 2. Jobs without appointmentTime but with createdAt on the board date are included
 * 3. Jobs in active states (CHECKED_IN, IN_PROGRESS, QC_READY) for today are always included
 *    (to avoid disappearing jobs mid-workflow)
 * 4. Jobs in WORK_COMPLETED are excluded (they belong to history, not today's board)
 * 
 * @param jobs - Array of jobs to filter
 * @param boardDate - Date to filter for (ISO string YYYY-MM-DD, defaults to today)
 * @returns Filtered array of jobs
 */
export function filterJobsByBoardDate(
  jobs: Job[],
  boardDate?: string
): Job[] {
  // Active states that should stay on the board once started
  const activeStates: WorkStatus[] = [
    WS.CHECKED_IN,
    WS.IN_PROGRESS,
    WS.QC_READY,
  ];

  const today = boardDate ? new Date(boardDate) : new Date();
  today.setHours(0, 0, 0, 0);

  return jobs.filter(job => {
    const status = job.status || job.workStatus;
    
    // Exclude completed jobs - they don't belong on today's board
    if (status === WS.WORK_COMPLETED) {
      return false;
    }
    
    // If job is in an active state, keep it on the board if it's from today or earlier
    // This prevents jobs from disappearing mid-workflow
    if (activeStates.includes(status as WorkStatus)) {
      const timestamp = job.appointmentTime || job.createdAt;
      if (timestamp) {
        const jobDate = new Date(timestamp);
        jobDate.setHours(0, 0, 0, 0);
        
        // Include if job is from today or earlier
        if (jobDate <= today) {
          return true;
        }
      }
    }
    
    // For SCHEDULED jobs (and any other states), only show if appointmentTime is on the board date
    const timestamp = job.appointmentTime || job.createdAt;
    
    if (!timestamp) {
      // No timestamp - include it to be safe (shouldn't happen in production)
      console.warn('[BOARD FILTER] Job missing appointmentTime and createdAt', {
        jobId: job.jobId,
        status,
      });
      return true;
    }
    
    return isTimestampOnBoardDate(timestamp, boardDate);
  });
}

/**
 * Get filtering statistics for logging/debugging
 * 
 * @param allJobs - Original job list
 * @param filteredJobs - Filtered job list
 * @param boardDate - Board date used for filtering
 * @returns Statistics object
 */
export function getFilteringStats(
  allJobs: Job[],
  filteredJobs: Job[],
  boardDate?: string
): {
  total: number;
  filtered: number;
  excluded: number;
  byStatus: Record<string, number>;
  boardDate: string;
} {
  const byStatus: Record<string, number> = {};
  
  filteredJobs.forEach(job => {
    const status = job.status || job.workStatus || 'UNKNOWN';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  
  return {
    total: allJobs.length,
    filtered: filteredJobs.length,
    excluded: allJobs.length - filteredJobs.length,
    byStatus,
    boardDate: boardDate || new Date().toISOString().split('T')[0],
  };
}
