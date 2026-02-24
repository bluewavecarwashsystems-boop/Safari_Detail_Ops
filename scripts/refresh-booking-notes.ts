/**
 * Refresh Booking Notes from Square
 * 
 * Fixes existing jobs that have incomplete notes by fetching
 * the complete customer_note from Square Bookings API.
 * 
 * This is needed for jobs created before we added the booking
 * enrichment step in the webhook handler.
 * 
 * Usage:
 *   npx tsx scripts/refresh-booking-notes.ts <bookingId>
 * 
 * Example:
 *   npx tsx scripts/refresh-booking-notes.ts he416a7as2b4ej
 */

import { retrieveBooking } from '../lib/square/bookings-api';
import { getJob, updateJob } from '../lib/aws/dynamodb';

async function refreshBookingNotes(bookingId: string) {
  console.log('\n🔄 Refreshing booking notes from Square\n');
  console.log('Booking ID:', bookingId);
  console.log('─'.repeat(50));
  
  try {
    // Step 1: Get the job from DynamoDB (using bookingId as jobId)
    console.log('\n1️⃣ Fetching job from DynamoDB...');
    const job = await getJob(bookingId);
    
    if (!job) {
      console.error('❌ Job not found in DynamoDB');
      console.error('   Make sure the booking ID is correct');
      process.exit(1);
    }
    
    console.log('✅ Job found');
    console.log('   Job ID:', job.jobId);
    console.log('   Customer:', job.customerName);
    console.log('   Current notes:', job.notes || '(empty)');
    
    // Step 2: Fetch complete booking from Square
    console.log('\n2️⃣ Fetching complete booking from Square...');
    const booking = await retrieveBooking(bookingId);
    
    if (!booking) {
      console.error('❌ Booking not found in Square');
      console.error('   The booking may have been deleted or not synced');
      process.exit(1);
    }
    
    console.log('✅ Booking found in Square');
    console.log('   Status:', booking.status);
    console.log('   Customer Note:', booking.customer_note || '(empty)');
    
    if (!booking.customer_note) {
      console.log('\n⚠️  Booking has no customer note in Square');
      console.log('   Nothing to update');
      process.exit(0);
    }
    
    // Check if notes have add-ons
    const hasAddons = booking.customer_note.includes('ADD-ONS');
    console.log('   Has add-ons:', hasAddons ? '✅ Yes' : '❌ No');
    
    if (hasAddons) {
      const addonsMatch = booking.customer_note.match(/[✅✓]\s*ADD[-\s]ONS\s+REQUESTED:\s*([\s\S]*?)(?:\n\n|⚠️|$)/i);
      if (addonsMatch) {
        const addonLines = addonsMatch[1].split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
        });
        console.log(`   Found ${addonLines.length} add-on(s):`);
        addonLines.forEach(line => {
          console.log(`     ${line.trim()}`);
        });
      }
    }
    
    // Step 3: Update job with complete notes
    console.log('\n3️⃣ Updating job with complete notes...');
    
    const updatedJob = await updateJob(job.jobId, {
      notes: booking.customer_note,
      updatedBy: 'refresh-notes-script',
    });
    
    console.log('✅ Job updated successfully!');
    console.log('\n📝 Updated notes preview:');
    console.log('─'.repeat(50));
    console.log(booking.customer_note.substring(0, 300));
    if (booking.customer_note.length > 300) {
      console.log('... (truncated)');
    }
    console.log('─'.repeat(50));
    
    console.log('\n✨ Done! The job now has complete notes with add-ons.');
    console.log(`🔗 View job: https://ops.thesafaricarwash.com/en/jobs/${job.jobId}`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Get bookingId from command line
const bookingId = process.argv[2];

if (!bookingId) {
  console.error('❌ Error: Booking ID is required');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/refresh-booking-notes.ts <bookingId>');
  console.log('\nExample:');
  console.log('  npx tsx scripts/refresh-booking-notes.ts he416a7as2b4ej');
  process.exit(1);
}

// Run the script
refreshBookingNotes(bookingId);
