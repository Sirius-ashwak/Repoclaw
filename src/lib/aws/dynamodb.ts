/**
 * DynamoDB Session Manager
 * Handles session, pipeline, and approval gate storage with TTL and optimistic locking
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { getAWSConfig } from './config';

export interface DynamoDBConfig {
  region: string;
  tableName: string;
  endpoint?: string;
}

export type EntityType = 'session' | 'pipeline' | 'approval';

export interface DynamoDBEntity<T = any> {
  PK: string;
  SK: string;
  EntityType: EntityType;
  TTL: number;
  Data: T;
  CreatedAt: number;
  UpdatedAt: number;
  Version: number;
}

export interface Session {
  id: string;
  repoUrl: string;
  repoMetadata: any | null;
  githubToken: string;
  selectedMode: string | null;
  pipelineId: string | null;
  language: string;
  createdAt: number;
  expiresAt: number;
}

export interface PipelineState {
  id: string;
  sessionId: string;
  status: string;
  currentAgent: string | null;
  results: any[];
  approvalGates: any[];
  artifacts: any[];
  startedAt: number;
  completedAt: number | null;
  error: string | null;
  metadata: {
    mode: string;
    repoUrl: string;
    totalExecutionTime: number;
    bedrockCost: number;
    s3StorageUsed: number;
  };
}

export interface ApprovalGate {
  id: string;
  pipelineId: string;
  fileChanges: any[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  expiresAt: number;
}

export class DynamoDBSessionManager {
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(config?: DynamoDBConfig) {
    const awsConfig = getAWSConfig();
    const dbConfig = config || {
      region: awsConfig.region,
      tableName: awsConfig.dynamodb.tableName,
      endpoint: awsConfig.dynamodb.endpoint,
    };

    this.client = new DynamoDBClient({
      region: dbConfig.region,
      ...(dbConfig.endpoint && { endpoint: dbConfig.endpoint }),
    });

    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });

    this.tableName = dbConfig.tableName;
  }

  // Session operations
  async createSession(session: Session): Promise<void> {
    const now = Date.now();
    const ttl = Math.floor((now + 24 * 60 * 60 * 1000) / 1000); // 24 hours from now

    const entity: DynamoDBEntity<Session> = {
      PK: `SESSION#${session.id}`,
      SK: 'METADATA',
      EntityType: 'session',
      TTL: ttl,
      Data: session,
      CreatedAt: now,
      UpdatedAt: now,
      Version: 1,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
      })
    );
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: 'METADATA',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return (result.Item as DynamoDBEntity<Session>).Data;
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Session>,
    expectedVersion?: number,
    maxRetries: number = 3
  ): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const now = Date.now();

        // Get current version if not provided
        let currentVersion = expectedVersion;
        if (currentVersion === undefined) {
          const current = await this.docClient.send(
            new GetCommand({
              TableName: this.tableName,
              Key: {
                PK: `SESSION#${sessionId}`,
                SK: 'METADATA',
              },
            })
          );

          if (!current.Item) {
            throw new Error(`Session ${sessionId} not found`);
          }

          currentVersion = (current.Item as DynamoDBEntity).Version;
        }

        // Build update expression
        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        Object.entries(updates).forEach(([key, value], index) => {
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          updateExpressions.push(`Data.${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        });

        updateExpressions.push('UpdatedAt = :updatedAt');
        updateExpressions.push('#version = #version + :inc');
        expressionAttributeValues[':updatedAt'] = now;
        expressionAttributeValues[':inc'] = 1;
        expressionAttributeValues[':expectedVersion'] = currentVersion;
        expressionAttributeNames['#version'] = 'Version';

        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PK: `SESSION#${sessionId}`,
              SK: 'METADATA',
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ConditionExpression: '#version = :expectedVersion',
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        );

        // Success - exit retry loop
        return;
      } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
          retries++;
          if (retries >= maxRetries) {
            throw new Error(
              `Failed to update session ${sessionId} after ${maxRetries} retries due to version conflict`
            );
          }
          // Wait before retrying with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, retries)));
        } else {
          throw error;
        }
      }
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: 'METADATA',
        },
      })
    );
  }

  // Pipeline operations
  async createPipeline(pipeline: PipelineState): Promise<void> {
    const now = Date.now();
    const ttl = Math.floor((now + 24 * 60 * 60 * 1000) / 1000); // 24 hours from now

    const entity: DynamoDBEntity<PipelineState> = {
      PK: `PIPELINE#${pipeline.id}`,
      SK: 'STATE',
      EntityType: 'pipeline',
      TTL: ttl,
      Data: pipeline,
      CreatedAt: now,
      UpdatedAt: now,
      Version: 1,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
      })
    );
  }

  async getPipeline(pipelineId: string): Promise<PipelineState | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `PIPELINE#${pipelineId}`,
          SK: 'STATE',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return (result.Item as DynamoDBEntity<PipelineState>).Data;
  }

  async updatePipeline(
    pipelineId: string,
    updates: Partial<PipelineState>,
    expectedVersion?: number,
    maxRetries: number = 3
  ): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const now = Date.now();

        // Get current version if not provided
        let currentVersion = expectedVersion;
        if (currentVersion === undefined) {
          const current = await this.docClient.send(
            new GetCommand({
              TableName: this.tableName,
              Key: {
                PK: `PIPELINE#${pipelineId}`,
                SK: 'STATE',
              },
            })
          );

          if (!current.Item) {
            throw new Error(`Pipeline ${pipelineId} not found`);
          }

          currentVersion = (current.Item as DynamoDBEntity).Version;
        }

        // Build update expression
        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        Object.entries(updates).forEach(([key, value], index) => {
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          updateExpressions.push(`Data.${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        });

        updateExpressions.push('UpdatedAt = :updatedAt');
        updateExpressions.push('#version = #version + :inc');
        expressionAttributeValues[':updatedAt'] = now;
        expressionAttributeValues[':inc'] = 1;
        expressionAttributeValues[':expectedVersion'] = currentVersion;
        expressionAttributeNames['#version'] = 'Version';

        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PK: `PIPELINE#${pipelineId}`,
              SK: 'STATE',
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ConditionExpression: '#version = :expectedVersion',
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        );

        // Success - exit retry loop
        return;
      } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
          retries++;
          if (retries >= maxRetries) {
            throw new Error(
              `Failed to update pipeline ${pipelineId} after ${maxRetries} retries due to version conflict`
            );
          }
          // Wait before retrying with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, retries)));
        } else {
          throw error;
        }
      }
    }
  }

  async deletePipeline(pipelineId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `PIPELINE#${pipelineId}`,
          SK: 'STATE',
        },
      })
    );
  }

  // Approval gate operations
  async createApprovalGate(gate: ApprovalGate): Promise<void> {
    const now = Date.now();
    const ttl = Math.floor((now + 60 * 60 * 1000) / 1000); // 1 hour from now

    const entity: DynamoDBEntity<ApprovalGate> = {
      PK: `APPROVAL#${gate.id}`,
      SK: 'GATE',
      EntityType: 'approval',
      TTL: ttl,
      Data: gate,
      CreatedAt: now,
      UpdatedAt: now,
      Version: 1,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
      })
    );
  }

  async getApprovalGate(gateId: string): Promise<ApprovalGate | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `APPROVAL#${gateId}`,
          SK: 'GATE',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return (result.Item as DynamoDBEntity<ApprovalGate>).Data;
  }

  async updateApprovalGate(
    gateId: string,
    updates: Partial<ApprovalGate>,
    expectedVersion?: number,
    maxRetries: number = 3
  ): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const now = Date.now();

        // Get current version if not provided
        let currentVersion = expectedVersion;
        if (currentVersion === undefined) {
          const current = await this.docClient.send(
            new GetCommand({
              TableName: this.tableName,
              Key: {
                PK: `APPROVAL#${gateId}`,
                SK: 'GATE',
              },
            })
          );

          if (!current.Item) {
            throw new Error(`Approval gate ${gateId} not found`);
          }

          currentVersion = (current.Item as DynamoDBEntity).Version;
        }

        // Build update expression
        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        Object.entries(updates).forEach(([key, value], index) => {
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          updateExpressions.push(`Data.${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        });

        updateExpressions.push('UpdatedAt = :updatedAt');
        updateExpressions.push('#version = #version + :inc');
        expressionAttributeValues[':updatedAt'] = now;
        expressionAttributeValues[':inc'] = 1;
        expressionAttributeValues[':expectedVersion'] = currentVersion;
        expressionAttributeNames['#version'] = 'Version';

        await this.docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PK: `APPROVAL#${gateId}`,
              SK: 'GATE',
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ConditionExpression: '#version = :expectedVersion',
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        );

        // Success - exit retry loop
        return;
      } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
          retries++;
          if (retries >= maxRetries) {
            throw new Error(
              `Failed to update approval gate ${gateId} after ${maxRetries} retries due to version conflict`
            );
          }
          // Wait before retrying with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, retries)));
        } else {
          throw error;
        }
      }
    }
  }

  async deleteApprovalGate(gateId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `APPROVAL#${gateId}`,
          SK: 'GATE',
        },
      })
    );
  }

  // Utility operations
  async cleanupExpiredSessions(): Promise<number> {
    // Note: DynamoDB TTL handles automatic deletion
    // This method is for manual cleanup if needed
    const now = Math.floor(Date.now() / 1000);
    let deletedCount = 0;

    // Query for expired sessions
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'EntityType-CreatedAt-index',
        KeyConditionExpression: 'EntityType = :entityType',
        FilterExpression: 'TTL < :now',
        ExpressionAttributeValues: {
          ':entityType': 'session',
          ':now': now,
        },
      })
    );

    if (result.Items) {
      for (const item of result.Items) {
        await this.docClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          })
        );
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
