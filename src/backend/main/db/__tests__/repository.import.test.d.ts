/**
 * Import Assignments Deduplication Tests
 *
 * Tests the importAssignments method with various conflict scenarios:
 * - New ical_uid → INSERT (imported)
 * - Existing ical_uid, newer updatedAt → UPDATE (updated)
 * - Existing ical_uid, older/equal updatedAt → SKIP (skipped)
 * - Protected fields preserved on UPDATE (description, status=completed, priority)
 * - Transactional behavior (rollback on error)
 * - db:changed events emitted
 *
 * @module @backend/main/db/__tests__/repository.import
 */
export {};
//# sourceMappingURL=repository.import.test.d.ts.map