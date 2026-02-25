/**
 * List all services from Square Catalog
 * 
 * Usage:
 *   APP_ENV=prod SQUARE_ENV=production npx tsx scripts/list-square-services.ts
 */

import * as dotenv from 'dotenv';
import * as catalogApi from '../lib/square/catalog-api';

dotenv.config();

async function main() {
  console.log('\n📋 Square Catalog Services\n');
  console.log(`Environment: ${process.env.APP_ENV || 'qa'}\n`);
  console.log('═'.repeat(60));

  try {
    const services = await catalogApi.listPhoneBookingServices();
    
    console.log(`\n✅ Found ${services.length} services:\n`);
    
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name}`);
      console.log(`   ID: ${service.id}`);
      console.log(`   Item ID: ${service.itemId}`);
      if (service.durationMinutes) {
        console.log(`   Duration: ${service.durationMinutes} minutes`);
      }
      if (service.priceMoney) {
        console.log(`   Price: $${service.priceMoney.amount / 100}`);
      }
      console.log('');
    });

    // Extract unique base service names
    const baseNames = new Set<string>();
    services.forEach(service => {
      const baseName = service.name.split(' - ')[0].trim();
      baseNames.add(baseName);
    });

    console.log('═'.repeat(60));
    console.log(`\n📊 Unique Base Service Names (${baseNames.size}):\n`);
    Array.from(baseNames).sort().forEach(name => {
      console.log(`   • ${name}`);
    });
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);
    }
    process.exit(1);
  }
}

main();
