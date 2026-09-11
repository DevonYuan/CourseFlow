# Security Design

This document describes the encryption design for sensitive settings, specifically the iCal feed URL.

## Threat Model

- **Assumption**: The user's machine is trusted (no malware, no physical access by attackers).
- **Goal**: Protect the iCal URL from casual inspection of the SQLite database file.
- **Non-goal**: Protection against a compromised OS or malicious software running as the user.

## iCal URL Encryption

### Storage Location

The encrypted feed URL is stored in the `settings` key-value table under the **camelCase key `icalUrl`** (i.e., a row with `key = 'icalUrl'` whose `value` column holds the JSON envelope below).

### Encryption Format

The `value` column contains a JSON string with the following structure (mirrors the `EncryptedSetting` type):

```json
{
  "v": 1,
  "ciphertext": "base64url-encoded-ciphertext",
  "iv": "base64url-encoded-iv",
  "salt": "base64url-encoded-salt"
}
```

- **v**: format version (currently `1`)
- **ciphertext**: AES-GCM encrypted payload (includes authentication tag)
- **iv**: 12-byte initialization vector (96 bits, recommended for GCM)
- **salt**: 16-byte salt for PBKDF2 key derivation

All binary fields are **base64url**-encoded (URL-safe, no padding) in the actual implementation.

### Algorithm

- **Cipher**: AES-GCM 256-bit
- **Key Derivation**: PBKDF2-HMAC-SHA256
  - Iterations: 100,000 (adjustable based on hardware)
  - Salt: 16 bytes (cryptographically random)
- **IV**: 12 bytes (cryptographically random per encryption)

### Key Management

**Phase 1 (Current Design):**

- No OS-keychain dependency yet — a deterministic **machine passphrase** is derived from the Electron `userData` path: `courseflow-<userData>-v1` (see `getPassphrase()` in `src/backend/main/security/encryption.ts`)
- A fresh random 16-byte salt is generated per encryption, so the derived key differs for every stored value
- Simpler UX: no master password required; encryption/decryption happens only in the main process

**Future Enhancement (Post-MVP):**

- Optional user-set master password or OS-keychain-backed secret
- Key derived from password + salt via PBKDF2
- Allows portable encrypted settings across machines

### Encryption Flow (Main Process Only)

```
Plaintext iCal URL
       │
       ▼
┌──────────────────┐
│ Generate random  │
│ 12-byte IV       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Generate random  │
│ 16-byte salt     │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ Derive 256-bit key via       │
│ PBKDF2(machineSecret, salt,  │
│ 100000, SHA-256)             │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Encrypt with AES-GCM-256     │
│ (key, iv, plaintext)         │
│ → ciphertext + authTag       │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Base64 encode:               │
│ ciphertext, iv, salt         │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Store JSON in settings.value │
└──────────────────────────────┘
```

### Decryption Flow

```
JSON from settings.value
       │
       ▼
┌──────────────────┐
│ Base64 decode:   │
│ ciphertext, iv,  │
│ salt             │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ Derive 256-bit key via       │
│ PBKDF2(machineSecret, salt,  │
│ 100000, SHA-256)             │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Decrypt with AES-GCM-256     │
│ (key, iv, ciphertext)        │
│ → plaintext (or throw on     │
│   auth failure)              │
└────────┬─────────────────────┘
         │
         ▼
   Plaintext iCal URL
```

### Implementation Location

- **Main process only** — Renderer never sees the plaintext URL during save (it is encrypted before it leaves `repository.setSettings`)
- **Module** (current implementation): `src/backend/main/security/encryption.ts` exposes `encryptIcalUrl(url)` / `decryptIcalUrl(payload)`
- **Repository** (`src/backend/main/db/repository.ts`): the generic `setSetting`/`setSettings`/`getAllSettings` transparently encrypt/decrypt whenever the key is `icalUrl` — no separate `setEncryptedSetting` helper exists
- **IPC handlers** expose only high-level `settings:get` / `settings:set` / `settings:reset`, which handle encryption transparently

### Web Crypto API Usage

All cryptographic operations use the standard `crypto.subtle` API (available in Node.js 19+ and Electron main process):

```typescript
// Key derivation
const keyMaterial = await crypto.subtle.importKey('raw', machineSecret, 'PBKDF2', false, [
  'deriveKey',
]);

const key = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt,
    iterations: 100000,
    hash: 'SHA-256',
  },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt'],
);

// Encryption
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBuffer);

// Decryption
const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBuffer);
```

### Security Notes

1. **Auth tag included**: AES-GCM authentication tag is appended to ciphertext (standard Web Crypto behavior)
2. **Unique IV per encryption**: Never reuse IV with same key
3. **Salt per encryption**: Unique salt enables key rotation and prevents rainbow tables
4. **No plaintext in renderer**: Preload exposes `settings.get`/`settings.set`/`settings.reset` only — encryption/decryption happens in the main process (the decrypted `icalUrl` is delivered to the renderer for display in Settings)
5. **Machine secret storage**: Use `keytar` (cross-platform native keychain) or `electron-store` with encryption for the master key

---

## Auto-Sync Interval Setting

### Setting Keys

- `syncIntervalMinutes` — scheduler interval in minutes
- `autoFetchIcal` — boolean that enables/disables the background scheduler
- `icalFetchIntervalMinutes` — interval used by the Settings dropdown and the `autoFetchIntervalMs` computation (kept in sync with `syncIntervalMinutes` when saved from the UI)

### Default Value

`syncIntervalMinutes = 15`, `autoFetchIcal = false`

### User Configurable

Yes — exposed in Settings (Phase 2+): "Auto-fetch Interval" dropdown with **Off / 15 min / 30 min / 1 h / 6 h / 12 h / 24 h**.

### Behavior

- The main-process scheduler fetches the iCal feed on the configured interval while `autoFetchIcal` is true, the URL is set, and the interval is > 0.
- Value `0` (Off) disables auto-sync (manual "Sync Now" still works).
- Manual "Sync Now" always works regardless of the auto-fetch setting.

### Storage

Plaintext JSON numbers/booleans in `settings.value` for the camelCase keys above (not encrypted — not sensitive).

---

## Future Considerations

- **Key rotation**: Support re-encrypting all encrypted settings with new key
- **Backup/restore**: Export encrypted settings (without master key) for backup
- **Audit log**: Log encryption/decryption operations for debugging
