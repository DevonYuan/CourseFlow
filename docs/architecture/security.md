# Security Design

This document describes the encryption design for sensitive settings, specifically the Canvas iCal URL.

## Threat Model

- **Assumption**: The user's machine is trusted (no malware, no physical access by attackers).
- **Goal**: Protect the iCal URL from casual inspection of the SQLite database file.
- **Non-goal**: Protection against a compromised OS or malicious software running as the user.

## iCal URL Encryption

### Storage Location

The encrypted iCal URL is stored in the `settings` table with key `ical_url`.

### Encryption Format

The `value` column contains a JSON string with the following structure:

```json
{
  "ciphertext": "base64-encoded-ciphertext",
  "iv": "base64-encoded-iv",
  "salt": "base64-encoded-salt"
}
```

- **ciphertext**: AES-GCM encrypted payload (includes authentication tag)
- **iv**: 12-byte initialization vector (96 bits, recommended for GCM)
- **salt**: 16-byte salt for PBKDF2 key derivation

### Algorithm

- **Cipher**: AES-GCM 256-bit
- **Key Derivation**: PBKDF2-HMAC-SHA256
  - Iterations: 100,000 (adjustable based on hardware)
  - Salt: 16 bytes (cryptographically random)
- **IV**: 12 bytes (cryptographically random per encryption)

### Key Management

**Phase 1 (Current Design):**

- Application-generated key stored in OS keychain via `keytar` / `electron-store`
- Key is derived from a machine-specific secret (not user password)
- Simpler UX: no master password required

**Future Enhancement (Post-MVP):**

- Optional user-set master password
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

- **Main process only** — Renderer never sees plaintext URL
- **Repository methods** (Phase 1 implementation):
  - `setEncryptedSetting(key: string, value: string): Promise<void>`
  - `getDecryptedSetting(key: string): Promise<string | null>`
- **IPC handlers** expose only high-level `setSetting` / `getSetting` which handle encryption transparently for sensitive keys

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
4. **No plaintext in renderer**: Preload bridge only exposes `setSetting`/`getSetting` — encryption/decryption happens in main process
5. **Machine secret storage**: Use `keytar` (cross-platform native keychain) or `electron-store` with encryption for the master key

---

## Auto-Sync Interval Setting

### Setting Key

`sync_interval_minutes`

### Default Value

`15` (minutes)

### User Configurable

Yes — exposed in Settings UI (Phase 2+)

### Behavior

- Background timer in main process fetches iCal feed at interval
- Minimum allowed value: `5` minutes (to avoid Canvas rate limits)
- Maximum allowed value: `1440` minutes (24 hours)
- Value `0` disables auto-sync (manual only)

### Storage

Plaintext JSON number in `settings.value` for key `sync_interval_minutes` (not encrypted — not sensitive).

---

## Future Considerations

- **Key rotation**: Support re-encrypting all encrypted settings with new key
- **Backup/restore**: Export encrypted settings (without master key) for backup
- **Audit log**: Log encryption/decryption operations for debugging
