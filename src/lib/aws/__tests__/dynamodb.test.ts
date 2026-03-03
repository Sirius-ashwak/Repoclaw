/**
 * Unit tests for DynamoDB Session Manager
 */

import { DynamoDBSessionManager, Session, PipelineState, ApprovalGate } from '../dynamodb';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('DynamoDBSessionManager', () => {
  let manager: DynamoDBSessionManager;
  let mockDocClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock DynamoDB Document Client
    mockDocClient = {
      send: jest.fn(),
    };

    // Mock the DynamoDBDocumentClient.from method
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    DynamoDBDocumentClient.from = jest.fn().mockReturnValue(mockDocClient);

    manager = new DynamoDBSessionManager({
      region: 'ap-south-1',
      tableName: 'test-table',
    });
  });

  describe('Session Operations', () => {
    it('should create a session with TTL', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const session: Session = {
        id: 'test-session-1',
        repoUrl: 'https://github.com/test/repo',
        repoMetadata: null,
        githubToken: 'token123',
        selectedMode: 'hackathon',
        pipelineId: null,
        language: 'en',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      await manager.createSession(session);

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      const call = mockDocClient.send.mock.calls[0][0];
      expect(call.input.Item.PK).toBe('SESSION#test-session-1');
      expect(call.input.Item.SK).toBe('METADATA');
      expect(call.input.Item.EntityType).toBe('session');
      expect(call.input.Item.TTL).toBeGreaterThan(0);
      expect(call.input.Item.Version).toBe(1);
    });

    it('should get a session by ID', async () => {
      const mockSession: Session = {
        id: 'test-session-1',
        repoUrl: 'https://github.com/test/repo',
        repoMetadata: null,
        githubToken: 'token123',
        selectedMode: 'hackathon',
        pipelineId: null,
        language: 'en',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'SESSION#test-session-1',
          SK: 'METADATA',
          EntityType: 'session',
          Data: mockSession,
          Version: 1,
        },
      });

      const result = await manager.getSession('test-session-1');

      expect(result).toEqual(mockSession);
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent session', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const result = await manager.getSession('non-existent');

      expect(result).toBeNull();
    });

    it('should update a session with optimistic locking', async () => {
      // Mock get for version check
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'SESSION#test-session-1',
          SK: 'METADATA',
          Version: 1,
        },
      });

      // Mock successful update
      mockDocClient.send.mockResolvedValueOnce({});

      await manager.updateSession('test-session-1', { selectedMode: 'placement' });

      expect(mockDocClient.send).toHaveBeenCalledTimes(2);
      const updateCall = mockDocClient.send.mock.calls[1][0];
      expect(updateCall.input.ConditionExpression).toContain('#version = :expectedVersion');
    });

    it('should retry on version conflict', async () => {
      // Mock get for version check
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'SESSION#test-session-1',
          SK: 'METADATA',
          Version: 1,
        },
      });

      // First update fails with conflict
      const conflictError = new Error('Conflict');
      conflictError.name = 'ConditionalCheckFailedException';
      mockDocClient.send.mockRejectedValueOnce(conflictError);

      // Second get for retry
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'SESSION#test-session-1',
          SK: 'METADATA',
          Version: 2,
        },
      });

      // Second update succeeds
      mockDocClient.send.mockResolvedValueOnce({});

      await manager.updateSession('test-session-1', { selectedMode: 'placement' });

      expect(mockDocClient.send).toHaveBeenCalledTimes(4);
    });

    it('should throw after max retries on version conflict', async () => {
      // Mock get for version check
      mockDocClient.send.mockResolvedValue({
        Item: {
          PK: 'SESSION#test-session-1',
          SK: 'METADATA',
          Version: 1,
        },
      });

      // All updates fail with conflict
      const conflictError = new Error('Conflict');
      conflictError.name = 'ConditionalCheckFailedException';
      mockDocClient.send.mockRejectedValue(conflictError);

      await expect(
        manager.updateSession('test-session-1', { selectedMode: 'placement' })
      ).rejects.toThrow('Failed to update session');
    });

    it('should delete a session', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      await manager.deleteSession('test-session-1');

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      const call = mockDocClient.send.mock.calls[0][0];
      expect(call.input.Key.PK).toBe('SESSION#test-session-1');
    });
  });

  describe('Pipeline Operations', () => {
    it('should create a pipeline with TTL', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const pipeline: PipelineState = {
        id: 'test-pipeline-1',
        sessionId: 'test-session-1',
        status: 'running',
        currentAgent: 'analyze',
        results: [],
        approvalGates: [],
        artifacts: [],
        startedAt: Date.now(),
        completedAt: null,
        error: null,
        metadata: {
          mode: 'hackathon',
          repoUrl: 'https://github.com/test/repo',
          totalExecutionTime: 0,
          bedrockCost: 0,
          s3StorageUsed: 0,
        },
      };

      await manager.createPipeline(pipeline);

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      const call = mockDocClient.send.mock.calls[0][0];
      expect(call.input.Item.PK).toBe('PIPELINE#test-pipeline-1');
      expect(call.input.Item.SK).toBe('STATE');
      expect(call.input.Item.EntityType).toBe('pipeline');
    });

    it('should get a pipeline by ID', async () => {
      const mockPipeline: PipelineState = {
        id: 'test-pipeline-1',
        sessionId: 'test-session-1',
        status: 'running',
        currentAgent: 'analyze',
        results: [],
        approvalGates: [],
        artifacts: [],
        startedAt: Date.now(),
        completedAt: null,
        error: null,
        metadata: {
          mode: 'hackathon',
          repoUrl: 'https://github.com/test/repo',
          totalExecutionTime: 0,
          bedrockCost: 0,
          s3StorageUsed: 0,
        },
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'PIPELINE#test-pipeline-1',
          SK: 'STATE',
          EntityType: 'pipeline',
          Data: mockPipeline,
          Version: 1,
        },
      });

      const result = await manager.getPipeline('test-pipeline-1');

      expect(result).toEqual(mockPipeline);
    });

    it('should update a pipeline with optimistic locking', async () => {
      // Mock get for version check
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'PIPELINE#test-pipeline-1',
          SK: 'STATE',
          Version: 1,
        },
      });

      // Mock successful update
      mockDocClient.send.mockResolvedValueOnce({});

      await manager.updatePipeline('test-pipeline-1', { status: 'completed' });

      expect(mockDocClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Approval Gate Operations', () => {
    it('should create an approval gate with 1-hour TTL', async () => {
      mockDocClient.send.mockResolvedValueOnce({});

      const gate: ApprovalGate = {
        id: 'test-gate-1',
        pipelineId: 'test-pipeline-1',
        fileChanges: [],
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
      };

      await manager.createApprovalGate(gate);

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      const call = mockDocClient.send.mock.calls[0][0];
      expect(call.input.Item.PK).toBe('APPROVAL#test-gate-1');
      expect(call.input.Item.SK).toBe('GATE');
      expect(call.input.Item.EntityType).toBe('approval');
    });

    it('should get an approval gate by ID', async () => {
      const mockGate: ApprovalGate = {
        id: 'test-gate-1',
        pipelineId: 'test-pipeline-1',
        fileChanges: [],
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'APPROVAL#test-gate-1',
          SK: 'GATE',
          EntityType: 'approval',
          Data: mockGate,
          Version: 1,
        },
      });

      const result = await manager.getApprovalGate('test-gate-1');

      expect(result).toEqual(mockGate);
    });

    it('should update an approval gate with optimistic locking', async () => {
      // Mock get for version check
      mockDocClient.send.mockResolvedValueOnce({
        Item: {
          PK: 'APPROVAL#test-gate-1',
          SK: 'GATE',
          Version: 1,
        },
      });

      // Mock successful update
      mockDocClient.send.mockResolvedValueOnce({});

      await manager.updateApprovalGate('test-gate-1', { status: 'approved' });

      expect(mockDocClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Utility Operations', () => {
    it('should cleanup expired sessions', async () => {
      mockDocClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'SESSION#expired-1', SK: 'METADATA' },
          { PK: 'SESSION#expired-2', SK: 'METADATA' },
        ],
      });

      mockDocClient.send.mockResolvedValue({});

      const count = await manager.cleanupExpiredSessions();

      expect(count).toBe(2);
      expect(mockDocClient.send).toHaveBeenCalledTimes(3); // 1 query + 2 deletes
    });
  });
});
