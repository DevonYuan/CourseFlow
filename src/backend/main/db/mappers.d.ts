/**
 * Database Mappers — Pure Functions
 *
 * Type-safe conversions between database rows (snake_case) and domain objects (camelCase).
 * Zero dependencies — no I/O, no Electron, no Node. Safe to import in any environment.
 *
 * @module @backend/main/db/mappers
 */
import type { Assignment, AssignmentInput, SubTask, SubTaskInput, Settings, DbAssignment, DbSubTask, DbSettings } from '../../shared/types.js';
/**
 * Convert Unix milliseconds to ISO 8601 UTC string.
 */
export declare function toIsoDateTime(ms: number): string;
/**
 * Convert ISO 8601 string to Unix milliseconds (or null).
 */
export declare function toUnixMs(iso: string | null | undefined): number | null;
/**
 * Map database row to Assignment domain object.
 */
export declare function mapDbAssignmentToAssignment(row: DbAssignment): Assignment;
/**
 * Map AssignmentInput to database row format for upsert.
 * Only includes fields that are defined in the input.
 */
export declare function mapAssignmentInputToDb(input: AssignmentInput, now: number): Partial<DbAssignment>;
export declare function mapDbSubTaskToSubTask(row: DbSubTask): SubTask;
export declare function mapSubTaskInputToDb(input: SubTaskInput, now: number): DbSubTask;
export declare function mapDbSettingsToSettings(rows: DbSettings[]): Settings;
//# sourceMappingURL=mappers.d.ts.map