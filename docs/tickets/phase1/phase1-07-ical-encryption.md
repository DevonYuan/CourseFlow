# Ticket: phase1-07-ical-encryption

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 0.5 day

---

## Description

Implement AES-GCM encryption for the iCal URL in the `settings` table per `docs/architecture/security.md`. Use Web Crypto API in Main process; store `{ ciphertext, iv, salt }` as JSON string in `settings.value` for key `icalUrl`.

**PREREQUISITE**: Ticket 1.0 (Data Model Alignment) adds `icalUrl` field to `Settings` type.

---

## Requirements

### Functional

- [ ] **Encryption**: `encryptIcalUrl(url: string): Promise<EncryptedSetting>` — returns `{ ciphertext: string; iv: string; salt: string }` (all base64url encoded)
- [ ] **Decryption**: `decryptIcalUrl(encrypted: EncryptedSetting): Promise<string>` — returns original URL
- [ ] **Key Derivation**: PBKDF2 with SHA-256, 100,000 iterations, 256-bit key
  - Salt: 16 bytes random (generated per encryption)
  - Passphrase: Derived from machine-specific secret (see below)
- [ ] **Storage**: `settings` table, key `icalUrl`, value = JSON string of `EncryptedSetting`
- [ ] **Integration**: `settings:get` decrypts `icalUrl` before returning; `settings:set` encrypts `icalUrl` before storing

### Non-Functional

- [ ] **Web Crypto API** — Node 24 has full `crypto.subtle` support in Electron Main
- [ ] **Zero `any`** — typed `EncryptedSetting` interface
- [ ] **Key Management**: Passphrase derived from `app.getPath('userData')` + fixed string (not user password for MVP)
  - **SECURITY NOTE**: This is machine-specific but not user-specific. Any process on the machine can decrypt. Phase 2 should add user-set passphrase or OS keychain integration.
- [ ] **Error Handling**: Throw `EncryptionError` / `DecryptionError` with generic messages (don't leak crypto details)

---

## Designs & Constraints

- **Location**: `src/backend/main/security/encryption.ts`
- **Export**: `encryptIcalUrl`, `decryptIcalUrl`, `EncryptedSetting`, `EncryptionError`, `DecryptionError`
- **Dependencies**: None (Web Crypto API built-in)

### `EncryptedSetting` Type

```typescript
export interface EncryptedSetting {
  v: 1; // Version for future migration
  ciphertext: string; // base64url
  iv: string; // base64url (12 bytes for AES-GCM)
  salt: string; // base64url (16 bytes for PBKDF2)
}
```

### Key Derivation (Main Process Only)

```typescript
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
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

// Passphrase: machine-specific but deterministic
const passphrase = `courseflow-${app.getPath('userData')}-v1`;
```

### Encryption Flow

1. Generate random 16-byte salt
2. Derive key via PBKDF2(passphrase, salt)
3. Generate random 12-byte IV
4. Encrypt with AES-GCM(key, iv, url)
5. Store `{ v: 1, ciphertext, iv, salt }` as JSON in `settings.value`

### Decryption Flow

1. Parse JSON from `settings.value`
2. Derive key via PBKDF2(passphrase, salt)
3. Decrypt with AES-GCM(key, iv, ciphertext)
4. Return plaintext URL

---

## Code Changes

### New Files

- `src/backend/main/security/encryption.ts` — encryption module
- `src/backend/main/security/__tests__/encryption.test.ts` — unit tests

### Modified Files

- `src/backend/main/db/repository.ts` — `getAllSettings`/`setSetting` to handle `icalUrl` encryption/decryption transparently
- `src/backend/shared/types.ts` — add `EncryptedSetting` type (or keep in encryption.ts)

- `src/backend/main/security/encryption.ts` — encryption/decryption implementation
- `src/backend/main/security/__tests__/encryption.test.ts` — unit tests

### Modified Files

- `src/backend/main/ipc-handlers.ts` — integrate encryption in `settings:get`/`settings:set` for `icalUrl` key
- `src/backend/shared/types.ts` — add `EncryptedSetting` interface

---

## Acceptance Criteria

| #   | Criterion                                                 | Verification                                                 |
| --- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | `encryptIcalUrl` returns valid `EncryptedSetting`         | Unit test: roundtrip encrypt→decrypt                         |
| 2   | `decryptIcalUrl` returns original URL                     | Unit test with known ciphertext                              |
| 3   | Different salt → different ciphertext (non-deterministic) | Test two encryptions of same URL                             |
| 4   | Wrong passphrase fails decryption                         | Test with modified passphrase                                |
| 5   | `settings:get` returns decrypted `icalUrl`                | Integration test via IPC                                     |
| 6   | `settings:set` stores encrypted `icalUrl`                 | Verify DB `settings.value` is JSON with v/ciphertext/iv/salt |
| 7   | Corrupted ciphertext throws `DecryptionError`             | Test with tampered data                                      |
| 8   | All tests pass (`pnpm test`)                              | CI run                                                       |

---

## Notes

- Per `docs/architecture/security.md`: iCal URL is the only sensitive setting requiring encryption
- Passphrase is machine-bound (derived from `userData` path) — acceptable for MVP local-only app
- Version field (`v: 1`) enables future algorithm migration
- AES-GCM provides authenticity + confidentiality; IV must never be reused with same key (random IV per encryption ensures this)
- 100,000 PBKDF2 iterations = ~50-100ms on modern hardware (acceptable for settings load/save)

---

## Release Summary

Add AES-GCM encryption for iCal URL in settings using Web Crypto API
