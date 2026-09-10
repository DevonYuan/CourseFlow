/**
 * escapeHtml Utility Tests
 */

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { escapeHtml } from '../utils/sanitize';

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;) &amp; &#039;y&#039;&lt;/script&gt;',
    );
  });

  it('returns an empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});
