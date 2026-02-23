/**
 * Script to fetch Square locations
 * Run with: npx tsx scripts/get-square-locations.ts
 */

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_ENV = process.env.SQUARE_ENV || 'sandbox';

async function getLocations() {
  if (!SQUARE_ACCESS_TOKEN) {
    console.error('❌ SQUARE_ACCESS_TOKEN not set');
    process.exit(1);
  }

  const baseUrl = SQUARE_ENV === 'production' 
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  const url = `${baseUrl}/v2/locations`;

  console.log('🔍 Fetching Square locations...');
  console.log(`Environment: ${SQUARE_ENV}`);
  console.log('');

  try {
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
      console.error('❌ Failed to fetch locations:', response.status, errorText);
      process.exit(1);
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('❌ Square API errors:', JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    if (!data.locations || data.locations.length === 0) {
      console.log('⚠️  No locations found');
      process.exit(0);
    }

    console.log('✅ Found locations:\n');
    
    data.locations.forEach((location: any, index: number) => {
      console.log(`Location ${index + 1}:`);
      console.log(`  ID: ${location.id}`);
      console.log(`  Name: ${location.name || 'N/A'}`);
      console.log(`  Address: ${location.address?.address_line_1 || 'N/A'}, ${location.address?.locality || 'N/A'}`);
      console.log(`  Status: ${location.status || 'N/A'}`);
      console.log(`  Type: ${location.type || 'N/A'}`);
      console.log('');
    });

    console.log('\n📝 To use a location, set this in Vercel:');
    console.log(`   FRANKLIN_SQUARE_LOCATION_ID=${data.locations[0].id}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getLocations();
