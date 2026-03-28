/**
 * Get Today's Date - in Business Timezone
 * 
 * GET /api/today
 * 
 * Returns today's date in the business location timezone (YYYY-MM-DD format)
 */

import { NextResponse } from 'next/server';
import { getTodayInTimezone } from '@/lib/utils/timezone';

export async function GET() {
  const today = getTodayInTimezone();
  
  return NextResponse.json({
    today,
    timestamp: new Date().toISOString(),
  });
}
