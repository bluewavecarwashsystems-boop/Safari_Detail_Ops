/**
 * Debug: Check booking job
 * 
 * GET /api/debug/booking-job?bookingId=vluzlyf54iksch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/aws/dynamodb';
import { isTimestampOnBoardDate } from '@/lib/utils/timezone';

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('bookingId');
  
  if (!bookingId) {
    return NextResponse.json({
      error: 'bookingId required',
      usage: '/api/debug/booking-job?bookingId=vluzlyf54iksch'
    }, { status: 400 });
  }

  try {
    const job = await getJob(bookingId);
    
    if (!job) {
      return NextResponse.json({
        found: false,
        jobId: bookingId,
        message: 'Job not found in DynamoDB'
      }, { status: 404 });
    }

    // Check filtering for today
    const boardDate = '2026-03-28';
    const isOnBoardDate = isTimestampOnBoardDate(job.appointmentTime || job.createdAt, boardDate);

    return NextResponse.json({
      found: true,
      job: {
        jobId: job.jobId,
        bookingId: job.bookingId,
        status: job.status,
        workStatus: job.workStatus,
        appointmentTime: job.appointmentTime,
        createdAt: job.createdAt,
        customerName: job.customerName,
        serviceType: job.serviceType,
      },
      filtering: {
        boardDate,
        appointmentTime: job.appointmentTime,
        isOnBoardDate,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
