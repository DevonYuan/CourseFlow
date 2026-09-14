/**
 * Sanitization Utilities Tests
 *
 * Guards the allow-list used when rendering HTML: search snippets rely on
 * `<mark>` tags surviving sanitization, while script content must still be
 * stripped.
 */

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { createSafeHtml, sanitizeHtml } from '../sanitize';

describe('sanitizeHtml', () => {
  it('preserves <mark> highlight tags used by search snippets', () => {
    const clean = sanitizeHtml('the <mark>Variables</mark> chapter');

    // XMLSerializer adds an xmlns attribute, so match the opening tag loosely.
    expect(clean).toContain('<mark');
    expect(clean).toContain('>Variables</mark>');
    expect(createSafeHtml('the <mark>Variables</mark> chapter').__html).toContain('<mark');
  });

  it('strips script tags from untrusted HTML', () => {
    const clean = sanitizeHtml('<p>safe</p><script>alert(1)</script>');

    expect(clean).toContain('safe');
    expect(clean).not.toContain('<script');
  });

  it('returns an empty string for blank input', () => {
    expect(sanitizeHtml('   ')).toBe('');
    expect(createSafeHtml('')).toEqual({ __html: '' });
  });
});
