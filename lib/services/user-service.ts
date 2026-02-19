/**
 * User Management Service
 * Handles DynamoDB operations for user accounts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../config';
import type { UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * User record in DynamoDB
 */
export interface User {
  pk: string; // "USER#<userId>"
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * User data without sensitive fields (for API responses)
 */
export interface SafeUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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
 * Get users table name from environment
 */
function getUsersTableName(): string {
  const tableName = process.env.DYNAMODB_USERS_TABLE;
  if (!tableName) {
    throw new Error('DYNAMODB_USERS_TABLE environment variable is not set');
  }
  return tableName;
}

/**
 * Create a new user
 */
export async function createUser(userData: {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}): Promise<User> {
  const client = getDynamoClient();
  const tableName = getUsersTableName();
  const userId = uuidv4();
  const now = new Date().toISOString();

  const user: User = {
    pk: `USER#${userId}`,
    userId,
    email: userData.email.toLowerCase().trim(),
    name: userData.name.trim(),
    role: userData.role,
    passwordHash: userData.passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: user,
      ConditionExpression: 'attribute_not_exists(pk)',
    })
  );

  return user;
}

/**
 * Get user by userId
 */
export async function getUserById(userId: string): Promise<User | null> {
  const client = getDynamoClient();
  const tableName = getUsersTableName();

  const result = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `USER#${userId}`,
      },
    })
  );

  return (result.Item as User) || null;
}

/**
 * Get user by email (uses GSI)
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const client = getDynamoClient();
  const tableName = getUsersTableName();
  const normalizedEmail = email.toLowerCase().trim();

  // Query using GSI on email
  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': normalizedEmail,
      },
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0] as User;
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  const client = getDynamoClient();
  const tableName = getUsersTableName();

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `USER#${userId}`,
      },
      UpdateExpression: 'SET lastLoginAt = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
      },
    })
  );
}

/**
 * Update user's active status
 */
export async function updateUserStatus(
  userId: string,
  isActive: boolean
): Promise<void> {
  const client = getDynamoClient();
  const tableName = getUsersTableName();

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `USER#${userId}`,
      },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :now',
      ExpressionAttributeValues: {
        ':isActive': isActive,
        ':now': new Date().toISOString(),
      },
    })
  );
}

/**
 * Remove sensitive fields from user object
 */
export function toSafeUser(user: User): SafeUser {
  const { passwordHash, pk, ...safeUser } = user;
  return safeUser;
}
