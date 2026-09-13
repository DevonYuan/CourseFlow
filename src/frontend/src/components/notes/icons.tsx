/**
 * Notes — Inline SVG Icons
 *
 * Lightweight, stroke-based icons matching the CourseFlow aesthetic
 * (stroke="currentColor", strokeWidth=1.5, round caps/joins). Kept local to
 * the notes feature to avoid pulling in an icon library.
 *
 * @module @frontend/components/notes/icons
 */

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function withStroke(
  Wrapped: (props: { size: number }) => React.ReactElement,
): (props: IconProps) => React.ReactElement {
  return function Icon({ size = 16, className }: IconProps): React.ReactElement {
    return (
      <span className={className} aria-hidden="true">
        {Wrapped({ size })}
      </span>
    );
  };
}

/** Document / page icon */
export const PageIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M5.5 1.5h4l3 3v8a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 12.5v-9.5A1.5 1.5 0 0 1 5.5 1.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 1.5v3h3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M6 8.5h4M6 11h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
));

/** Folder icon */
export const FolderIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.2l1.3 2h5.5A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
));

/** Pen / "write" icon (markdown editing) */
export const WriteIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M11.2 2.3a1.2 1.2 0 0 1 1.7 1.7l-6.7 6.7-2.4.7.7-2.4 6.7-6.7Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M3.5 13.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
));

/** Magnifier / search icon */
export const SearchIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="m10.2 10.2 3 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
));

/** Link icon (wiki-style links, insert link) */
export const LinkIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M6.5 8.5a3 3 0 0 0 4.2 0l2-2a3 3 0 1 0-4.2-4.2l-.6.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 7.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 1 0 4.2 4.2l.6-.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

/** Plus icon */
export const PlusIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M8 3.5v9M3.5 8h9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
));

/** Pencil / rename icon */
export const RenameIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M11.2 2.3a1.2 1.2 0 0 1 1.7 1.7l-6.7 6.7-2.6.5.5-2.6 6.7-6.7Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

/** Copy / duplicate icon */
export const DuplicateIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect
      x="5.5"
      y="5.5"
      width="7"
      height="7"
      rx="1.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M10.5 2h-5A1.5 1.5 0 0 0 4 3.5v6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
));

/** Trash / delete icon */
export const DeleteIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M4 5l.6 6.9a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4L12 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 5h10M6.5 5V3.5A1 1 0 0 1 7.5 2.5h1a1 1 0 0 1 1 1V5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
));

/** Warning / alert icon */
export const AlertIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M8 2.25 14.5 13.75H1.5L8 2.25Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M8 6.5v3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="8" cy="11.4" r="0.6" fill="currentColor" />
  </svg>
));

/** Clipboard / note icon (used for the welcome hero + empty state) */
export const NoteIcon = withStroke(({ size }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M5 2.75A1.25 1.25 0 0 1 6.25 1.5h3.5A1.25 1.25 0 0 1 11 2.75v.25A1.5 1.5 0 0 1 9.5 4.5h-3A1.5 1.5 0 0 1 5 3V2.75Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M5 3H4.5A1.5 1.5 0 0 0 3 4.5v7A2 2 0 0 0 5 13.5h6a2 2 0 0 0 2-2v-7A1.5 1.5 0 0 0 11.5 3H11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
));