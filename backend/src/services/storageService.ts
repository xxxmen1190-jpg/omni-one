/**
 * Storage Service — Omni One Backend
 *
 * Provides a unified interface for file storage (Local or S3).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export interface StorageProvider {
  upload(key: string, body: Buffer | string, mimeType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

// ─── Local Storage Provider ───────────────────────────────────────────────────

class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = path.resolve(process.cwd(), config.storage.path);
    void this.ensureDir();
  }

  private async ensureDir() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (err) {
      logger.error({ err }, "Failed to create local storage directory");
    }
  }

  async upload(key: string, body: Buffer | string): Promise<string> {
    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.basePath, key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(path.join(this.basePath, key));
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local storage doesn't support signed URLs natively in this abstraction.
    // In production, this would point to a local serve endpoint.
    return `/api/storage/local/${key}`;
  }
}

// ─── S3 Storage Provider ──────────────────────────────────────────────────────

class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const { s3 } = config.storage;
    if (!s3?.region || !s3?.bucket) {
      throw new Error("S3 configuration missing (region or bucket)");
    }
    this.bucket = s3.bucket;
    this.client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint,
      credentials:
        s3.accessKeyId && s3.secretAccessKey
          ? {
              accessKeyId: s3.accessKeyId,
              secretAccessKey: s3.secretAccessKey,
            }
          : undefined,
    });
  }

  async upload(key: string, body: Buffer | string, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      })
    );
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
    const byteArray = await response.Body?.transformToByteArray();
    return Buffer.from(byteArray ?? []);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export const storageService: StorageProvider =
  config.storage.provider === "s3"
    ? new S3StorageProvider()
    : new LocalStorageProvider();
