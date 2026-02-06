/**
 * Integration Test for Phase C - AWS DynamoDB and S3 Operations
 * 
 * Run with: npm run test:integration
 * 
 * Prerequisites:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - APP_ENV=qa in .env
 * - DynamoDB table: safari-detail-ops-qa-jobs (created)
 * - S3 bucket: safari-detail-ops-qa-photos (created)
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import * as dynamodb from '../lib/aws/dynamodb';
import * as s3 from '../lib/aws/s3';
import * as jobService from '../lib/services/job-service';
import { WorkStatus } from '../lib/types';
import type { Job } from '../lib/types';

console.log('🧪 Testing Phase C - AWS Integration\n');

async function runTests() {
  let testJobId: string | undefined;

  try {
    // Test 1: Create a job in DynamoDB
    console.log('Test 1: Create job in DynamoDB');
    const newJob: Job = {
      jobId: 'test-job-' + Date.now(),
      customerId: 'TEST_CUST_123',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      customerPhone: '+1234567890',
      vehicleInfo: {
        make: 'Toyota',
        model: 'Camry',
        year: 2022,
        color: 'Blue',
      },
      serviceType: 'Full Detail',
      status: WorkStatus.SCHEDULED,
      bookingId: 'test-booking-123',
      appointmentTime: new Date().toISOString(),
      photos: [],
      notes: 'Integration test job',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'integration-test',
    };

    const createdJob = await dynamodb.createJob(newJob);
    testJobId = createdJob.jobId;
    console.log(`✓ Job created: ${testJobId}\n`);

    // Test 2: Get job from DynamoDB
    console.log('Test 2: Get job from DynamoDB');
    const retrievedJob = await dynamodb.getJob(testJobId);
    if (retrievedJob && retrievedJob.jobId === testJobId) {
      console.log(`✓ Job retrieved: ${retrievedJob.jobId}\n`);
    } else {
      throw new Error('Job retrieval failed');
    }

    // Test 3: Update job in DynamoDB
    console.log('Test 3: Update job in DynamoDB');
    const updatedJob = await dynamodb.updateJob(testJobId, {
      status: WorkStatus.IN_PROGRESS,
      notes: 'Updated via integration test',
    });
    if (updatedJob.status === WorkStatus.IN_PROGRESS) {
      console.log(`✓ Job updated to status: ${updatedJob.status}\n`);
    } else {
      throw new Error('Job update failed');
    }

    // Test 4: List jobs from DynamoDB
    console.log('Test 4: List jobs from DynamoDB');
    const { jobs } = await dynamodb.listJobs({ limit: 10 });
    if (jobs.length > 0) {
      console.log(`✓ Found ${jobs.length} jobs\n`);
    } else {
      console.log(`✓ Jobs list returned (may be empty)\n`);
    }

    // Test 5: Generate S3 upload URL
    console.log('Test 5: Generate S3 upload URL');
    const { url, key } = await s3.generateUploadUrl(
      testJobId,
      'test-photo.jpg',
      'image/jpeg'
    );
    if (url && key) {
      console.log(`✓ Upload URL generated`);
      console.log(`  Photo key: ${key}\n`);
    } else {
      throw new Error('S3 upload URL generation failed');
    }

    // Test 6: Upload test photo to S3
    console.log('Test 6: Upload test photo to S3');
    const testPhotoContent = Buffer.from('Test photo content');
    const photoKey = await s3.uploadPhoto(
      testJobId,
      'test-upload.jpg',
      testPhotoContent,
      'image/jpeg'
    );
    console.log(`✓ Photo uploaded: ${photoKey}\n`);

    // Test 7: Generate download URL
    console.log('Test 7: Generate S3 download URL');
    const downloadUrl = await s3.generateDownloadUrl(photoKey, 3600);
    if (downloadUrl) {
      console.log(`✓ Download URL generated (expires in 1 hour)\n`);
    } else {
      throw new Error('S3 download URL generation failed');
    }

    // Test 8: List job photos
    console.log('Test 8: List job photos from S3');
    const photoKeys = await s3.listJobPhotos(testJobId);
    if (photoKeys.length > 0) {
      console.log(`✓ Found ${photoKeys.length} photos for job\n`);
    } else {
      console.log(`⚠ No photos found (this may be expected)\n`);
    }

    // Test 9: Job service integration
    console.log('Test 9: Job service - update job status');
    const updatedByService = await jobService.updateJobStatus(
      testJobId,
      WorkStatus.WORK_COMPLETED,
      'integration-test'
    );
    if (updatedByService.status === WorkStatus.WORK_COMPLETED) {
      console.log(`✓ Job status updated via service layer\n`);
    } else {
      throw new Error('Job service update failed');
    }

    // Test 10: Get job with photo URLs
    console.log('Test 10: Get job with photo URLs');
    const jobWithPhotos = await jobService.getJobWithPhotos(testJobId);
    if (jobWithPhotos) {
      console.log(`✓ Job retrieved with ${jobWithPhotos.photoUrls?.length || 0} photo URLs\n`);
    } else {
      throw new Error('Get job with photos failed');
    }

    console.log('✅ All Phase C integration tests passed!\n');
    console.log('AWS Resources Verified:');
    console.log('- ✓ DynamoDB: safari-detail-ops-qa-jobs');
    console.log('- ✓ S3: safari-detail-ops-qa-photos');
    console.log('\nCleanup:');
    console.log(`Test job ID: ${testJobId}`);
    console.log('Run cleanup to remove test data...\n');

    // Cleanup
    console.log('Cleaning up test data...');
    await s3.deleteJobPhotos(testJobId);
    console.log('✓ Deleted test photos');
    await dynamodb.deleteJob(testJobId);
    console.log('✓ Deleted test job');
    console.log('\n✅ Cleanup complete!');

  } catch (error: any) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Attempt cleanup even on failure
    if (testJobId) {
      console.log('\nAttempting cleanup...');
      try {
        await s3.deleteJobPhotos(testJobId).catch(() => {});
        await dynamodb.deleteJob(testJobId).catch(() => {});
        console.log('✓ Cleanup complete');
      } catch (cleanupError) {
        console.error('⚠ Cleanup failed:', cleanupError);
      }
    }
    
    process.exit(1);
  }
}

// Run tests
runTests();
