/**
 * iCal URL Encryption — Main Process Only
 *
 * AES-GCM encryption with PBKDF2 key derivation for storing the Canvas iCal URL
 * in the settings table. Uses Web Crypto API (available in Electron Main via Node).
 *
 * @module @backend/main/security/encryption
 */
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
export declare class EncryptionError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when decryption fails.
 */
export declare class DecryptionError extends Error {
    constructor(message: string);
}
/**
 * Encrypt a plaintext iCal URL for storage.
 * @param url - The plaintext iCal URL to encrypt
 * @returns EncryptedSetting object with version, ciphertext, IV, and salt (all base64url)
 * @throws EncryptionError if encryption fails
 */
export declare function encryptIcalUrl(url: string): Promise<EncryptedSetting>;
/**
 * Decrypt an iCal URL from storage.
 * @param encrypted - The EncryptedSetting object from the database
 * @returns The decrypted plaintext iCal URL
 * @throws DecryptionError if decryption fails (invalid data, wrong key, tampered data, etc.)
 */
export declare function decryptIcalUrl(encrypted: EncryptedSetting): Promise<string>;
/**
 * Check if a value appears to be an encrypted setting (has the expected structure).
 */
export declare function isEncryptedSetting(value: unknown): value is EncryptedSetting;
//# sourceMappingURL=encryption.d.ts.map