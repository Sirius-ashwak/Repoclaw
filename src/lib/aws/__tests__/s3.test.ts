/**
 * Tests for S3 Artifact Manager
 * Includes property-based tests for storage integrity and pre-signed URL expiration
 */

import { S3ArtifactManager, ArtifactType } from '../s3';
import * as fc from 'fast-check';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3ArtifactManager', () => {
  let manager: S3ArtifactManager;
  let mockS3Client: any;
  let mockGetSignedUrl: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock S3 Client
    const { S3Client } = require('@aws-sdk/client-s3');
    mockS3Client = {
      send: jest.fn(),
    };
    S3Client.mockImplementation(() => mockS3Client);

    // Mock getSignedUrl
    const presigner = require('@aws-sdk/s3-request-presigner');
    mockGetSignedUrl = jest.fn().mockResolvedValue('https://example.com/signed-url');
    presigner.getSignedUrl = mockGetSignedUrl;

    manager = new S3ArtifactManager({
      region: 'ap-south-1',
      bucketName: 'test-bucket',
      urlExpiration: 3600,
    });
  });

  describe('Unit Tests', () => {
    describe('uploadArtifact', () => {
      it('should upload a PDF artifact with correct metadata', async () => {
        mockS3Client.send.mockResolvedValueOnce({});

        const content = Buffer.from('test pdf content');
        const key = await manager.uploadArtifact(
          'pipeline-123',
          'pdf',
          'test.pdf',
          content,
          { author: 'test-user' }
        );

        expect(key).toBe('pipeline-123/pdfs/test.pdf');
        expect(mockS3Client.send).toHaveBeenCalledTimes(1);

        const call = mockS3Client.send.mock.calls[0][0];
        expect(call.input.Bucket).toBe('test-bucket');
        expect(call.input.Key).toBe('pipeline-123/pdfs/test.pdf');
        expect(call.input.ContentType).toBe('application/pdf');
        expect(call.input.ServerSideEncryption).toBe('AES256');
        expect(call.input.Metadata.pipelineId).toBe('pipeline-123');
        expect(call.input.Metadata.artifactType).toBe('pdf');
        expect(call.input.Metadata.author).toBe('test-user');
      });

      it('should upload a diagram artifact with PNG content type', async () => {
        mockS3Client.send.mockResolvedValueOnce({});

        const content = Buffer.from('test image content');
        const key = await manager.uploadArtifact(
          'pipeline-456',
          'diagram',
          'architecture.png',
          content
        );

        expect(key).toBe('pipeline-456/diagrams/architecture.png');
        const call = mockS3Client.send.mock.calls[0][0];
        expect(call.input.ContentType).toBe('image/png');
      });

      it('should upload an audio artifact with MP3 content type', async () => {
        mockS3Client.send.mockResolvedValueOnce({});

        const content = Buffer.from('test audio content');
        const key = await manager.uploadArtifact(
          'pipeline-789',
          'audio',
          'pitch.mp3',
          content
        );

        expect(key).toBe('pipeline-789/audios/pitch.mp3');
        const call = mockS3Client.send.mock.calls[0][0];
        expect(call.input.ContentType).toBe('audio/mpeg');
      });

      it('should handle different file extensions correctly', async () => {
        mockS3Client.send.mockResolvedValue({});

        // Test JPEG
        await manager.uploadArtifact('p1', 'diagram', 'test.jpg', Buffer.from(''));
        expect(mockS3Client.send.mock.calls[0][0].input.ContentType).toBe('image/jpeg');

        // Test SVG
        await manager.uploadArtifact('p1', 'diagram', 'test.svg', Buffer.from(''));
        expect(mockS3Client.send.mock.calls[1][0].input.ContentType).toBe('image/svg+xml');

        // Test WAV
        await manager.uploadArtifact('p1', 'audio', 'test.wav', Buffer.from(''));
        expect(mockS3Client.send.mock.calls[2][0].input.ContentType).toBe('audio/wav');
      });
    });

    describe('getPresignedUrl', () => {
      it('should generate a pre-signed URL with default expiration', async () => {
        const url = await manager.getPresignedUrl('pipeline-123/pdfs/test.pdf');

        expect(url).toBe('https://example.com/signed-url');
        expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
        expect(mockGetSignedUrl.mock.calls[0][2].expiresIn).toBe(3600);
      });

      it('should generate a pre-signed URL with custom expiration', async () => {
        const url = await manager.getPresignedUrl('pipeline-123/pdfs/test.pdf', 7200);

        expect(mockGetSignedUrl.mock.calls[0][2].expiresIn).toBe(7200);
      });

      it('should enforce HTTPS-only URLs', async () => {
        mockGetSignedUrl.mockResolvedValueOnce('http://example.com/signed-url');

        await expect(
          manager.getPresignedUrl('pipeline-123/pdfs/test.pdf')
        ).rejects.toThrow('Pre-signed URL must use HTTPS protocol');
      });

      it('should allow localhost URLs for testing', async () => {
        mockGetSignedUrl.mockResolvedValueOnce('http://localhost:4566/signed-url');

        const url = await manager.getPresignedUrl('pipeline-123/pdfs/test.pdf');
        expect(url).toBe('http://localhost:4566/signed-url');
      });
    });

    describe('deleteArtifact', () => {
      it('should delete an artifact by key', async () => {
        mockS3Client.send.mockResolvedValueOnce({});

        await manager.deleteArtifact('pipeline-123/pdfs/test.pdf');

        expect(mockS3Client.send).toHaveBeenCalledTimes(1);
        const call = mockS3Client.send.mock.calls[0][0];
        expect(call.input.Bucket).toBe('test-bucket');
        expect(call.input.Key).toBe('pipeline-123/pdfs/test.pdf');
      });
    });

    describe('listArtifacts', () => {
      it('should list all artifacts for a pipeline', async () => {
        const mockObjects = [
          {
            Key: 'pipeline-123/pdfs/README.pdf',
            Size: 1024,
            LastModified: new Date('2024-01-01'),
          },
          {
            Key: 'pipeline-123/diagrams/architecture.png',
            Size: 2048,
            LastModified: new Date('2024-01-02'),
          },
        ];

        // Mock ListObjectsV2
        mockS3Client.send.mockResolvedValueOnce({
          Contents: mockObjects,
        });

        // Mock HeadObject for metadata
        mockS3Client.send.mockResolvedValueOnce({
          Metadata: {
            pipelineId: 'pipeline-123',
            artifactType: 'pdf',
            fileName: 'README.pdf',
          },
        });

        mockS3Client.send.mockResolvedValueOnce({
          Metadata: {
            pipelineId: 'pipeline-123',
            artifactType: 'diagram',
            fileName: 'architecture.png',
          },
        });

        const artifacts = await manager.listArtifacts('pipeline-123');

        expect(artifacts).toHaveLength(2);
        expect(artifacts[0].key).toBe('pipeline-123/pdfs/README.pdf');
        expect(artifacts[0].size).toBe(1024);
        expect(artifacts[0].url).toBe('https://example.com/signed-url');
        expect(artifacts[1].key).toBe('pipeline-123/diagrams/architecture.png');
      });

      it('should return empty array when no artifacts exist', async () => {
        mockS3Client.send.mockResolvedValueOnce({
          Contents: [],
        });

        const artifacts = await manager.listArtifacts('pipeline-999');

        expect(artifacts).toEqual([]);
      });

      it('should handle missing metadata gracefully', async () => {
        mockS3Client.send.mockResolvedValueOnce({
          Contents: [
            {
              Key: 'pipeline-123/pdfs/test.pdf',
              Size: 1024,
              LastModified: new Date(),
            },
          ],
        });

        // HeadObject fails
        mockS3Client.send.mockRejectedValueOnce(new Error('Metadata not found'));

        const artifacts = await manager.listArtifacts('pipeline-123');

        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].metadata).toBeUndefined();
      });
    });

    describe('cleanupOldArtifacts', () => {
      it('should delete artifacts older than specified days', async () => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
        const recentDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

        mockS3Client.send.mockResolvedValueOnce({
          Contents: [
            { Key: 'old-artifact.pdf', LastModified: oldDate },
            { Key: 'recent-artifact.pdf', LastModified: recentDate },
          ],
        });

        mockS3Client.send.mockResolvedValue({});

        const count = await manager.cleanupOldArtifacts(7);

        expect(count).toBe(1);
        expect(mockS3Client.send).toHaveBeenCalledTimes(2); // 1 list + 1 delete
      });

      it('should return 0 when no old artifacts exist', async () => {
        mockS3Client.send.mockResolvedValueOnce({
          Contents: [],
        });

        const count = await manager.cleanupOldArtifacts(7);

        expect(count).toBe(0);
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 35: S3 Storage Integrity
     * Validates: Requirements 10.3, 10.9
     * 
     * Test that uploaded and downloaded content is byte-for-byte identical
     */
    describe('Property 35: S3 Storage Integrity', () => {
      it('should maintain byte-for-byte integrity for uploaded content', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 50 }), // pipelineId
            fc.constantFrom<ArtifactType>('pdf', 'diagram', 'audio'), // artifactType
            fc.string({ minLength: 1, maxLength: 50 }), // fileName
            fc.uint8Array({ minLength: 1, maxLength: 1000 }), // content
            async (pipelineId, artifactType, fileName, contentArray) => {
              // Arrange
              const content = Buffer.from(contentArray);
              let uploadedContent: Buffer | null = null;

              // Mock upload to capture content
              mockS3Client.send.mockImplementationOnce((command: any) => {
                if (command.input.Body) {
                  uploadedContent = Buffer.from(command.input.Body);
                }
                return Promise.resolve({});
              });

              // Mock download to return captured content
              mockS3Client.send.mockImplementationOnce(() => {
                return Promise.resolve({
                  Body: {
                    transformToByteArray: async () => uploadedContent,
                  },
                });
              });

              // Act
              const key = await manager.uploadArtifact(
                pipelineId,
                artifactType,
                fileName,
                content
              );

              // Simulate download by getting the object
              const { GetObjectCommand } = require('@aws-sdk/client-s3');
              const getCommand = new GetObjectCommand({
                Bucket: 'test-bucket',
                Key: key,
              });
              const response = await mockS3Client.send(getCommand);
              const downloadedContent = await response.Body.transformToByteArray();

              // Assert: Downloaded content must be byte-for-byte identical
              expect(Buffer.from(downloadedContent)).toEqual(content);
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    /**
     * Property 36: S3 Pre-Signed URL Expiration
     * Validates: Requirements 10.4
     * 
     * Test that URLs work before expiration and fail after
     * Note: This is a simplified test since we can't actually wait for expiration
     */
    describe('Property 36: S3 Pre-Signed URL Expiration', () => {
      it('should generate URLs with correct expiration time', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 100 }), // S3 key
            fc.integer({ min: 60, max: 7200 }), // expiration in seconds
            async (key, expiresIn) => {
              // Act
              await manager.getPresignedUrl(key, expiresIn);

              // Assert: getSignedUrl should be called with correct expiration
              expect(mockGetSignedUrl).toHaveBeenCalled();
              const call = mockGetSignedUrl.mock.calls[mockGetSignedUrl.mock.calls.length - 1];
              expect(call[2].expiresIn).toBe(expiresIn);
            }
          ),
          { numRuns: 30 }
        );
      });

      it('should use default 1-hour expiration when not specified', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 100 }), // S3 key
            async (key) => {
              // Act
              await manager.getPresignedUrl(key);

              // Assert: Should use default 3600 seconds (1 hour)
              expect(mockGetSignedUrl).toHaveBeenCalled();
              const call = mockGetSignedUrl.mock.calls[mockGetSignedUrl.mock.calls.length - 1];
              expect(call[2].expiresIn).toBe(3600);
            }
          ),
          { numRuns: 20 }
        );
      });
    });

    /**
     * Additional property test: Artifact organization consistency
     * Test that artifacts are always organized by pipeline ID and type
     */
    describe('Property: Artifact Organization Consistency', () => {
      it('should organize artifacts by pipeline ID and type consistently', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 50 }), // pipelineId
            fc.constantFrom<ArtifactType>('pdf', 'diagram', 'audio'), // artifactType
            fc.string({ minLength: 1, maxLength: 50 }), // fileName
            async (pipelineId, artifactType, fileName) => {
              // Arrange
              mockS3Client.send.mockResolvedValueOnce({});

              // Act
              const key = await manager.uploadArtifact(
                pipelineId,
                artifactType,
                fileName,
                Buffer.from('test')
              );

              // Assert: Key must follow the pattern <pipelineId>/<artifactType>s/<fileName>
              const expectedKey = `${pipelineId}/${artifactType}s/${fileName}`;
              expect(key).toBe(expectedKey);

              // Verify the key structure
              const parts = key.split('/');
              expect(parts).toHaveLength(3);
              expect(parts[0]).toBe(pipelineId);
              expect(parts[1]).toBe(`${artifactType}s`);
              expect(parts[2]).toBe(fileName);
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    /**
     * Additional property test: Metadata preservation
     * Test that metadata is preserved during upload
     */
    describe('Property: Metadata Preservation', () => {
      it('should preserve all metadata during upload', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 50 }), // pipelineId
            fc.constantFrom<ArtifactType>('pdf', 'diagram', 'audio'), // artifactType
            fc.string({ minLength: 1, maxLength: 50 }), // fileName
            fc.dictionary(fc.string(), fc.string()), // custom metadata
            async (pipelineId, artifactType, fileName, customMetadata) => {
              // Arrange
              mockS3Client.send.mockResolvedValueOnce({});

              // Act
              await manager.uploadArtifact(
                pipelineId,
                artifactType,
                fileName,
                Buffer.from('test'),
                customMetadata
              );

              // Assert: All metadata should be included
              const call = mockS3Client.send.mock.calls[mockS3Client.send.mock.calls.length - 1][0];
              const metadata = call.input.Metadata;

              expect(metadata.pipelineId).toBe(pipelineId);
              expect(metadata.artifactType).toBe(artifactType);
              expect(metadata.fileName).toBe(fileName);
              expect(metadata.uploadedAt).toBeDefined();

              // Custom metadata should also be present
              Object.entries(customMetadata).forEach(([key, value]) => {
                expect(metadata[key]).toBe(value);
              });
            }
          ),
          { numRuns: 30 }
        );
      });
    });
  });
});
