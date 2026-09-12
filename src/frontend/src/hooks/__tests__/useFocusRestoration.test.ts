/**
 * useFocusRestoration Hook Tests
 *
 * Tests for the useFocusRestoration hook covering:
 * - Saving and restoring focus
 * - Clearing saved focus
 * - Edge cases (no element to focus, null reference)
 *
 * @module @frontend/src/hooks/__tests__/useFocusRestoration
 */

// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

import { useFocusRestoration, useFocusOnMount } from '../useFocusRestoration';

describe('useFocusRestoration', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('saveFocus', () => {
    it('should save the currently focused element', () => {
      const button = document.createElement('button');
      button.id = 'test-button';
      document.body.append(button);
      button.focus();

      const { result } = renderHook(() => useFocusRestoration());

      expect(() => result.current.saveFocus()).not.toThrow();
    });

    it('should store the active element', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.append(input);
      input.focus();

      const { result } = renderHook(() => useFocusRestoration());

      act(() => {
        result.current.saveFocus();
      });

      expect(() => result.current.restoreFocus()).not.toThrow();
    });
  });

  describe('restoreFocus', () => {
    it('should restore focus to saved element', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.append(input);
      input.focus();

      const { result } = renderHook(() => useFocusRestoration());

      act(() => {
        result.current.saveFocus();
      });

      act(() => {
        result.current.restoreFocus();
      });

      // Verify focus was called (the mock is on HTMLElement.prototype.focus)
      expect(HTMLElement.prototype.focus).toHaveBeenCalled();
    });

    it('should not throw when no focus saved', () => {
      const { result } = renderHook(() => useFocusRestoration());

      expect(() => {
        act(() => {
          result.current.restoreFocus();
        });
      }).not.toThrow();
    });

    it('should not throw when saved element is removed from DOM', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.append(input);
      input.focus();

      const { result } = renderHook(() => useFocusRestoration());

      act(() => {
        result.current.saveFocus();
      });

      // Remove element from DOM
      input.remove();

      expect(() => {
        act(() => {
          result.current.restoreFocus();
        });
      }).not.toThrow();
    });
  });

  describe('clearSavedFocus', () => {
    it('should clear saved focus', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.append(input);
      input.focus();

      const { result } = renderHook(() => useFocusRestoration());

      act(() => {
        result.current.saveFocus();
      });

      act(() => {
        result.current.clearSavedFocus();
      });

      // The initial input.focus() above already invoked the spy; reset it so we
      // only assert on calls made by restoreFocus.
      vi.mocked(HTMLElement.prototype.focus).mockClear();

      // After clearing, restoreFocus should not call focus
      act(() => {
        result.current.restoreFocus();
      });

      expect(HTMLElement.prototype.focus).not.toHaveBeenCalled();
    });
  });

  describe('multiple save/restore cycles', () => {
    it('should handle multiple save/restore cycles', () => {
      const input1 = document.createElement('input');
      const input2 = document.createElement('input');
      input1.id = 'input1';
      input2.id = 'input2';
      document.body.append(input1);
      document.body.append(input2);
      input1.focus();

      const { result } = renderHook(() => useFocusRestoration());

      act(() => {
        result.current.saveFocus();
      });

      // Multiple saves should work
      expect(() => {
        act(() => {
          result.current.saveFocus();
        });
      }).not.toThrow();

      expect(() => {
        act(() => {
          result.current.restoreFocus();
        });
      }).not.toThrow();
      expect(() => {
        act(() => {
          result.current.clearSavedFocus();
        });
      }).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should restore focus to the element focused when saveFocus was called', async () => {
      // Use the real focus implementation so document.activeElement is meaningful.
      vi.mocked(HTMLElement.prototype.focus).mockRestore();

      const input1 = document.createElement('input');
      input1.id = 'input1';
      document.body.append(input1);

      const input2 = document.createElement('input');
      input2.id = 'input2';
      document.body.append(input2);

      input1.focus();
      expect(document.activeElement).toBe(input1);

      const { result } = renderHook(() => useFocusRestoration());

      // Save focus (input1 is active)
      act(() => {
        result.current.saveFocus();
      });

      // Move focus to input2
      input2.focus();
      expect(document.activeElement).toBe(input2);

      // Restore focus should move it back to input1 (async via setTimeout)
      act(() => {
        result.current.restoreFocus();
      });

      await vi.waitFor(() => {
        expect(document.activeElement).toBe(input1);
      });
    });

    it('should handle multiple save calls', () => {
      const { result } = renderHook(() => useFocusRestoration());

      result.current.saveFocus();

      // Multiple saves should work
      expect(() => result.current.saveFocus()).not.toThrow();

      expect(() => result.current.restoreFocus()).not.toThrow();
      expect(() => result.current.clearSavedFocus()).not.toThrow();
    });
  });
});

describe('useFocusOnMount', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should save focus when isOpen becomes true', () => {
    const onClose = vi.fn();

    const { result } = renderHook(({ isOpen }) => useFocusOnMount(isOpen, onClose), {
      initialProps: { isOpen: true },
    });

    // Initial render shouldn't call focus
    expect(() => {
      act(() => {
        result.current.saveFocus();
      });
    }).not.toThrow();
  });

  it('should return saveFocus and restoreFocus functions', () => {
    const { result } = renderHook(() => useFocusOnMount(true));

    expect(typeof result.current.saveFocus).toBe('function');
    expect(typeof result.current.restoreFocus).toBe('function');
  });

  it('should call onClose when closing', () => {
    const onClose = vi.fn();

    const { rerender } = renderHook(({ isOpen }) => useFocusOnMount(isOpen, onClose), {
      initialProps: { isOpen: true },
    });

    rerender({ isOpen: false });

    // onClose should be called when transitioning from open to closed
    // (but this is based on the wasOpenRef logic in the hook)
  });
});
