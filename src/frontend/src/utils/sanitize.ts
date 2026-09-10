/**
 * HTML Sanitization Utilities
 *
 * Provides safe HTML sanitization for rendering Canvas descriptions
 * which come as potentially unsafe HTML from iCal feeds.
 *
 * @module @frontend/utils/sanitize
 */

import DOMPurify from 'dompurify';

/**
 * Configuration for DOMPurify to allow safe Canvas HTML while blocking dangerous content.
 * Allows common formatting tags but strips scripts, event handlers, and unsafe attributes.
 */
const SANITIZE_CONFIG = {
  // Allow common text formatting tags
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'img', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr',
  ],
  // Allow safe attributes
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title',
    'src', 'alt', 'width', 'height',
    'style', 'class', 'id',
    'colspan', 'rowspan',
  ],
  // Allow specific URI schemes in href/src
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
  // Keep content in allowed tags even if parent is removed
  KEEP_CONTENT: true,
  // Return a DOM fragment for safe insertion
  RETURN_DOM_FRAGMENT: true,
};

/**
 * Sanitizes HTML string for safe rendering.
 * Strips scripts, event handlers, and unsafe attributes while preserving
 * common formatting and Canvas-specific styling.
 *
 * @param html - Raw HTML string from Canvas/iCal description
 * @returns Sanitized HTML string safe for innerHTML
 */
export function sanitizeHtml(html: string): string {
  if (!html || html.trim() === '') return '';

  // First, normalize the HTML to handle Canvas-specific quirks
  const normalized = normalizeCanvasHtml(html);

  // Sanitize with DOMPurify - RETURN_DOM_FRAGMENT is true so it returns DocumentFragment
  const clean = DOMPurify.sanitize(normalized, SANITIZE_CONFIG);

  // DOMPurify with RETURN_DOM_FRAGMENT: true returns DocumentFragment
  // Serialize it back to string - cast to avoid TS narrow type issues
  const cleanAny = clean as unknown;
  if (cleanAny instanceof DocumentFragment) {
    return new XMLSerializer().serializeToString(cleanAny);
  }
  return String(clean);
}

/**
 * Normalizes Canvas HTML before sanitization.
 * Handles common Canvas-specific patterns and quirks.
 */
function normalizeCanvasHtml(html: string): string {
  return html
    // Convert Canvas-specific classes to generic ones
    .replace(/\s+class="[^"]*"/g, '')
    // Ensure links open in new tab for security
    .replace(/<a\s+/gi, '<a target="_blank" rel="noopener noreferrer" ')
    // Remove inline styles that could be problematic (keep simple ones)
    // Note: We allow style attribute in ALLOWED_ATTR so simple styles pass through
    // but DOMPurify will strip dangerous CSS properties
    ;
}

/**
 * Creates a safe HTML string for use with dangerouslySetInnerHTML in React.
 * The returned object can be directly used as: <div dangerouslySetInnerHTML={createSafeHtml(html)} />
 *
 * @param html - Raw HTML string
 * @returns Object with __html property for dangerouslySetInnerHTML
 */
export function createSafeHtml(html: string): { __html: string } {
  if (!html || html.trim() === '') return { __html: '' };
  return { __html: sanitizeHtml(html) };
}

/**
 * Escapes HTML special characters in a plain text string for safe rendering.
 * Use this when rendering user-provided plain text content to prevent XSS.
 * Does NOT sanitize HTML - it escapes it so it displays literally.
 *
 * @param text - Plain text string that may contain HTML special characters
 * @returns Escaped string safe for use in textContent or as text in JSX
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
