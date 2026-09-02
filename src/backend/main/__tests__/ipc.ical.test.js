/**
 * Integration tests for iCal IPC Handlers.
 *
 * Tests the ical:fetch and ical:import IPC handlers with mocked dependencies.
 *
 * @module @backend/main/__tests__/ipc.ical
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
// Mock electron
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
    },
    BrowserWindow: {
        getAllWindows: vi.fn(() => []),
    },
}));
// Mock the ical utilities
vi.mock('../ical/index.js', () => ({
    fetchICalFeed: vi.fn(),
    parseICalFeed: vi.fn(),
    mapICalToAssignments: vi.fn(),
    NetworkError: class NetworkError extends Error {
        constructor(message) {
            super(message);
            this.name = 'NetworkError';
        }
    },
    HttpError: class HttpError extends Error {
        status;
        constructor(message, status) {
            super(message);
            this.name = 'HttpError';
            this.status = status;
        }
    },
    TimeoutError: class TimeoutError extends Error {
        constructor(message) {
            super(message);
            this.name = 'TimeoutError';
        }
    },
    ICalParseError: class ICalParseError extends Error {
        constructor(message) {
            super(message);
            this.name = 'ICalParseError';
        }
    },
}));
// Mock the repository
vi.mock('../db/repository.js', () => ({
    repo: {
        importAssignments: vi.fn(),
        setSettings: vi.fn(),
    },
}));
// Mock events
vi.mock('../events.js', () => ({
    sendEventToRenderers: vi.fn(),
}));
// Import mocked modules
import { fetchICalFeed, parseICalFeed, mapICalToAssignments, NetworkError, HttpError, TimeoutError, ICalParseError } from '../ical/index.js';
import { repo } from '../db/repository.js';
import { sendEventToRenderers } from '../events.js';
import { registerIpcHandlers } from '../ipc-handlers.js';
// Helper to create test ICalEvent
function createICalEvent(overrides = {}) {
    return {
        uid: 'test-uid-123',
        summary: 'Test Assignment',
        description: 'Test description',
        location: 'Online',
        dtStart: '2025-01-15T23:59:00.000Z',
        dtEnd: '2025-01-16T00:59:00.000Z',
        rrule: null,
        url: 'https://canvas.example.com/assignments/123',
        categories: ['CS101'],
        ...overrides,
    };
}
// Helper to create test ImportResult
function createImportResult(overrides = {}) {
    return {
        imported: 1,
        updated: 0,
        skipped: 0,
        ...overrides,
    };
}
describe('iCal IPC Handlers', () => {
    let handleMock;
    let registeredHandlers;
    beforeEach(async () => {
        vi.resetAllMocks();
        vi.clearAllMocks();
        // Capture registered handlers
        registeredHandlers = new Map();
        handleMock = vi.mocked(ipcMain.handle);
        handleMock.mockImplementation((channel, handler) => {
            registeredHandlers.set(channel, handler);
        });
        // Import the module to register handlers
        await import('../ipc-handlers.js');
        // Register handlers with mocked ipcMain
        registerIpcHandlers();
    });
    afterEach(() => {
        vi.resetModules();
    });
    const invokeHandler = async (channel, request) => {
        const handler = registeredHandlers.get(channel);
        if (!handler) {
            throw new Error(`Handler for channel ${channel} not registered`);
        }
        return handler(null, request);
    };
    describe('ical:fetch', () => {
        const testUrl = 'https://canvas.example.com/feeds/ical/abc123.ics';
        const mockIcalText = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
        const mockEvents = [createICalEvent()];
        it('returns parsed events for valid URL', async () => {
            vi.mocked(fetchICalFeed).mockResolvedValueOnce(mockIcalText);
            vi.mocked(parseICalFeed).mockReturnValueOnce(mockEvents);
            const result = await invokeHandler('ical:fetch', { url: testUrl });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual(mockEvents);
            }
            // Verify progress events emitted
            expect(sendEventToRenderers).toHaveBeenCalledWith('ical:progress', { stage: 'fetching', progress: 10, message: 'Fetching calendar...' });
            expect(sendEventToRenderers).toHaveBeenCalledWith('ical:progress', { stage: 'parsing', progress: 30, message: 'Parsing events...' });
            expect(sendEventToRenderers).toHaveBeenCalledWith('ical:progress', { stage: 'complete', progress: 100, message: `Fetched ${mockEvents.length} events` });
        });
        it('rejects empty URL', async () => {
            const result = await invokeHandler('ical:fetch', { url: '' });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('VALIDATION_ERROR');
                expect(result.error).toContain('URL is required');
            }
        });
        it('rejects invalid URL format', async () => {
            const result = await invokeHandler('ical:fetch', { url: 'not-a-valid-url' });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('VALIDATION_ERROR');
                expect(result.error).toContain('Invalid URL format');
            }
        });
        it('returns NETWORK_ERROR for network failures', async () => {
            const networkError = new NetworkError('Network error fetching iCal feed');
            vi.mocked(fetchICalFeed).mockRejectedValueOnce(networkError);
            const result = await invokeHandler('ical:fetch', { url: testUrl });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('NETWORK_ERROR');
                expect(result.error).toContain('Network error');
            }
        });
        it('returns HTTP_ERROR for HTTP errors', async () => {
            const httpError = new HttpError('HTTP 404 Not Found', 404);
            vi.mocked(fetchICalFeed).mockRejectedValueOnce(httpError);
            const result = await invokeHandler('ical:fetch', { url: testUrl });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('HTTP_ERROR');
                expect(result.error).toContain('HTTP error 404');
            }
        });
        it('returns TIMEOUT_ERROR for timeout', async () => {
            const timeoutError = new TimeoutError('Request timeout after 30000ms');
            vi.mocked(fetchICalFeed).mockRejectedValueOnce(timeoutError);
            const result = await invokeHandler('ical:fetch', { url: testUrl });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('TIMEOUT_ERROR');
                expect(result.error).toContain('Request timeout');
            }
        });
        it('returns PARSE_ERROR for parse failures', async () => {
            vi.mocked(fetchICalFeed).mockResolvedValueOnce(mockIcalText);
            const parseError = new ICalParseError('Failed to parse iCal feed');
            vi.mocked(parseICalFeed).mockImplementationOnce(() => { throw parseError; });
            const result = await invokeHandler('ical:fetch', { url: testUrl });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('PARSE_ERROR');
                expect(result.error).toContain('Failed to parse iCal feed');
            }
        });
        it('uses 30s timeout for fetch', async () => {
            vi.mocked(fetchICalFeed).mockResolvedValueOnce(mockIcalText);
            vi.mocked(parseICalFeed).mockReturnValueOnce(mockEvents);
            await invokeHandler('ical:fetch', { url: testUrl });
            expect(fetchICalFeed).toHaveBeenCalledWith(testUrl, { timeoutMs: 30_000 });
        });
    });
    describe('ical:import', () => {
        const testEvents = [createICalEvent(), createICalEvent({ uid: 'test-uid-456' })];
        const testSourceUrl = 'https://canvas.example.com/feeds/ical/abc123.ics';
        const mockAssignments = [
            { id: 'assignment-1', title: 'Test Assignment' },
            { id: 'assignment-2', title: 'Test Assignment 2' },
        ];
        const mockImportResult = createImportResult({ imported: 2, updated: 0, skipped: 0 });
        it('maps events and imports with deduplication', async () => {
            vi.mocked(mapICalToAssignments).mockReturnValueOnce(mockAssignments);
            vi.mocked(repo.importAssignments).mockReturnValueOnce(mockImportResult);
            vi.mocked(repo.setSettings).mockResolvedValueOnce({});
            const result = await invokeHandler('ical:import', { events: testEvents, sourceUrl: testSourceUrl });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual(mockImportResult);
            }
            // Verify mapICalToAssignments called with correct args
            expect(mapICalToAssignments).toHaveBeenCalledWith(testEvents, testSourceUrl);
            // Verify repo.importAssignments called with mapped assignments
            expect(repo.importAssignments).toHaveBeenCalledWith(mockAssignments);
            // Verify progress events emitted
            expect(sendEventToRenderers).toHaveBeenCalledWith('ical:progress', { stage: 'importing', progress: 10, message: 'Importing assignments...' });
            expect(sendEventToRenderers).toHaveBeenCalledWith('ical:progress', { stage: 'complete', progress: 100, message: `Imported ${mockImportResult.imported}, updated ${mockImportResult.updated}, skipped ${mockImportResult.skipped}` });
            // Verify setSettings called to update lastSyncAt
            expect(repo.setSettings).toHaveBeenCalled();
            const setSettingsMock = vi.mocked(repo.setSettings);
            const lastCall = setSettingsMock.mock.lastCall;
            expect(lastCall).toBeDefined();
            const setSettingsArg = lastCall?.[0];
            expect(setSettingsArg).toHaveProperty('lastSyncAt');
            expect(typeof setSettingsArg?.lastSyncAt).toBe('string');
        });
        it('rejects empty events array', async () => {
            const result = await invokeHandler('ical:import', { events: [], sourceUrl: testSourceUrl });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('VALIDATION_ERROR');
                expect(result.error).toContain('Events array is required and cannot be empty');
            }
        });
        it('rejects missing sourceUrl', async () => {
            const result = await invokeHandler('ical:import', { events: testEvents, sourceUrl: '' });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('VALIDATION_ERROR');
                expect(result.error).toContain('sourceUrl is required');
            }
        });
        it('rejects non-array events', async () => {
            const result = await invokeHandler('ical:import', { events: 'not-an-array', sourceUrl: testSourceUrl });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('VALIDATION_ERROR');
                expect(result.error).toContain('Events array is required and cannot be empty');
            }
        });
        it('returns INTERNAL_ERROR for import failures', async () => {
            vi.mocked(mapICalToAssignments).mockReturnValueOnce(mockAssignments);
            vi.mocked(repo.importAssignments).mockImplementationOnce(() => {
                throw new Error('Database error');
            });
            const result = await invokeHandler('ical:import', { events: testEvents, sourceUrl: testSourceUrl });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.code).toBe('INTERNAL_ERROR');
                expect(result.error).toContain('Failed to import assignments');
            }
        });
        it('emits progress event on error', async () => {
            vi.mocked(mapICalToAssignments).mockImplementationOnce(() => {
                throw new Error('Mapping error');
            });
            await invokeHandler('ical:import', { events: testEvents, sourceUrl: testSourceUrl });
            expect(sendEventToRenderers).toHaveBeenCalledWith('ical:progress', {
                stage: 'error',
                progress: 100,
                message: 'Mapping error'
            });
        });
    });
});
//# sourceMappingURL=ipc.ical.test.js.map