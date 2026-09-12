/**
 * dnd.ts Unit Tests
 *
 * Covers tree drag-and-drop helpers: drop-position calculation, validity
 * (circular-reference prevention), position math, and icon defaults.
 */

import type { EntityId } from '@backend/shared/types';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FOLDER_ICON,
  DEFAULT_PAGE_ICON,
  calculateDropPosition,
  calculateNewPosition,
  getPageIcon,
  isValidDropPosition,
} from '../dnd';

const rect = { top: 100, height: 40 } as DOMRect;

// root -> a -> b ; root -> c
const getDescendants = (id: EntityId): EntityId[] =>
  id === ('a' as EntityId) ? [('b' as EntityId)] : [];
const getParent = (id: EntityId): EntityId | null =>
  id === ('b' as EntityId) ? ('a' as EntityId) : null;

describe('calculateDropPosition', () => {
  it('returns before in the top quarter of the row', () => {
    expect(calculateDropPosition({ clientY: 102 }, rect, 0, 0)).toBe('before');
  });

  it('returns inside in the middle band (nest target)', () => {
    expect(calculateDropPosition({ clientY: 120 }, rect, 0, 0)).toBe('inside');
  });

  it('returns after in the bottom quarter of the row', () => {
    expect(calculateDropPosition({ clientY: 138 }, rect, 0, 0)).toBe('after');
  });

  it('forces inside when dragging from a shallower depth than the target', () => {
    // Pointer is in the top quarter, but dragDepth < targetDepth.
    expect(calculateDropPosition({ clientY: 102 }, rect, 2, 0)).toBe('inside');
  });
});

describe('isValidDropPosition', () => {
  it('rejects dropping a page onto itself', () => {
    expect(
      isValidDropPosition('a' as EntityId, 'a' as EntityId, 'inside', getDescendants, getParent),
    ).toBe(false);
  });

  it('rejects dropping a page into its own descendant', () => {
    expect(
      isValidDropPosition('a' as EntityId, 'b' as EntityId, 'inside', getDescendants, getParent),
    ).toBe(false);
  });

  it('allows nesting a page onto an unrelated page', () => {
    expect(
      isValidDropPosition('c' as EntityId, 'a' as EntityId, 'inside', getDescendants, getParent),
    ).toBe(true);
  });

  it('allows reordering as a sibling of an unrelated page', () => {
    expect(
      isValidDropPosition('c' as EntityId, 'a' as EntityId, 'before', getDescendants, getParent),
    ).toBe(true);
  });

  it('rejects a before/after drop adjacent to one of its descendants', () => {
    // Dropping "a" before/after its child "b" would nest it under itself.
    expect(
      isValidDropPosition('a' as EntityId, 'b' as EntityId, 'before', getDescendants, getParent),
    ).toBe(false);
  });
});

describe('calculateNewPosition', () => {
  it('returns the target index for before', () => {
    expect(calculateNewPosition('before', 3, 10)).toBe(3);
  });

  it('returns target index + 1 for after', () => {
    expect(calculateNewPosition('after', 3, 10)).toBe(4);
  });

  it('returns 0 for inside (first child)', () => {
    expect(calculateNewPosition('inside', 3, 10)).toBe(0);
  });
});

describe('getPageIcon', () => {
  it('returns the page icon when set', () => {
    expect(getPageIcon({ icon: '📚' })).toBe('📚');
  });

  it('returns the folder icon for a page with children and no icon', () => {
    expect(getPageIcon({ icon: null, children: [{}] })).toBe(DEFAULT_FOLDER_ICON);
  });

  it('returns the default page icon for a leaf page with no icon', () => {
    expect(getPageIcon({ icon: null })).toBe(DEFAULT_PAGE_ICON);
  });
});
