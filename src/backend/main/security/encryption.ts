/**
 * iCal URL Encryption — Main Process Only
 *
 * AES-GCM encryption with PBKDF2 key derivation for storing the Canvas iCal URL
 * in the settings table. Uses Web Crypto API (available in Electron Main via Node).
 *
 * @module @backend/main/security/encryption
 */

import { app } from 'electron';

/**
 * Encrypted setting structure stored in the database.
 * All binary values are base64url-encoded strings.
 */
export interface EncryptedSetting {
  /** Version for future migration */
  v: 1;
  /** AES-GCM ciphertext (includes auth tag), base64url encoded */
  ciphertext: string;
  /** 12-byte IV for AES-GCM, base64url encoded */
  iv: string;
  /** 16-byte salt for PBKDF2, base64url encoded */
  salt: string;
}

/**
 * Error thrown when encryption fails.
 */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Error thrown when decryption fails.
 */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Convert ArrayBuffer to base64url string (no padding, URL-safe).
 */
function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCodePoint(byte);
    }
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * Convert base64url string to ArrayBuffer.
 */
function fromBase64Url(base64url: string): ArrayBuffer {
  const base64 = base64url.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Cast to ensure ArrayBuffer (not SharedArrayBuffer)
  return bytes.buffer;
}

/**
 * Get the machine-specific passphrase for key derivation.
 * This is deterministic per machine but not user-specific.
 * SECURITY NOTE: Any process on this machine can decrypt. Phase 2 should add
 * user-set passphrase or OS keychain integration.
 */
function getPassphrase(): string {
  return `courseflow-${app.getPath('userData')}-v1`;
}

/**
 * Derive an AES-GCM key from passphrase and salt using PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext iCal URL for storage.
 * @param url - The plaintext iCal URL to encrypt
 * @returns EncryptedSetting object with version, ciphertext, IV, and salt (all base64url)
 * @throws EncryptionError if encryption fails
 */
export async function encryptIcalUrl(url: string): Promise<EncryptedSetting> {
  try {
    const passphrase = getPassphrase();

    // Generate random 16-byte salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Generate random 12-byte IV (recommended for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from passphrase and salt
    const key = await deriveKey(passphrase, salt);

    // Encrypt the URL
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(url);
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext,
    );

    return {
      v: 1,
      ciphertext: toBase64Url(ciphertextBuffer),
      iv: toBase64Url(iv.buffer),
      salt: toBase64Url(salt.buffer),
    };
  } catch {
    throw new EncryptionError('Failed to encrypt iCal URL');
  }
}

/**
 * Decrypt an iCal URL from storage.
 * @param encrypted - The EncryptedSetting object from the database
 * @returns The decrypted plaintext iCal URL
 * @throws DecryptionError if decryption fails (invalid data, wrong key, tampered data, etc.)
 */
export async function decryptIcalUrl(encrypted: EncryptedSetting): Promise<string> {
  try {
    // Validate version
    if (encrypted.v !== 1) {
      throw new DecryptionError('Unsupported encryption version');
    }

    const passphrase = getPassphrase();

    // Decode base64url values
    const salt = new Uint8Array(fromBase64Url(encrypted.salt));
    const iv = new Uint8Array(fromBase64Url(encrypted.iv));
    const ciphertext = new Uint8Array(fromBase64Url(encrypted.ciphertext));

    // Derive key from passphrase and salt
    const key = await deriveKey(passphrase, salt);

    // Decrypt the ciphertext
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch (error) {
    if (error instanceof DecryptionError) {
      throw error;
    }
    // Generic error message - don't leak crypto details
    throw new DecryptionError('Failed to decrypt iCal URL');
  }
}

/**
 * Check if a value appears to be an encrypted setting (has the expected structure).
 */
export function isEncryptedSetting(value: unknown): value is EncryptedSetting {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj['v'] === 1 &&
    typeof obj['ciphertext'] === 'string' &&
    typeof obj['iv'] === 'string' &&
    typeof obj['salt'] === 'string'
  );
}