/**
 * Seed Default Checklist Items into Templates
 * 
 * Seeds TECH and QC checklist items into existing templates ONLY if they have zero items.
 * Does NOT create new templates, overwrite existing items, or delete anything.
 * 
 * Usage:
 *   npx tsx scripts/seed-checklist-defaults.ts
 * 
 * Or with explicit environment:
 *   APP_ENV=prod npx tsx scripts/seed-checklist-defaults.ts
 */

import * as dotenv from 'dotenv';
import { ChecklistType } from '../lib/types';
import * as checklistTemplateService from '../lib/services/checklist-template-service';

// Load environment variables
dotenv.config();

// ============================================================
// DEFAULT CHECKLIST ITEMS DEFINITIONS
// ============================================================

// Interior Detail – TECH items (16 total)
const INTERIOR_DETAIL_TECH_ITEMS = [
  'Inspect interior & note damage',
  'Remove personal items',
  'Remove floor mats',
  'Deep vacuum (seats, carpets, crevices, trunk)',
  'Compressed air blowout',
  'Carpet stain treatment',
  'Steam clean / shampoo (fabric & leather safe)',
  'Leather clean & condition (if applicable)',
  'Dash, doors & plastic surfaces cleaned',
  'Center console detailed',
  'Door jamb cleaning',
  'Interior windows streak-free',
  'Vent cleaning',
  'Optional fragrance (if selected)',
  'Reinstall mats',
  'Final interior reset (seat position, trash removal)',
];

// Interior Detail – QC items (9 total)
const INTERIOR_DETAIL_QC_ITEMS = [
  'No debris under seats',
  'No visible stains (or documented permanent)',
  'Leather finish even (not greasy)',
  'No dust in vents',
  'Windows streak-free in sunlight',
  'No residue on screens',
  'Door jambs clean',
  'Fresh interior smell',
  'Before/after photos uploaded',
];

// Full Detail – Additional TECH items (these are ADDED to Interior Detail items)
const FULL_DETAIL_ADDITIONAL_TECH_ITEMS = [
  'Pre-rinse exterior',
  'Foam wash',
  'Bug & tar removal',
  'Wheels & barrels cleaned',
  'Engine bay cleaned safely',
  'Clay bar treatment',
  'Iron remover (if needed)',
  'Hand dry',
  'Hand-applied wax finish',
  'Graphene/ceramic coating wash applied',
  'Tires dressed evenly',
];

// Full Detail – QC items (9 total)
const FULL_DETAIL_QC_ITEMS = [
  'No water spots',
  'No wax residue in cracks/emblems',
  'Wheels fully clean (inside barrels checked)',
  'Tires evenly dressed',
  'Engine bay clean but not oversaturated',
  'Paint smooth to touch',
  'No missed bug/tar areas',
  'Interior passes Interior QC standards',
  'Photos uploaded',
];

// Showroom Shine – Additional TECH items (these are ADDED to Full Detail items)
const SHOWROOM_SHINE_ADDITIONAL_TECH_ITEMS = [
  'Paint inspection under proper lighting',
  'One-step polish completed',
  'Panel wipe performed',
  'No buffer trails or holograms',
  'Hand-applied wax & polish',
  'Final gloss inspection under light',
  'Exhaust tips polished',
];

// Showroom Shine – QC items (10 total)
const SHOWROOM_SHINE_QC_ITEMS = [
  'Swirl marks significantly reduced',
  'No holograms in sunlight',
  'Gloss level consistent across panels',
  'No compound residue in cracks',
  'No high spots from protection',
  'Trim even & clean',
  'Wheels spotless',
  'Interior meets Full Detail QC standard',
  'Manager final walk-around complete',
  'Photos uploaded',
];

// Build complete item lists for each service type
const FULL_DETAIL_TECH_ITEMS = [
  ...INTERIOR_DETAIL_TECH_ITEMS,
  ...FULL_DETAIL_ADDITIONAL_TECH_ITEMS,
];

const SHOWROOM_SHINE_TECH_ITEMS = [
  ...FULL_DETAIL_TECH_ITEMS,
  ...SHOWROOM_SHINE_ADDITIONAL_TECH_ITEMS,
];

// ============================================================
// SERVICE TYPE CONFIGURATIONS
// ============================================================

