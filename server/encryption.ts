/**
 * AudioNoise Web - Encryption Utilities
 * AES-256-GCM encryption for sensitive data (API keys, etc.)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the master encryption key from environment
 * In production, this should be a 32-byte hex string from a secure secret manager
 */
function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    // In development, generate a deterministic key (NOT FOR PRODUCTION)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Encryption] Using development key - NOT FOR PRODUCTION');
      return crypto.scryptSync('dev-key-do-not-use-in-prod', 'salt', 32);
    }
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
  }

  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string value using AES-256-GCM
 * @returns Object with encrypted data, IV, and auth tag (all base64 encoded)
 */
export function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt an encrypted value
 * @param encrypted Base64 encoded encrypted data
 * @param iv Base64 encoded initialization vector
 * @param authTag Base64 encoded authentication tag
 * @returns Decrypted plaintext string
 */
export function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = getMasterKey();
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt and combine into a single string for storage
 * Format: base64(iv):base64(authTag):base64(encrypted)
 */
export function encryptToString(plaintext: string): string {
  const { encrypted, iv, authTag } = encrypt(plaintext);
  return `${iv}:${authTag}:${encrypted}`;
}

/**
 * Decrypt from combined string format
 */
export function decryptFromString(combined: string): string {
  const parts = combined.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format');
  }
  const [iv, authTag, encrypted] = parts;
  return decrypt(encrypted, iv, authTag);
}

/**
 * Hash a value for lookup (e.g., to find encrypted API key by hash)
 * Uses SHA-256
 */
export function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Verify the encryption system is properly configured
 */
export function verifyEncryptionSetup(): boolean {
  try {
    const testValue = 'encryption-test-' + Date.now();
    const encrypted = encryptToString(testValue);
    const decrypted = decryptFromString(encrypted);
    return decrypted === testValue;
  } catch (error) {
    console.error('[Encryption] Setup verification failed:', error);
    return false;
  }
}

/**
 * Rotate encryption key - re-encrypt data with new key
 * This is a placeholder for key rotation implementation
 */
export async function rotateKey(
  oldKey: string,
  newKey: string,
  reEncryptCallback: (decrypt: (s: string) => string, encrypt: (s: string) => string) => Promise<void>
): Promise<void> {
  // Store original key
  const originalKey = process.env.ENCRYPTION_MASTER_KEY;

  try {
    // Decrypt with old key
    process.env.ENCRYPTION_MASTER_KEY = oldKey;
    const decryptFn = decryptFromString;

    // Encrypt with new key
    process.env.ENCRYPTION_MASTER_KEY = newKey;
    const encryptFn = encryptToString;

    // Perform re-encryption via callback
    await reEncryptCallback(decryptFn, encryptFn);
  } finally {
    // Restore original key
    process.env.ENCRYPTION_MASTER_KEY = originalKey || '';
  }
}
