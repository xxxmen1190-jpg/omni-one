/**
 * Crypto Utility — Omni One Backend
 *
 * Handles password hashing (bcrypt) and sensitive data encryption (AES-256-GCM).
 */

import bcrypt from "bcrypt";
import crypto from "crypto";
import { config } from "../config/index.js";

const ALGORITHM = "aes-256-gcm";


// ─── Password Hashing ─────────────────────────────────────────────────────────

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a password with a hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Data Encryption (AES-256-GCM) ────────────────────────────────────────────

/**
 * Encrypt sensitive data using AES-256-GCM.
 * Output format: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(config.encryption.key),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt data encrypted with AES-256-GCM.
 */
export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encryptedData] = encryptedText.split(":");
  
  if (!ivHex || !authTagHex || !encryptedData) {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(config.encryption.key),
    iv
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