interface ServiceConfig {
  serviceType: string;
  techItems: string[];
  qcItems: string[];
}

const SERVICE_CONFIGS: ServiceConfig[] = [
  // Interior Detail (with vehicle type - matches Square exactly)
  {
    serviceType: 'Interior Detail – Sedan/Coupe',
    techItems: INTERIOR_DETAIL_TECH_ITEMS,
    qcItems: INTERIOR_DETAIL_QC_ITEMS,
  },
  {
    serviceType: 'Interior Detail – SUV/Truck',
    techItems: INTERIOR_DETAIL_TECH_ITEMS,
    qcItems: INTERIOR_DETAIL_QC_ITEMS,
  },
  // Full Detail (base service without vehicle type - matches Square)
  {
    serviceType: 'Full Detail',
    techItems: FULL_DETAIL_TECH_ITEMS,
    qcItems: FULL_DETAIL_QC_ITEMS,
  },
  // Full Detail (with vehicle type variants - for flexibility)
  {
    serviceType: 'Full Detail – Sedan/Coupe',
    techItems: FULL_DETAIL_TECH_ITEMS,
    qcItems: FULL_DETAIL_QC_ITEMS,
  },
  {
    serviceType: 'Full Detail – SUV/Truck',
    techItems: FULL_DETAIL_TECH_ITEMS,
    qcItems: FULL_DETAIL_QC_ITEMS,
  },
  // Showroom Shine (base service without vehicle type - matches Square)
  {
    serviceType: 'Showroom Shine',
    techItems: SHOWROOM_SHINE_TECH_ITEMS,
    qcItems: SHOWROOM_SHINE_QC_ITEMS,
  },
  // Showroom Shine (with vehicle type variants - for flexibility)
  {
    serviceType: 'Showroom Shine – Sedan/Coupe',
    techItems: SHOWROOM_SHINE_TECH_ITEMS,
    qcItems: SHOWROOM_SHINE_QC_ITEMS,
  },
  {
    serviceType: 'Showroom Shine – SUV/Truck',
    techItems: SHOWROOM_SHINE_TECH_ITEMS,
    qcItems: SHOWROOM_SHINE_QC_ITEMS,
  },
];

// ============================================================
// SEEDING LOGIC
// ============================================================

interface SeedResult {
  serviceType: string;
  techSeeded: boolean;
  techItemCount: number;
  qcSeeded: boolean;
  qcItemCount: number;
  techSkipReason?: string;
  qcSkipReason?: string;
}

