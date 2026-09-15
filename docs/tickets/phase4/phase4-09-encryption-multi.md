# Ticket: phase4-09-encryption-multi

## Title
**Multi-Feed Encryption**

## Description
Reuse existing AES-GCM encryption (`security.md`). Each `CalendarSource.feed_url` encrypted independently with its own salt/IV. `settings.icalUrl` deprecated (kept for backward compat, read-only).

## Acceptance Criteria
- [ ] `CalendarSource.feed_url` uses same encryption format as `settings.icalUrl` (JSON envelope v1)
- [ ] Each calendar gets unique salt/IV (already handled by `encryptSetting`)
- [ ] `settings.icalUrl` remains readable for migration but no longer written
- [ ] New calendars created via UI encrypt feed_url automatically
- [ ] Scheduler decrypts feed_url per calendar before fetch
- [ ] No plaintext URLs stored in database
- [ ] Unit tests for encrypt/decrypt round-trip per calendar

## Technical Details

### Encryption Format (Reused from security.md)
```json
{
  "v": 1,
  "ciphertext": "base64url-encoded",
  "iv": "base64url-encoded",
  "salt": "base64url-encoded"
}
```

### Encryption Module (src/backend/main/security/encryption.ts)
- Existing functions: `encryptSetting(plaintext: string): Promise<string>`, `decryptSetting(encrypted: string): Promise<string>`
- Key derivation: PBKDF2-HMAC-SHA256, 100,000 iterations, machine-specific passphrase
- Each call generates fresh 16-byte salt + 12-byte IV → unique ciphertext per calendar

### Repository Usage
```typescript
// In createCalendar / updateCalendar
const encryptedFeedUrl = await encryptSetting(input.feed_url);
// Store encryptedFeedUrl in calendars.feed_url

// In scheduler (before fetch)
const feedUrl = await decryptSetting(calendar.feed_url);
```

### Backward Compatibility
- `settings.icalUrl`:
  - Read during migration v6 (ticket 4.4) to seed first calendar
  - After migration: **never written** by new code
  - Kept in settings table for potential rollback/debugging
  - UI no longer shows/edits `settings.icalUrl` (replaced by Calendars UI)

### Security Considerations
- Same threat model: protect from casual DB inspection
- Machine-bound key (derived from userData path) — not portable across machines
- Future: User-set master password or OS keychain (post-launch)

## Dependencies
- Requires: `phase4-01-calendars-schema` (repository encrypts on create/update)
- Requires: `phase4-04-migration-v6` (migration uses encrypt/decrypt)
- Requires: `phase4-06-scheduler-multi` (scheduler decrypts before fetch)

## Testing
- Unit test: `encryptSetting` → `decryptSetting` round-trip preserves URL
- Unit test: Two calendars with same URL → different ciphertexts (different salt/IV)
- Unit test: Migration v6 decrypts `settings.icalUrl` and re-encrypts to `calendars.feed_url`
- Unit test: Scheduler fetches feed using decrypted URL from calendar

## Related
- `docs/architecture/security.md` — Encryption design
- `phase4-04-migration-v6` — Migration seeding
- `phase4-06-scheduler-multi` — Scheduler usage