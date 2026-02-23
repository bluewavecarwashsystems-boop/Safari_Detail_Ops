/**
 * Fetch team members from Square API
 * 
 * Usage:
 * SQUARE_ACCESS_TOKEN=xxx SQUARE_ENV=sandbox npx tsx scripts/get-square-team-members.ts
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
    console.log(`\n🔍 Fetching team members from Square ${SQUARE_ENV}...`);
    
    const url = `${baseUrl}/v2/team-members`;
    
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
      console.error('\n❌ Failed to fetch team members');
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

    console.log('\n✅ Team Members fetched successfully\n');
    
    if (!data.team_members || data.team_members.length === 0) {
      console.log('No team members found.');
      return;
    }

    console.log(`Found ${data.team_members.length} team member(s):\n`);
    
    data.team_members.forEach((member: any, index: number) => {
      console.log(`${index + 1}. ${member.given_name || ''} ${member.family_name || ''}`.trim() || 'Unnamed');
      console.log(`   ID: ${member.id}`);
      console.log(`   Status: ${member.status || 'N/A'}`);
      console.log(`   Email: ${member.email_address || 'N/A'}`);
      
      if (member.assigned_locations && member.assigned_locations.location_ids) {
        console.log(`   Location IDs: ${member.assigned_locations.location_ids.join(', ')}`);
        
        if (LOCATION_ID && member.assigned_locations.location_ids.includes(LOCATION_ID)) {
          console.log(`   ✓ Assigned to your location (${LOCATION_ID})`);
        }
      }
      
      console.log('');
    });

    // Suggest a team member ID
    if (LOCATION_ID) {
      const assignedMember = data.team_members.find((m: any) => 
        m.status === 'ACTIVE' && 
        m.assigned_locations?.location_ids?.includes(LOCATION_ID)
      );
      
      if (assignedMember) {
        console.log('\n💡 Recommended team member ID for your location:');
        console.log(`   SQUARE_TEAM_MEMBER_ID=${assignedMember.id}`);
      }
    } else {
      const activeMember = data.team_members.find((m: any) => m.status === 'ACTIVE');
      if (activeMember) {
        console.log('\n💡 Suggested team member ID (active):');
        console.log(`   SQUARE_TEAM_MEMBER_ID=${activeMember.id}`);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Error fetching team members:', error.message);
    process.exit(1);
  }
})();
