/**
 * Checklist Template Service
 * 
 * Handles CRUD operations for checklist templates in DynamoDB.
 * Templates are stored per service type + checklist type (TECH/QC).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../config';
import {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistType,
  UserAudit,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

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
 * Generate template ID from service type and checklist type
 */
function generateTemplateId(serviceType: string, type: ChecklistType): string {
  return `${serviceType}#${type}`;
}

/**
 * Get template by service type and checklist type
 */
export async function getTemplate(
  serviceType: string,
  type: ChecklistType
): Promise<ChecklistTemplate | null> {
  const client = getDynamoClient();
  const config = getConfig();
  const templateId = generateTemplateId(serviceType, type);

  console.log('[Checklist Template Service] Getting template:', {
    serviceType,
    type,
    templateId,
    tableName: config.aws.dynamodb.checklistTemplatesTable,
  });

  try {
    const result = await client.send(
      new GetCommand({
        TableName: config.aws.dynamodb.checklistTemplatesTable,
        Key: { templateId },
      })
    );

    console.log('[Checklist Template Service] Template result:', {
      templateId,
      found: !!result.Item,
    });

    return result.Item as ChecklistTemplate | null;
  } catch (error) {
    console.error('[Checklist Template Service] Error getting template:', {
      templateId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get all templates for a service type (both TECH and QC)
 */
export async function getTemplatesByService(
  serviceType: string
): Promise<{ TECH?: ChecklistTemplate; QC?: ChecklistTemplate }> {
  const [techTemplate, qcTemplate] = await Promise.all([
    getTemplate(serviceType, ChecklistType.TECH),
    getTemplate(serviceType, ChecklistType.QC),
  ]);

  return {
    ...(techTemplate && { TECH: techTemplate }),
    ...(qcTemplate && { QC: qcTemplate }),
  };
}

/**
 * Create or get template (auto-creates empty template if doesn't exist)
 */
export async function getOrCreateTemplate(
  serviceType: string,
  type: ChecklistType,
  updatedBy?: UserAudit
): Promise<ChecklistTemplate> {
  const existing = await getTemplate(serviceType, type);
  if (existing) {
    return existing;
  }

  // Create empty template
  const timestamp = new Date().toISOString();
  const template: ChecklistTemplate = {
    templateId: generateTemplateId(serviceType, type),
    serviceType,
    type,
    version: 1,
    isActive: true,
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(updatedBy && { updatedBy }),
  };

  const client = getDynamoClient();
  const config = getConfig();

  await client.send(
    new PutCommand({
      TableName: config.aws.dynamodb.checklistTemplatesTable,
      Item: template,
    })
  );

  return template;
}

/**
 * Add item to template
 */
export async function addTemplateItem(
  serviceType: string,
  type: ChecklistType,
  label: string,
  isRequired: boolean = false,
  updatedBy?: UserAudit
): Promise<ChecklistTemplate> {
  const template = await getOrCreateTemplate(serviceType, type, updatedBy);

  // Create new item
  const newItem: ChecklistTemplateItem = {
    id: uuidv4(),
    label,
    sortOrder: template.items.length, // Add at end
    isRequired,
    isActive: true,
  };

  // Update template
  const client = getDynamoClient();
  const config = getConfig();
  const timestamp = new Date().toISOString();

  const updatedTemplate: ChecklistTemplate = {
    ...template,
    items: [...template.items, newItem],
    version: template.version + 1,
    updatedAt: timestamp,
    ...(updatedBy && { updatedBy }),
  };

  await client.send(
    new PutCommand({
      TableName: config.aws.dynamodb.checklistTemplatesTable,
      Item: updatedTemplate,
    })
  );

  return updatedTemplate;
}

/**
 * Update template item
 */
export async function updateTemplateItem(
  serviceType: string,
  type: ChecklistType,
  itemId: string,
  updates: { label?: string; isRequired?: boolean },
  updatedBy?: UserAudit
): Promise<ChecklistTemplate> {
  const template = await getTemplate(serviceType, type);
  if (!template) {
    throw new Error(`Template not found: ${serviceType}#${type}`);
  }

  // Find and update item
  const itemIndex = template.items.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    throw new Error(`Item not found: ${itemId}`);
  }

  const updatedItems = [...template.items];
  updatedItems[itemIndex] = {
    ...updatedItems[itemIndex],
    ...(updates.label !== undefined && { label: updates.label }),
    ...(updates.isRequired !== undefined && { isRequired: updates.isRequired }),
  };

  // Update template
  const client = getDynamoClient();
  const config = getConfig();
  const timestamp = new Date().toISOString();

  const updatedTemplate: ChecklistTemplate = {
    ...template,
    items: updatedItems,
    version: template.version + 1,
    updatedAt: timestamp,
    ...(updatedBy && { updatedBy }),
  };

  await client.send(
    new PutCommand({
      TableName: config.aws.dynamodb.checklistTemplatesTable,
      Item: updatedTemplate,
    })
  );

  return updatedTemplate;
}

/**
 * Soft delete template item (set isActive = false)
 */
export async function deleteTemplateItem(
  serviceType: string,
  type: ChecklistType,
  itemId: string,
  updatedBy?: UserAudit
): Promise<ChecklistTemplate> {
  const template = await getTemplate(serviceType, type);
  if (!template) {
    throw new Error(`Template not found: ${serviceType}#${type}`);
  }

  // Find and soft delete item
  const itemIndex = template.items.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    throw new Error(`Item not found: ${itemId}`);
  }

  const updatedItems = [...template.items];
  updatedItems[itemIndex] = {
    ...updatedItems[itemIndex],
    isActive: false,
  };

  // Update template
  const client = getDynamoClient();
  const config = getConfig();
  const timestamp = new Date().toISOString();

  const updatedTemplate: ChecklistTemplate = {
    ...template,
    items: updatedItems,
    version: template.version + 1,
    updatedAt: timestamp,
    ...(updatedBy && { updatedBy }),
  };

  await client.send(
    new PutCommand({
      TableName: config.aws.dynamodb.checklistTemplatesTable,
      Item: updatedTemplate,
    })
  );

  return updatedTemplate;
}

/**
 * Reorder template items
 */
export async function reorderTemplateItems(
  serviceType: string,
  type: ChecklistType,
  itemIds: string[],
  updatedBy?: UserAudit
): Promise<ChecklistTemplate> {
  const template = await getTemplate(serviceType, type);
  if (!template) {
    throw new Error(`Template not found: ${serviceType}#${type}`);
  }

  // Create a map of items by ID
  const itemsMap = new Map(template.items.map((item) => [item.id, item]));

  // Reorder items according to itemIds array
  const reorderedItems = itemIds
    .map((id) => itemsMap.get(id))
    .filter((item): item is ChecklistTemplateItem => item !== undefined)
    .map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

  // Add any items not in the itemIds array at the end
  const unorderedItems = template.items
    .filter((item) => !itemIds.includes(item.id))
    .map((item, index) => ({
      ...item,
      sortOrder: reorderedItems.length + index,
    }));

  const allItems = [...reorderedItems, ...unorderedItems];

  // Update template
  const client = getDynamoClient();
  const config = getConfig();
  const timestamp = new Date().toISOString();

  const updatedTemplate: ChecklistTemplate = {
    ...template,
    items: allItems,
    version: template.version + 1,
    updatedAt: timestamp,
    ...(updatedBy && { updatedBy }),
  };

  await client.send(
    new PutCommand({
      TableName: config.aws.dynamodb.checklistTemplatesTable,
      Item: updatedTemplate,
    })
  );

  return updatedTemplate;
}

/**
 * Get all active template items (for snapshotting into jobs)
 */
export async function getActiveTemplateItems(
  serviceType: string,
  type: ChecklistType
): Promise<ChecklistTemplateItem[]> {
  const template = await getTemplate(serviceType, type);
  if (!template) {
    return [];
  }

  return template.items
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * List all unique service types from templates
 */
export async function getAllServiceTypes(): Promise<string[]> {
  const client = getDynamoClient();
  const config = getConfig();

  const result = await client.send(
    new ScanCommand({
      TableName: config.aws.dynamodb.checklistTemplatesTable,
      ProjectionExpression: 'serviceType',
    })
  );

  const serviceTypes = new Set<string>();
  result.Items?.forEach((item) => {
    if (item.serviceType) {
      serviceTypes.add(item.serviceType as string);
    }
  });

  return Array.from(serviceTypes).sort();
}

/**
 * Bulk insert checklist items into a template
 * Used for seeding default items. Will NOT overwrite existing items.
 * 
 * @param serviceType - Service type name
 * @param type - Checklist type (TECH or QC)
 * @param itemLabels - Array of item labels to insert
 * @param updatedBy - User performing the operation
 * @returns Updated template with new items
 */
export async function bulkInsertChecklistItems(
  serviceType: string,
  type: ChecklistType,
  itemLabels: string[],
  updatedBy?: UserAudit
): Promise<ChecklistTemplate> {
  const template = await getOrCreateTemplate(serviceType, type, updatedBy);

  // Only seed if template has zero items
  if (template.items.length > 0) {
    console.log(`[Checklist Template Service] Template ${serviceType}#${type} already has ${template.items.length} items, skipping bulk insert`);
    return template;
  }

  // Create new items
  const newItems: ChecklistTemplateItem[] = itemLabels.map((label, index) => ({
    id: uuidv4(),
    label,
    sortOrder: index,
    isRequired: true,
    isActive: true,
  }));

  // Update template
  const client = getDynamoClient();
  const config = getConfig();
  const timestamp = new Date().toISOString();

  const updatedTemplate: ChecklistTemplate = {
    ...template,
    items: newItems,
    version: template.version + 1,
    updatedAt: timestamp,
    ...(updatedBy && { updatedBy }),
  };

  await client.send(
    new PutCommand({
      TableName: config.aws.dynamodb.checklistTemplatesTable,
      Item: updatedTemplate,
    })
  );

  console.log(`[Checklist Template Service] Bulk inserted ${newItems.length} items into ${serviceType}#${type}`);

  return updatedTemplate;
}
