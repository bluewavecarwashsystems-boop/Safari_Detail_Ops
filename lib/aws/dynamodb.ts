/**
 * DynamoDB Service Layer
 * 
 * Handles all DynamoDB operations for Safari Detail Ops.
 * Uses AWS SDK v3 with DynamoDBDocumentClient for simplified operations.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  QueryCommand,
  ScanCommand,
  DeleteCommand 
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../config';
import type { Job, WorkStatus } from '../types';

let dynamoClient: DynamoDBDocumentClient | null = null;

/**
 * Get or create DynamoDB Document Client
 */
function getDynamoClient(): DynamoDBDocumentClient {
  if (!dynamoClient) {
    const config = getConfig();
    
    const client = new DynamoDBClient({
      region: config.aws.region,
    });
    
    dynamoClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
    });
  }
  
  return dynamoClient;
}

/**
 * Create a new job record
 */
export async function createJob(job: Job): Promise<Job> {
  const client = getDynamoClient();
  const config = getConfig();
  
  const timestamp = new Date().toISOString();
  const jobWithTimestamps = {
    ...job,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  
  await client.send(new PutCommand({
    TableName: config.aws.dynamodb.jobsTable,
    Item: jobWithTimestamps,
    ConditionExpression: 'attribute_not_exists(jobId)',
  }));
  
  return jobWithTimestamps;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const client = getDynamoClient();
  const config = getConfig();
  
  const result = await client.send(new GetCommand({
    TableName: config.aws.dynamodb.jobsTable,
    Key: { jobId },
  }));
  
  return result.Item as Job | null;
}

/**
 * Get job by booking ID
 */
export async function getJobByBookingId(bookingId: string): Promise<Job | null> {
  const client = getDynamoClient();
  const config = getConfig();
  
  const result = await client.send(new ScanCommand({
    TableName: config.aws.dynamodb.jobsTable,
    FilterExpression: 'bookingId = :bookingId',
    ExpressionAttributeValues: {
      ':bookingId': bookingId,
    },
    Limit: 1,
  }));
  
  return result.Items?.[0] as Job | null;
}

/**
 * Update job record
 */
export async function updateJob(
  jobId: string,
  updates: Partial<Job>
): Promise<Job> {
  const client = getDynamoClient();
  const config = getConfig();
  
  // Remove fields that shouldn't be updated (including updatedAt since we add it separately)
  const { jobId: _, createdAt, updatedAt, ...allowedUpdates } = updates as any;
  
  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};
  
  Object.keys(allowedUpdates).forEach((key, index) => {
    const placeholder = `#attr${index}`;
    const valuePlaceholder = `:val${index}`;
    updateExpressions.push(`${placeholder} = ${valuePlaceholder}`);
    expressionAttributeNames[placeholder] = key;
    expressionAttributeValues[valuePlaceholder] = allowedUpdates[key];
  });
  
  // Always update the updatedAt timestamp (use provided value or generate new one)
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = updates.updatedAt || new Date().toISOString();
  
  const result = await client.send(new UpdateCommand({
    TableName: config.aws.dynamodb.jobsTable,
    Key: { jobId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  }));
  
  return result.Attributes as Job;
}

/**
 * List jobs with optional filters
 */
export async function listJobs(options?: {
  status?: WorkStatus;
  customerId?: string;
  limit?: number;
  nextToken?: string;
}): Promise<{ jobs: Job[]; nextToken?: string }> {
  const client = getDynamoClient();
  const config = getConfig();
  
  let filterExpression: string | undefined;
  const expressionAttributeValues: Record<string, any> = {};
  
  if (options?.status) {
    filterExpression = '#status = :status';
    expressionAttributeValues[':status'] = options.status;
  }
  
  if (options?.customerId) {
    const customerFilter = 'customerId = :customerId';
    filterExpression = filterExpression 
      ? `${filterExpression} AND ${customerFilter}`
      : customerFilter;
    expressionAttributeValues[':customerId'] = options.customerId;
  }
  
  const result = await client.send(new ScanCommand({
    TableName: config.aws.dynamodb.jobsTable,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: filterExpression ? { '#status': 'status' } : undefined,
    ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 
      ? expressionAttributeValues 
      : undefined,
    Limit: options?.limit || 50,
    ExclusiveStartKey: options?.nextToken 
      ? JSON.parse(Buffer.from(options.nextToken, 'base64').toString())
      : undefined,
  }));
  
  return {
    jobs: (result.Items as Job[]) || [],
    nextToken: result.LastEvaluatedKey 
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
}

/**
 * Delete job by ID
 */
export async function deleteJob(jobId: string): Promise<void> {
  const client = getDynamoClient();
  const config = getConfig();
  
  await client.send(new DeleteCommand({
    TableName: config.aws.dynamodb.jobsTable,
    Key: { jobId },
  }));
}