async function seedServiceTemplate(config: ServiceConfig): Promise<SeedResult> {
  const { serviceType, techItems, qcItems } = config;
  
  console.log(`\n📋 Processing: ${serviceType}`);
  console.log(`   Expected TECH items: ${techItems.length}`);
  console.log(`   Expected QC items: ${qcItems.length}`);
  
  const result: SeedResult = {
    serviceType,
    techSeeded: false,
    techItemCount: 0,
    qcSeeded: false,
    qcItemCount: 0,
  };

  // Process TECH template
  try {
    const techTemplate = await checklistTemplateService.getTemplate(
      serviceType,
      ChecklistType.TECH
    );

    if (!techTemplate) {
      // Template doesn't exist - create it with items
      console.log(`   ⚠️  TECH template not found, will create with items`);
      const seededTemplate = await checklistTemplateService.bulkInsertChecklistItems(
        serviceType,
        ChecklistType.TECH,
        techItems,
        {
          userId: 'system',
          name: 'System Seed Script',
          role: 'MANAGER' as any,
        }
      );
      result.techSeeded = true;
      result.techItemCount = seededTemplate.items.length;
      console.log(`   ✅ TECH: Seeded ${seededTemplate.items.length} items`);
    } else if (techTemplate.items.length === 0) {
      // Template exists but has no items - seed them
      console.log(`   ℹ️  TECH template exists with 0 items`);
      const seededTemplate = await checklistTemplateService.bulkInsertChecklistItems(
        serviceType,
        ChecklistType.TECH,
        techItems,
        {
          userId: 'system',
          name: 'System Seed Script',
          role: 'MANAGER' as any,
        }
      );
      result.techSeeded = true;
      result.techItemCount = seededTemplate.items.length;
      console.log(`   ✅ TECH: Seeded ${seededTemplate.items.length} items`);
    } else {
      // Template has items - skip
      result.techSkipReason = `Already has ${techTemplate.items.length} items`;
      console.log(`   ⏭️  TECH: Skipped (already has ${techTemplate.items.length} items)`);
    }
  } catch (error) {
    console.error(`   ❌ TECH: Error - ${error instanceof Error ? error.message : String(error)}`);
    result.techSkipReason = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  // Process QC template
  try {
    const qcTemplate = await checklistTemplateService.getTemplate(
      serviceType,
      ChecklistType.QC
    );

    if (!qcTemplate) {
      // Template doesn't exist - create it with items
      console.log(`   ⚠️  QC template not found, will create with items`);
      const seededTemplate = await checklistTemplateService.bulkInsertChecklistItems(
        serviceType,
        ChecklistType.QC,
        qcItems,
        {
          userId: 'system',
          name: 'System Seed Script',
          role: 'MANAGER' as any,
        }
      );
      result.qcSeeded = true;
      result.qcItemCount = seededTemplate.items.length;
      console.log(`   ✅ QC: Seeded ${seededTemplate.items.length} items`);
    } else if (qcTemplate.items.length === 0) {
      // Template exists but has no items - seed them
      console.log(`   ℹ️  QC template exists with 0 items`);
      const seededTemplate = await checklistTemplateService.bulkInsertChecklistItems(
        serviceType,
        ChecklistType.QC,
        qcItems,
        {
          userId: 'system',
          name: 'System Seed Script',
          role: 'MANAGER' as any,
        }
      );
      result.qcSeeded = true;
      result.qcItemCount = seededTemplate.items.length;
      console.log(`   ✅ QC: Seeded ${seededTemplate.items.length} items`);
    } else {
      // Template has items - skip
      result.qcSkipReason = `Already has ${qcTemplate.items.length} items`;
      console.log(`   ⏭️  QC: Skipped (already has ${qcTemplate.items.length} items)`);
    }
  } catch (error) {
    console.error(`   ❌ QC: Error - ${error instanceof Error ? error.message : String(error)}`);
    result.qcSkipReason = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('\n🌱 Safari Detail Ops - Seed Default Checklist Items\n');
  console.log('This script seeds TECH and QC checklist items into templates');
  console.log('that currently have ZERO items. It will NOT overwrite existing items.\n');
  
  const env = process.env.APP_ENV || 'qa';
  console.log(`Environment: ${env.toUpperCase()}\n`);
  console.log('═'.repeat(60));

  const results: SeedResult[] = [];

  // Process each service configuration
  for (const config of SERVICE_CONFIGS) {
    const result = await seedServiceTemplate(config);
    results.push(result);
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 SUMMARY REPORT\n');

  const seededServices = results.filter(r => r.techSeeded || r.qcSeeded);
  const skippedServices = results.filter(r => !r.techSeeded && !r.qcSeeded);

  console.log(`✅ Templates Seeded: ${seededServices.length}`);
  seededServices.forEach(r => {
    const details: string[] = [];
    if (r.techSeeded) details.push(`TECH: ${r.techItemCount} items`);
    if (r.qcSeeded) details.push(`QC: ${r.qcItemCount} items`);
    console.log(`   • ${r.serviceType}`);
    console.log(`     ${details.join(', ')}`);
  });

  if (skippedServices.length > 0) {
    console.log(`\n⏭️  Templates Skipped: ${skippedServices.length}`);
    skippedServices.forEach(r => {
      console.log(`   • ${r.serviceType}`);
      if (r.techSkipReason) console.log(`     TECH: ${r.techSkipReason}`);
      if (r.qcSkipReason) console.log(`     QC: ${r.qcSkipReason}`);
    });
  }

  const totalSeeded = results.reduce((sum, r) => {
    return sum + (r.techSeeded ? r.techItemCount : 0) + (r.qcSeeded ? r.qcItemCount : 0);
  }, 0);

  console.log(`\n📈 Total Items Seeded: ${totalSeeded}`);
  console.log('\n✨ Seeding complete!\n');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal Error:', error);
  if (error instanceof Error) {
    console.error(`   ${error.message}`);
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
});
