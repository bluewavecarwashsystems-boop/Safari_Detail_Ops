/**
 * Check existing bookings to find team member IDs
 * 
 * Usage:
 * SQUARE_ACCESS_TOKEN=xxx SQUARE_ENV=sandbox FRANKLIN_SQUARE_LOCATION_ID=xxx npx tsx scripts/check-booking-team-members.ts
 */

(async () => {
  const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
  const SQUARE_ENV = process.env.SQUARE_ENV || 'sandbox';
  const LOCATION_ID = process.env.FRANKLIN_SQUARE_LOCATION_ID;

  if (!SQUARE_ACCESS_TOKEN) {
    console.error('Error: SQUARE_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  const baseUrl = SQUARE_ENV === 'sandbox' 
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  try {
    console.log(`\n🔍 Fetching recent bookings from Square ${SQUARE_ENV}...`);
    
    // Get bookings from past 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startAtMin = startDate.toISOString();
    
    let url = `${baseUrl}/v2/bookings?limit=100&start_at_min=${encodeURIComponent(startAtMin)}`;
    
    // Note: Not filtering by location_id due to API issues
    // if (LOCATION_ID) {
    //   url += `&location_id=${LOCATION_ID}`;
    //   console.log(`   Location ID: ${LOCATION_ID}`);
    // }
    
    console.log(`   Fetching all bookings...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ Failed to fetch bookings');
      console.error('Status:', response.status);
      console.error('Error:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      console.error('\n❌ Square API errors:');
      data.errors.forEach((error: any) => {
        console.error(`  - ${error.code}: ${error.detail || error.category}`);
      });
      process.exit(1);
    }

    console.log('\n✅ Bookings fetched successfully\n');
    
    if (!data.bookings || data.bookings.length === 0) {
      console.log('No bookings found in the past 30 days.');
      console.log('\n💡 Try creating a booking manually in Square dashboard first,');
      console.log('   then run this script to find the team_member_id used.');
      return;
    }

    console.log(`Found ${data.bookings.length} booking(s):\n`);
    
    const teamMemberIds = new Set<string>();
    
    data.bookings.forEach((booking: any, index: number) => {
      console.log(`${index + 1}. Booking ID: ${booking.id}`);
      console.log(`   Status: ${booking.status || 'N/A'}`);
      console.log(`   Start: ${booking.start_at || 'N/A'}`);
      
      if (booking.appointment_segments && booking.appointment_segments.length > 0) {
        booking.appointment_segments.forEach((segment: any, segIndex: number) => {
          console.log(`   Segment ${segIndex + 1}:`);
          if (segment.team_member_id) {
            console.log(`     Team Member ID: ${segment.team_member_id}`);
            teamMemberIds.add(segment.team_member_id);
          } else {
            console.log(`     Team Member ID: (none/any)`);
          }
          if (segment.service_variation_id) {
            console.log(`     Service Variation ID: ${segment.service_variation_id}`);
          }
        });
      }
      
      console.log('');
    });

    if (teamMemberIds.size > 0) {
      console.log('\n💡 Team Member IDs found in bookings:');
      teamMemberIds.forEach(id => {
        console.log(`   SQUARE_TEAM_MEMBER_ID=${id}`);
      });
      console.log('\n✅ Add one of these to your Vercel environment variables');
    } else {
      console.log('\n⚠️  No team_member_id found in existing bookings.');
      console.log('   This might mean:');
      console.log('   - Bookings were created without specifying a team member');
      console.log('   - Your Square account doesn\'t require team members');
      console.log('   - Try omitting the team_member_id field entirely');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})();
