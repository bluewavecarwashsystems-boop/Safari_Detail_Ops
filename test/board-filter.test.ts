/**
 * Unit Tests for Board Date Filtering
 * 
 * Tests timezone conversion and date filtering logic for Today's Board.
 */

import { filterJobsByBoardDate } from '../lib/utils/board-filters';
import {
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  isTimestampOnBoardDate,
  getTodayInTimezone,
} from '../lib/utils/timezone';
import type { Job, WorkStatus } from '../lib/types';

/**
 * Helper to create a test job
 */
function createTestJob(
  jobId: string,
  appointmentTime: string,
  status: WorkStatus
): Job {
  return {
    jobId,
    customerId: 'test-customer',
    customerName: 'Test Customer',
    vehicleInfo: {},
    serviceType: 'Test Service',
    status,
    appointmentTime,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Test Suite 1: Timezone Conversion
 */
console.log('\n=== Test Suite 1: Timezone Conversion ===\n');

// Test 1.1: Late night booking (11:30 PM EST)
const testDate = '2026-02-23';
const lateNightBooking = '2026-02-24T04:30:00.000Z'; // 11:30 PM EST on Feb 23
console.log('Test 1.1: Late night booking (11:30 PM local)');
console.log('  Input UTC:', lateNightBooking);
console.log('  Board Date:', testDate);
console.log('  Is on board date?', isTimestampOnBoardDate(lateNightBooking, testDate));
console.log('  Expected: true (11:30 PM Feb 23 EST should be on Feb 23)');
console.log('  Result:', isTimestampOnBoardDate(lateNightBooking, testDate) ? '✅ PASS' : '❌ FAIL');

// Test 1.2: Early morning booking (12:15 AM EST next day)
const earlyMorningBooking = '2026-02-24T05:15:00.000Z'; // 12:15 AM EST on Feb 24
console.log('\nTest 1.2: Early morning booking (12:15 AM next day local)');
console.log('  Input UTC:', earlyMorningBooking);
console.log('  Board Date:', testDate);
console.log('  Is on board date?', isTimestampOnBoardDate(earlyMorningBooking, testDate));
console.log('  Expected: false (12:15 AM Feb 24 EST should NOT be on Feb 23)');
console.log('  Result:', !isTimestampOnBoardDate(earlyMorningBooking, testDate) ? '✅ PASS' : '❌ FAIL');

// Test 1.3: Day boundaries
console.log('\nTest 1.3: Day boundaries for', testDate);
const startOfDay = getStartOfDayInTimezone(testDate);
const endOfDay = getEndOfDayInTimezone(testDate);
console.log('  Start of day (UTC):', startOfDay);
console.log('  End of day (UTC):', endOfDay);
console.log('  Expected start: 2026-02-23T05:00:00.000Z (midnight EST = 5am UTC)');
console.log('  Expected end: 2026-02-24T04:59:59.999Z (11:59:59 PM EST)');
console.log('  Result:', startOfDay === '2026-02-23T05:00:00.000Z' ? '✅ PASS' : '❌ FAIL');

/**
 * Test Suite 2: Job Filtering
 */
console.log('\n\n=== Test Suite 2: Job Filtering ===\n');

const boardDate = '2026-02-23';

const testJobs: Job[] = [
  // Jobs for Feb 23 (should be included)
  createTestJob('job1', '2026-02-23T10:00:00.000Z', 'SCHEDULED'), // 5am EST Feb 23
  createTestJob('job2', '2026-02-23T15:00:00.000Z', 'SCHEDULED'), // 10am EST Feb 23
  createTestJob('job3', '2026-02-24T04:00:00.000Z', 'SCHEDULED'), // 11pm EST Feb 23
  
  // Jobs for Feb 24 (should be excluded)
  createTestJob('job4', '2026-02-24T10:00:00.000Z', 'SCHEDULED'), // 5am EST Feb 24
  createTestJob('job5', '2026-02-25T15:00:00.000Z', 'SCHEDULED'), // Future date
  
  // Active state jobs from earlier dates (should be included)
  createTestJob('job6', '2026-02-22T15:00:00.000Z', 'IN_PROGRESS'), // Yesterday but in progress
  createTestJob('job7', '2026-02-22T15:00:00.000Z', 'CHECKED_IN'), // Yesterday but checked in
  
  // Completed job (should be excluded)
  createTestJob('job8', '2026-02-23T15:00:00.000Z', 'WORK_COMPLETED'), // Today but completed
];

// Test 2.1: Filter jobs for board date
console.log('Test 2.1: Filter jobs for', boardDate);
const filteredJobs = filterJobsByBoardDate(testJobs, boardDate);
console.log('  Total jobs:', testJobs.length);
console.log('  Filtered jobs:', filteredJobs.length);
console.log('  Filtered job IDs:', filteredJobs.map(j => j.jobId).join(', '));
console.log('  Expected: job1, job2, job3, job6, job7 (5 jobs)');
console.log('  Excluded: job4 (future), job5 (future), job8 (completed)');
console.log('  Result:', filteredJobs.length === 5 ? '✅ PASS' : '❌ FAIL');

// Test 2.2: Verify scheduled jobs are today only
console.log('\nTest 2.2: Scheduled jobs are today only');
const scheduledJobs = filteredJobs.filter(j => j.status === 'SCHEDULED');
const allScheduledAreToday = scheduledJobs.every(job => 
  isTimestampOnBoardDate(job.appointmentTime!, boardDate)
);
console.log('  Scheduled jobs in result:', scheduledJobs.length);
console.log('  All scheduled are for today?', allScheduledAreToday);
console.log('  Expected: true (3 scheduled jobs, all for Feb 23)');
console.log('  Result:', allScheduledAreToday && scheduledJobs.length === 3 ? '✅ PASS' : '❌ FAIL');

// Test 2.3: Active jobs from past are included
console.log('\nTest 2.3: Active jobs from past are kept on board');
const activeFromPast = filteredJobs.filter(j => 
  (j.status === 'IN_PROGRESS' || j.status === 'CHECKED_IN') &&
  !isTimestampOnBoardDate(j.appointmentTime!, boardDate)
);
console.log('  Active jobs from past:', activeFromPast.length);
console.log('  Job IDs:', activeFromPast.map(j => j.jobId).join(', '));
console.log('  Expected: 2 (job6, job7)');
console.log('  Result:', activeFromPast.length === 2 ? '✅ PASS' : '❌ FAIL');

// Test 2.4: Completed jobs are excluded
console.log('\nTest 2.4: Completed jobs are excluded from board');
const completedJobs = filteredJobs.filter(j => j.status === 'WORK_COMPLETED');
console.log('  Completed jobs in result:', completedJobs.length);
console.log('  Expected: 0 (completed jobs don\'t belong on today\'s board)');
console.log('  Result:', completedJobs.length === 0 ? '✅ PASS' : '❌ FAIL');

/**
 * Test Suite 3: Edge Cases
 */
console.log('\n\n=== Test Suite 3: Edge Cases ===\n');

// Test 3.1: Job with no appointmentTime (uses createdAt)
console.log('Test 3.1: Job with no appointmentTime');
const jobNoAppointment: Job = {
  jobId: 'job-no-apt',
  customerId: 'test',
  customerName: 'Test',
  vehicleInfo: {},
  serviceType: 'Test',
  status: 'SCHEDULED',
  createdAt: '2026-02-23T15:00:00.000Z', // 10am EST Feb 23
  updatedAt: new Date().toISOString(),
};
const filteredNoApt = filterJobsByBoardDate([jobNoAppointment], '2026-02-23');
console.log('  Job included?', filteredNoApt.length === 1);
console.log('  Expected: true (falls back to createdAt)');
console.log('  Result:', filteredNoApt.length === 1 ? '✅ PASS' : '❌ FAIL');

// Test 3.2: Midnight boundary (exactly 00:00:00)
console.log('\nTest 3.2: Midnight boundary');
const midnightJob = createTestJob('midnight', '2026-02-23T05:00:00.000Z', 'SCHEDULED'); // Exactly midnight EST
const filteredMidnight = filterJobsByBoardDate([midnightJob], '2026-02-23');
console.log('  Midnight job included?', filteredMidnight.length === 1);
console.log('  Expected: true (00:00:00 is start of day)');
console.log('  Result:', filteredMidnight.length === 1 ? '✅ PASS' : '❌ FAIL');

// Test 3.3: Just before midnight (23:59:59)
console.log('\nTest 3.3: Just before midnight');
const justBeforeMidnight = createTestJob('before-midnight', '2026-02-24T04:59:59.000Z', 'SCHEDULED'); // 11:59:59 PM EST Feb 23
const filteredBefore = filterJobsByBoardDate([justBeforeMidnight], '2026-02-23');
console.log('  Job included?', filteredBefore.length === 1);
console.log('  Expected: true (23:59:59 is still part of the day)');
console.log('  Result:', filteredBefore.length === 1 ? '✅ PASS' : '❌ FAIL');

/**
 * Test Suite 4: Today's Date
 */
console.log('\n\n=== Test Suite 4: Today\'s Date ===\n');

console.log('Test 4.1: Get today in timezone');
const today = getTodayInTimezone();
console.log('  Today (YYYY-MM-DD):', today);
console.log('  Expected format: YYYY-MM-DD');
console.log('  Result:', /^\d{4}-\d{2}-\d{2}$/.test(today) ? '✅ PASS' : '❌ FAIL');

/**
 * Summary
 */
console.log('\n\n=== Test Summary ===\n');
console.log('All tests completed. Review results above.');
console.log('Key validations:');
console.log('  ✓ Timezone conversion (late night, early morning)');
console.log('  ✓ Date boundary calculation');
console.log('  ✓ Job filtering (today only in Scheduled)');
console.log('  ✓ Active jobs stay on board');
console.log('  ✓ Completed jobs excluded');
console.log('  ✓ Edge cases (midnight boundaries, missing appointmentTime)');
console.log('\nTo run these tests:');
console.log('  npx tsx test/board-filter.test.ts');
