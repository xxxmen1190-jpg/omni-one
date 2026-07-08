import { Logger } from "./Logger";
import { AuditLog } from "./AuditLog";

export interface APIKeyEntry {
  id: string;
  provider: string;
  keyPrefix: string; // Only store first 4 chars for security
  createdAt: number;
  lastUsed?: number;
  expiresAt?: number;
  isActive: boolean;
  rotationCount: number;
}

export class APIKeyManager {
  private static keys = new Map<string, { encrypted: string; salt: string }>();
  private static keyMetadata = new Map<string, APIKeyEntry>();

  static addKey(provider: string, apiKey: string, expiresAt?: number): string {
    const id = `key-${provider}-${Date.now()}`;
    const keyPrefix = apiKey.substring(0, 4);

    // In production, use proper encryption (e.g., crypto-js, libsodium)
    // For now, we'll use a simple base64 encoding (NOT SECURE - for demo only)
    const encrypted = Buffer.from(apiKey).toString("base64");
    const salt = Math.random().toString(36).substring(2, 15);

    this.keys.set(id, { encrypted, salt });
    this.keyMetadata.set(id, {
      id,
      provider,
      keyPrefix,
      createdAt: Date.now(),
      expiresAt,
      isActive: true,
      rotationCount: 0,
    });

    Logger.info(`API Key added for provider ${provider}`, { id, keyPrefix });
    AuditLog.record("api_key_added", "user", provider, "success", { id, keyPrefix });

    return id;
  }

  static getKey(keyId: string): string | undefined {
    if (!this.keyMetadata.get(keyId)?.isActive) {
      Logger.warn(`Attempted access to inactive key ${keyId}`);
      AuditLog.record("api_key_access_denied", "system", keyId, "denied", { reason: "inactive" });
      return undefined;
    }

    const entry = this.keyMetadata.get(keyId);
    if (entry?.expiresAt && Date.now() > entry.expiresAt) {
      Logger.warn(`API Key ${keyId} has expired`);
      AuditLog.record("api_key_access_denied", "system", keyId, "denied", { reason: "expired" });
      return undefined;
    }

    const keyData = this.keys.get(keyId);
    if (!keyData) return undefined;

    // Update last used
    if (entry) {
      entry.lastUsed = Date.now();
    }

    // Decrypt key
    try {
      const decrypted = Buffer.from(keyData.encrypted, "base64").toString("utf-8");
      return decrypted;
    } catch (error: any) {
      Logger.error(`Failed to decrypt key ${keyId}`, { error: error.message });
      return undefined;
    }
  }

  static rotateKey(keyId: string, newApiKey: string): string {
    const oldEntry = this.keyMetadata.get(keyId);
    if (!oldEntry) {
      Logger.error(`Key ${keyId} not found for rotation`);
      return "";
    }

    // Deactivate old key
    oldEntry.isActive = false;

    // Create new key
    const newId = this.addKey(oldEntry.provider, newApiKey, oldEntry.expiresAt);
    const newEntry = this.keyMetadata.get(newId);
    if (newEntry) {
      newEntry.rotationCount = oldEntry.rotationCount + 1;
    }

    Logger.info(`API Key rotated for provider ${oldEntry.provider}`, { oldId: keyId, newId });
    AuditLog.record("api_key_rotated", "user", oldEntry.provider, "success", { oldId: keyId, newId });

    return newId;
  }

  static revokeKey(keyId: string): void {
    const entry = this.keyMetadata.get(keyId);
    if (entry) {
      entry.isActive = false;
      Logger.info(`API Key ${keyId} revoked`);
      AuditLog.record("api_key_revoked", "user", entry.provider, "success", { keyId });
    }
  }

  static getKeyMetadata(keyId: string): APIKeyEntry | undefined {
    return this.keyMetadata.get(keyId);
  }

  static getAllKeyMetadata(): APIKeyEntry[] {
    return Array.from(this.keyMetadata.values());
  }

  static getKeysByProvider(provider: string): APIKeyEntry[] {
    return Array.from(this.keyMetadata.values()).filter(entry => entry.provider === provider);
  }
}
