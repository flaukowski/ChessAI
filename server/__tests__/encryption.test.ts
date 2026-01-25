/**
 * Encryption Module Unit Tests
 *
 * Tests for AES-256-GCM encryption utilities
 * Target: 95%+ coverage of encryption.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptToString,
  decryptFromString,
  hashForLookup,
  generateSecureToken,
  verifyEncryptionSetup,
} from '../encryption';

// Test constants
const TEST_KEY_HEX = 'a'.repeat(64); // Valid 32-byte key as hex
const ALTERNATE_KEY_HEX = 'b'.repeat(64); // Another valid 32-byte key

describe('Encryption Module', () => {
  // Store original env values
  let originalMasterKey: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Save original environment
    originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;
    originalNodeEnv = process.env.NODE_ENV;

    // Set test key by default
    process.env.ENCRYPTION_MASTER_KEY = TEST_KEY_HEX;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment
    if (originalMasterKey !== undefined) {
      process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
    } else {
      delete process.env.ENCRYPTION_MASTER_KEY;
    }

    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    vi.restoreAllMocks();
  });

  describe('encrypt()', () => {
    it('should encrypt plaintext and return encrypted data with IV and authTag', () => {
      const plaintext = 'Hello, World!';
      const result = encrypt(plaintext);

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');

      // Verify all values are base64 encoded strings
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.authTag).toBe('string');

      // Encrypted should be different from plaintext
      expect(result.encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (IV randomness)', () => {
      const plaintext = 'Same plaintext for both encryptions';

      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);

      // IVs must be different (random)
      expect(result1.iv).not.toBe(result2.iv);

      // Encrypted data should also differ due to different IV
      expect(result1.encrypted).not.toBe(result2.encrypted);

      // Auth tags should differ as well
      expect(result1.authTag).not.toBe(result2.authTag);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const result = encrypt(plaintext);

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');

      // Even empty string should produce output
      expect(result.iv.length).toBeGreaterThan(0);
      expect(result.authTag.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Hello! Emoji test: \u{1F600} \u{1F389} \u{1F680}';
      const result = encrypt(plaintext);

      expect(result).toHaveProperty('encrypted');
      expect(typeof result.encrypted).toBe('string');
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~';
      const result = encrypt(plaintext);

      expect(result).toHaveProperty('encrypted');
      expect(typeof result.encrypted).toBe('string');
    });

    it('should handle multiline strings', () => {
      const plaintext = 'Line 1\nLine 2\r\nLine 3\tTabbed';
      const result = encrypt(plaintext);

      expect(result).toHaveProperty('encrypted');
    });

    it('should handle large payloads', () => {
      // 1MB of data
      const plaintext = 'x'.repeat(1024 * 1024);
      const result = encrypt(plaintext);

      expect(result).toHaveProperty('encrypted');
      expect(result.encrypted.length).toBeGreaterThan(0);
    });

    it('should handle JSON strings', () => {
      const jsonData = JSON.stringify({ key: 'value', nested: { arr: [1, 2, 3] } });
      const result = encrypt(jsonData);

      expect(result).toHaveProperty('encrypted');
    });
  });

  describe('decrypt()', () => {
    it('should decrypt ciphertext and return original plaintext', () => {
      const plaintext = 'Secret message';
      const { encrypted, iv, authTag } = encrypt(plaintext);

      const decrypted = decrypt(encrypted, iv, authTag);

      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip encrypt/decrypt for various data sizes', () => {
      const testCases = [
        '', // empty
        'a', // single char
        'Hello', // short string
        'x'.repeat(100), // medium
        'y'.repeat(10000), // large
      ];

      for (const testCase of testCases) {
        const { encrypted, iv, authTag } = encrypt(testCase);
        const decrypted = decrypt(encrypted, iv, authTag);
        expect(decrypted).toBe(testCase);
      }
    });

    it('should round-trip unicode content correctly', () => {
      const testCases = [
        '\u4F60\u597D', // Chinese
        '\u3053\u3093\u306B\u3061\u306F', // Japanese
        '\uD83D\uDE00\uD83C\uDF89\uD83D\uDE80', // Emojis
        '\u00E9\u00E8\u00EA\u00EB', // French accents
        '\u0410\u0411\u0412\u0413', // Cyrillic
      ];

      for (const testCase of testCases) {
        const { encrypted, iv, authTag } = encrypt(testCase);
        const decrypted = decrypt(encrypted, iv, authTag);
        expect(decrypted).toBe(testCase);
      }
    });

    it('should fail with tampered ciphertext', () => {
      const { encrypted, iv, authTag } = encrypt('Original message');

      // Tamper with the encrypted data
      const tamperedEncrypted = encrypted.slice(0, -2) + 'XX';

      expect(() => {
        decrypt(tamperedEncrypted, iv, authTag);
      }).toThrow();
    });

    it('should fail with tampered IV', () => {
      const { encrypted, iv, authTag } = encrypt('Original message');

      // Tamper with IV
      const ivBuffer = Buffer.from(iv, 'base64');
      ivBuffer[0] = ivBuffer[0] ^ 0xFF; // Flip bits
      const tamperedIv = ivBuffer.toString('base64');

      expect(() => {
        decrypt(encrypted, tamperedIv, authTag);
      }).toThrow();
    });

    it('should fail with tampered auth tag', () => {
      const { encrypted, iv, authTag } = encrypt('Original message');

      // Tamper with auth tag
      const tagBuffer = Buffer.from(authTag, 'base64');
      tagBuffer[0] = tagBuffer[0] ^ 0xFF;
      const tamperedTag = tagBuffer.toString('base64');

      expect(() => {
        decrypt(encrypted, iv, tamperedTag);
      }).toThrow();
    });

    it('should fail with wrong key', () => {
      const { encrypted, iv, authTag } = encrypt('Secret data');

      // Change to different key
      process.env.ENCRYPTION_MASTER_KEY = ALTERNATE_KEY_HEX;

      expect(() => {
        decrypt(encrypted, iv, authTag);
      }).toThrow();
    });
  });

  describe('encryptToString()', () => {
    it('should return combined format: iv:authTag:encrypted', () => {
      const plaintext = 'Test data';
      const combined = encryptToString(plaintext);

      const parts = combined.split(':');
      expect(parts.length).toBe(3);

      // Each part should be non-empty
      expect(parts[0].length).toBeGreaterThan(0); // IV
      expect(parts[1].length).toBeGreaterThan(0); // authTag
      expect(parts[2].length).toBeGreaterThan(0); // encrypted
    });

    it('should work with data containing colons', () => {
      const plaintext = 'data:with:colons:inside';
      const combined = encryptToString(plaintext);

      // Should still have exactly 3 parts (colons in data get encrypted)
      const parts = combined.split(':');
      expect(parts.length).toBe(3);
    });
  });

  describe('decryptFromString()', () => {
    it('should decrypt combined format back to original', () => {
      const plaintext = 'Sensitive information';
      const combined = encryptToString(plaintext);
      const decrypted = decryptFromString(combined);

      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip various content types', () => {
      const testCases = [
        'Simple text',
        'api_key_12345',
        '{"json": "data", "array": [1,2,3]}',
        'Base64: SGVsbG8gV29ybGQh',
        'Special: !@#$%^&*()',
      ];

      for (const testCase of testCases) {
        const combined = encryptToString(testCase);
        const decrypted = decryptFromString(combined);
        expect(decrypted).toBe(testCase);
      }
    });

    it('should throw for invalid format - missing parts', () => {
      expect(() => {
        decryptFromString('only:two');
      }).toThrow();
    });

    it('should throw for invalid format - single value', () => {
      expect(() => {
        decryptFromString('singlevalue');
      }).toThrow();
    });

    it('should throw for invalid format - empty string', () => {
      expect(() => {
        decryptFromString('');
      }).toThrow();
    });
  });

  describe('hashForLookup()', () => {
    it('should return SHA-256 hash as hex string', () => {
      const value = 'test-value';
      const hash = hashForLookup(value);

      // SHA-256 produces 64 hex characters
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('should produce consistent hash for same input', () => {
      const value = 'consistent-input';
      const hash1 = hashForLookup(value);
      const hash2 = hashForLookup(value);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashForLookup('value1');
      const hash2 = hashForLookup('value2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashForLookup('');

      // SHA-256 of empty string is a known value
      expect(hash.length).toBe(64);
    });

    it('should handle unicode', () => {
      const hash = hashForLookup('\u4F60\u597D\uD83D\uDE00');

      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe('generateSecureToken()', () => {
    it('should generate token of specified length', () => {
      const token16 = generateSecureToken(16);
      const token32 = generateSecureToken(32);
      const token64 = generateSecureToken(64);

      // Each byte becomes 2 hex characters
      expect(token16.length).toBe(32);
      expect(token32.length).toBe(64);
      expect(token64.length).toBe(128);
    });

    it('should generate token with default length of 32 bytes', () => {
      const token = generateSecureToken();

      // 32 bytes = 64 hex characters
      expect(token.length).toBe(64);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();

      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }

      // All 100 tokens should be unique
      expect(tokens.size).toBe(100);
    });

    it('should only contain hex characters', () => {
      const token = generateSecureToken(32);

      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('verifyEncryptionSetup()', () => {
    it('should return true when encryption is properly configured', () => {
      const result = verifyEncryptionSetup();

      expect(result).toBe(true);
    });

    it('should return false when encryption fails', () => {
      // Set invalid key
      process.env.ENCRYPTION_MASTER_KEY = 'invalid';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = verifyEncryptionSetup();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Security Properties', () => {
    it('should use 16-byte IV (128 bits)', () => {
      const { iv } = encrypt('test');
      const ivBuffer = Buffer.from(iv, 'base64');

      expect(ivBuffer.length).toBe(16);
    });

    it('should use 16-byte auth tag (128 bits)', () => {
      const { authTag } = encrypt('test');
      const tagBuffer = Buffer.from(authTag, 'base64');

      expect(tagBuffer.length).toBe(16);
    });

    it('should produce cryptographically random IVs', () => {
      const ivs = new Set();

      for (let i = 0; i < 100; i++) {
        const { iv } = encrypt('same-plaintext');
        ivs.add(iv);
      }

      // All 100 IVs should be unique
      expect(ivs.size).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle strings with null characters', () => {
      const withNull = 'before\0after';
      const encrypted = encryptToString(withNull);
      const decrypted = decryptFromString(encrypted);

      expect(decrypted).toBe(withNull);
    });

    it('should handle whitespace-only strings', () => {
      const whitespace = '   \t\n\r  ';
      const encrypted = encryptToString(whitespace);
      const decrypted = decryptFromString(encrypted);

      expect(decrypted).toBe(whitespace);
    });

    it('should handle repeated encryption/decryption cycles', () => {
      let data = 'initial';

      for (let i = 0; i < 10; i++) {
        const encrypted = encryptToString(data);
        data = decryptFromString(encrypted);
      }

      expect(data).toBe('initial');
    });
  });
});
