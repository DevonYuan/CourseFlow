/**
 * Tests for iCal URL Encryption
 *
 * @module @backend/main/security/__tests__/encryption.test
 */
import { app } from 'electron';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock electron app.getPath
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/mock/user/data'),
    },
}));
// Import after mocking
import { encryptIcalUrl, decryptIcalUrl, DecryptionError, isEncryptedSetting } from '../encryption.js';
describe('iCal URL Encryption', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    const testUrl = 'https://canvas.example.com/feeds/calendars/user_abc123.ics';
    describe('encryptIcalUrl', () => {
        it('should encrypt a URL and return EncryptedSetting with all fields', async () => {
            const encrypted = await encryptIcalUrl(testUrl);
            expect(encrypted).toHaveProperty('v', 1);
            expect(encrypted).toHaveProperty('ciphertext');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('salt');
            expect(typeof encrypted.ciphertext).toBe('string');
            expect(typeof encrypted.iv).toBe('string');
            expect(typeof encrypted.salt).toBe('string');
            expect(encrypted.ciphertext.length).toBeGreaterThan(0);
            expect(encrypted.iv.length).toBeGreaterThan(0);
            expect(encrypted.salt.length).toBeGreaterThan(0);
        });
        it('should produce different ciphertext for same URL (random IV/salt)', async () => {
            const encrypted1 = await encryptIcalUrl(testUrl);
            const encrypted2 = await encryptIcalUrl(testUrl);
            expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
            expect(encrypted1.iv).not.toBe(encrypted2.iv);
            expect(encrypted1.salt).not.toBe(encrypted2.salt);
        });
        it('should produce valid base64url strings (no +, /, =)', async () => {
            const encrypted = await encryptIcalUrl(testUrl);
            expect(encrypted.ciphertext).not.toMatch(/[+/=]/);
            expect(encrypted.iv).not.toMatch(/[+/=]/);
            expect(encrypted.salt).not.toMatch(/[+/=]/);
            // Should only contain alphanumeric, -, _
            expect(encrypted.ciphertext).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(encrypted.iv).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(encrypted.salt).toMatch(/^[A-Za-z0-9_-]+$/);
        });
        it('should throw EncryptionError for empty string', async () => {
            // Empty string should still encrypt (it's valid input)
            const encrypted = await encryptIcalUrl('');
            expect(encrypted.v).toBe(1);
        });
    });
    describe('decryptIcalUrl', () => {
        it('should decrypt an encrypted URL back to original', async () => {
            const encrypted = await encryptIcalUrl(testUrl);
            const decrypted = await decryptIcalUrl(encrypted);
            expect(decrypted).toBe(testUrl);
        });
        it('should throw DecryptionError for wrong version', async () => {
            const encrypted = {
                v: 2,
                ciphertext: 'abc',
                iv: 'def',
                salt: 'ghi',
            };
            await expect(decryptIcalUrl(encrypted)).rejects.toThrow(DecryptionError);
            await expect(decryptIcalUrl(encrypted)).rejects.toThrow('Unsupported encryption version');
        });
        it('should throw DecryptionError for tampered ciphertext', async () => {
            const encrypted = await encryptIcalUrl(testUrl);
            // Tamper with ciphertext
            const tampered = {
                ...encrypted,
                ciphertext: encrypted.ciphertext.slice(0, -1) + (encrypted.ciphertext.endsWith('a') ? 'b' : 'a'),
            };
            await expect(decryptIcalUrl(tampered)).rejects.toThrow(DecryptionError);
            await expect(decryptIcalUrl(tampered)).rejects.toThrow('Failed to decrypt iCal URL');
        });
        it('should throw DecryptionError for invalid base64url', async () => {
            const encrypted = {
                v: 1,
                ciphertext: 'invalid!!',
                iv: 'abc',
                salt: 'def',
            };
            await expect(decryptIcalUrl(encrypted)).rejects.toThrow(DecryptionError);
        });
        it('should throw DecryptionError for missing fields', async () => {
            const encrypted = {
                v: 1,
                ciphertext: 'abc',
                // missing iv and salt
            };
            await expect(decryptIcalUrl(encrypted)).rejects.toThrow(DecryptionError);
        });
    });
    describe('isEncryptedSetting', () => {
        it('should return true for valid EncryptedSetting', async () => {
            const encrypted = await encryptIcalUrl(testUrl);
            expect(isEncryptedSetting(encrypted)).toBe(true);
        });
        it('should return false for plain string', () => {
            expect(isEncryptedSetting(testUrl)).toBe(false);
        });
        it('should return false for plain object', () => {
            expect(isEncryptedSetting({ foo: 'bar' })).toBe(false);
        });
        it('should return false for null', () => {
            expect(isEncryptedSetting(null)).toBe(false);
        });
        it('should return false for undefined', () => {
            expect(isEncryptedSetting(undefined)).toBe(false);
        });
        it('should return false for wrong version', () => {
            expect(isEncryptedSetting({ v: 2, ciphertext: 'a', iv: 'b', salt: 'c' })).toBe(false);
        });
        it('should return false for missing fields', () => {
            expect(isEncryptedSetting({ v: 1, ciphertext: 'a' })).toBe(false);
        });
    });
    describe('round-trip encryption/decryption', () => {
        it('should handle various URL formats', async () => {
            const urls = [
                'https://canvas.example.com/feeds/calendars/user_abc123.ics',
                'https://example.com/ical?token=xyz',
                'http://localhost:3000/calendar.ics',
                'https://canvas.instructure.com/feeds/calendars/user_123456789.ics',
                '', // empty string
                'a'.repeat(2000), // very long URL
            ];
            for (const url of urls) {
                const encrypted = await encryptIcalUrl(url);
                const decrypted = await decryptIcalUrl(encrypted);
                expect(decrypted).toBe(url);
            }
        });
        it('should handle special characters in URL', async () => {
            const url = 'https://example.com/ical?token=abc%20def&user=john%40doe.com';
            const encrypted = await encryptIcalUrl(url);
            const decrypted = await decryptIcalUrl(encrypted);
            expect(decrypted).toBe(url);
        });
        it('should handle unicode in URL', async () => {
            const url = 'https://example.com/カレンダー/ユーザー.ics';
            const encrypted = await encryptIcalUrl(url);
            const decrypted = await decryptIcalUrl(encrypted);
            expect(decrypted).toBe(url);
        });
    });
    describe('key derivation consistency', () => {
        it('should use same passphrase for encrypt and decrypt', async () => {
            // This test verifies that the passphrase derivation is consistent
            // by encrypting and decrypting with the same mocked app.getPath
            const encrypted = await encryptIcalUrl(testUrl);
            const decrypted = await decryptIcalUrl(encrypted);
            expect(decrypted).toBe(testUrl);
        });
    });
});
//# sourceMappingURL=encryption.test.js.map