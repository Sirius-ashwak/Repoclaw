/**
 * S3 Artifact Manager
 * Handles artifact storage with pre-signed URLs and lifecycle management
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAWSConfig } from './config';

export interface S3Config {
  region: string;
  bucketName: string;
  urlExpiration: number; // seconds
  endpoint?: string;
}

export type ArtifactType = 'pdf' | 'diagram' | 'audio';

export interface ArtifactMetadata {
  pipelineId: string;
  artifactType: ArtifactType;
  fileName: string;
  uploadedAt: string;
  [key: string]: string;
}

export interface ArtifactInfo {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
  metadata?: ArtifactMetadata;
}

export class S3ArtifactManager {
  private client: S3Client;
  private bucketName: string;
  private urlExpiration: number;

  constructor(config?: S3Config) {
    const awsConfig = getAWSConfig();
    const s3Config = config || {
      region: awsConfig.region,
      bucketName: awsConfig.s3.bucketName,
      urlExpiration: awsConfig.s3.urlExpiration,
      endpoint: awsConfig.s3.endpoint,
    };

    this.client = new S3Client({
      region: s3Config.region,
      ...(s3Config.endpoint && { 
        endpoint: s3Config.endpoint,
        forcePathStyle: true, // Required for LocalStack
      }),
    });

    this.bucketName = s3Config.bucketName;
    this.urlExpiration = s3Config.urlExpiration;
  }

  /**
   * Upload an artifact to S3 with metadata tagging
   * Organizes artifacts by pipeline ID and type
   * 
   * @param pipelineId - Unique pipeline identifier
   * @param artifactType - Type of artifact (pdf/diagram/audio)
   * @param fileName - Name of the file
   * @param content - File content as Buffer or Uint8Array
   * @param metadata - Optional additional metadata
   * @returns S3 key of the uploaded artifact
   */
  async uploadArtifact(
    pipelineId: string,
    artifactType: ArtifactType,
    fileName: string,
    content: Buffer | Uint8Array,
    metadata?: Record<string, string>
  ): Promise<string> {
    // Construct S3 key following the structure: <pipelineId>/<artifactType>s/<fileName>
    const key = `${pipelineId}/${artifactType}s/${fileName}`;

    // Determine content type based on artifact type
    const contentType = this.getContentType(artifactType, fileName);

    // Prepare metadata
    const s3Metadata: Record<string, string> = {
      pipelineId,
      artifactType,
      fileName,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    };

    // Upload to S3
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
        Metadata: s3Metadata,
        ServerSideEncryption: 'AES256',
      })
    );

    return key;
  }

  /**
   * Generate a pre-signed URL for artifact download
   * URL expires after configured duration (default 1 hour)
   * 
   * @param key - S3 key of the artifact
   * @param expiresIn - Optional custom expiration in seconds
   * @returns Pre-signed URL with HTTPS enforcement
   */
  async getPresignedUrl(key: string, expiresIn?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresIn || this.urlExpiration,
    });

    // Ensure HTTPS-only
    if (!url.startsWith('https://') && !url.includes('localhost')) {
      throw new Error('Pre-signed URL must use HTTPS protocol');
    }

    return url;
  }

  /**
   * Delete an artifact from S3
   * 
   * @param key - S3 key of the artifact to delete
   */
  async deleteArtifact(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );
  }

  /**
   * List all artifacts for a specific pipeline
   * Returns artifact info with pre-signed URLs
   * 
   * @param pipelineId - Pipeline identifier
   * @returns Array of artifact information
   */
  async listArtifacts(pipelineId: string): Promise<ArtifactInfo[]> {
    const prefix = `${pipelineId}/`;

    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      })
    );

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    const artifacts: ArtifactInfo[] = [];

    for (const object of response.Contents) {
      if (!object.Key) continue;

      // Get object metadata
      let metadata: ArtifactMetadata | undefined;
      try {
        const headResponse = await this.client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: object.Key,
          })
        );
        metadata = headResponse.Metadata as ArtifactMetadata;
      } catch (error) {
        // Metadata not available, continue without it
      }

      // Generate pre-signed URL
      const url = await this.getPresignedUrl(object.Key);

      artifacts.push({
        key: object.Key,
        size: object.Size || 0,
        lastModified: object.LastModified || new Date(),
        url,
        metadata,
      });
    }

    return artifacts;
  }

  /**
   * Clean up old artifacts (manual cleanup, lifecycle policy handles automatic)
   * 
   * @param daysOld - Delete artifacts older than this many days
   * @returns Number of artifacts deleted
   */
  async cleanupOldArtifacts(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
      })
    );

    if (!response.Contents || response.Contents.length === 0) {
      return 0;
    }

    let deletedCount = 0;

    for (const object of response.Contents) {
      if (!object.Key || !object.LastModified) continue;

      if (object.LastModified < cutoffDate) {
        await this.deleteArtifact(object.Key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get content type based on artifact type and file name
   * 
   * @param artifactType - Type of artifact
   * @param fileName - File name
   * @returns MIME type
   */
  private getContentType(artifactType: ArtifactType, fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    switch (artifactType) {
      case 'pdf':
        return 'application/pdf';
      case 'diagram':
        if (extension === 'png') return 'image/png';
        if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
        if (extension === 'svg') return 'image/svg+xml';
        return 'image/png'; // default
      case 'audio':
        if (extension === 'mp3') return 'audio/mpeg';
        if (extension === 'wav') return 'audio/wav';
        if (extension === 'ogg') return 'audio/ogg';
        return 'audio/mpeg'; // default
      default:
        return 'application/octet-stream';
    }
  }
}
