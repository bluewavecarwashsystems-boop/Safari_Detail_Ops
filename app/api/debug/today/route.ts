/**
 * Debug: Check today's date endpoint
 * 
 * GET /api/debug/today
 */

import { NextResponse } from 'next/server';
import { getTodayInTimezone } from '@/lib/utils/timezone';

export async function GET() {
  const today = getTodayInTimezone();
  
  return NextResponse.json({
    today,
    timezone: 'America/Chicago',
    timestamp: new Date().toISOString(),
    message: 'This is what /api/today should return'
  });
}
