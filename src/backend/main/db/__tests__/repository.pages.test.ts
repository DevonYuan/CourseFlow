/**
 * Page Repository Tests
 *
 * Covers the Notes-workspace page data layer: creation, tree assembly, and the
 * LIKE-based `searchPages` implementation (used instead of FTS5 because the
 * sql.js WASM build has no `fts5` module).
 *
 * @module @backend/main/db/__tests__/repository.pages
 */

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { repo } from '../repository.js';

// The repository reads the database and emits events through these modules.
// Inject a test database and a spy so the real repository logic runs in isolation.
const mockState = vi.hoisted(() => ({
  db: null as unknown,
  sendEventToRenderers: vi.fn(),
}));

vi.mock('../connection.js', () => ({
  getDatabase: () => mockState.db,
  saveDatabase: () => {},
}));

vi.mock('../../events.js', () => ({
  sendEventToRenderers: mockState.sendEventToRenderers,
}));

let testDb: Database | null = null;

async function initTestDb(): Promise<Database> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const wasmPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm',
  );
  const wasmBuffer = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(wasmBuffer).buffer });
  return new SQL.Database();
}

function createSchema(db: Database): void {
  db.exec(`
    CREATE TABLE pages (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT,
      icon TEXT,
      cover TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT
    );
  `);
}

beforeAll(async () => {
  testDb = await initTestDb();
  createSchema(testDb);
});

beforeEach(() => {
  testDb!.exec('DELETE FROM pages');
  mockState.db = testDb;
});

afterAll(() => {
  testDb?.close();
  testDb = null;
});

describe('Page Repository', () => {
  it('creates pages and assembles the tree', () => {
    const root = repo.createPage({ title: 'Root', icon: '📚' });
    repo.createPage({ parentId: root.id, title: 'Child' });

    const tree = repo.getPageTree();
    expect(tree.length).toBe(1);
    expect(tree[0]!.page.title).toBe('Root');
    expect(tree[0]!.children[0]!.page.title).toBe('Child');
  });

  it('keeps sibling order when moving a page', () => {
    const a = repo.createPage({ title: 'A' });
    const b = repo.createPage({ title: 'B' });
    const c = repo.createPage({ title: 'C' });

    repo.movePage(c.id, null, 0);

    const titles = repo.listPages().map((p) => p.title);
    expect(titles).toEqual(['C', 'A', 'B']);
    expect(repo.getPage(a.id)?.title).toBe('A');
    expect(repo.getPage(b.id)?.title).toBe('B');
  });

  it('searches titles and content, ranking title matches first', () => {
    repo.createPage({ title: 'Algebra Notes', content: 'quadratic formula' });
    repo.createPage({ title: 'History', content: 'The algebra of revolution' });
    repo.createPage({ title: 'Unrelated', content: 'nothing here' });

    const results = repo.searchPages('algebra');
    expect(results.length).toBe(2);
    expect(results[0]!.page.title).toBe('Algebra Notes');
    expect(results[0]!.rank).toBe(0);
    expect(results[1]!.page.title).toBe('History');
    expect(results[1]!.rank).toBe(1);
  });

  it('returns a highlighted snippet around the match', () => {
    repo.createPage({ title: 'Algebra Notes' });

    const [result] = repo.searchPages('algebra');
    expect(result?.snippet).toContain('<mark>Algebra</mark>');
  });

  it('matches content when the title does not match', () => {
    repo.createPage({ title: 'History', content: 'The quadratic formula' });

    const results = repo.searchPages('quadratic');
    expect(results.length).toBe(1);
    expect(results[0]!.rank).toBe(1);
    expect(results[0]!.snippet).toContain('<mark>quadratic</mark>');
  });

  it('treats LIKE wildcards as literal characters', () => {
    repo.createPage({ title: '100% Complete' });
    repo.createPage({ title: 'Unrelated' });

    // "%" and "_" must not behave as wildcards.
    expect(repo.searchPages('%').length).toBe(1);
    expect(repo.searchPages('_').length).toBe(0);
    expect(repo.searchPages('100%').length).toBe(1);
  });

  it('returns no results for a blank query', () => {
    repo.createPage({ title: 'Anything' });
    expect(repo.searchPages('   ')).toEqual([]);
  });
});
