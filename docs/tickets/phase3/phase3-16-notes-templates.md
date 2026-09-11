---
applyTo: 'docs/tickets/phase3/phase3-16-notes-templates.md'
issue: 'N/A'
---

# phase3-16-notes-templates — Page Templates

## Description

Add a **template system** for the Notes workspace. When creating a new page (via sidebar or wiki-link), users can choose from pre-built templates (Class Notes, Meeting Notes, Project Plan, Daily Journal) or their own saved custom templates. Templates pre-fill the page content, title pattern, and icon.

**Prerequisites**: Ticket 3.11 (Pages Schema & IPC), Ticket 3.12 (Notes Sidebar), Ticket 3.13 (Markdown Editor). Templates integrate with the page creation flow.

## Requirements

> Document WHAT is needed and WHY it is needed.

- [ ] **Built-in templates**: Ship 4-5 default templates (read-only, not user-editable):
  - **Class Notes** — Structured with date, topic, key points, action items, questions sections
  - **Meeting Notes** — Attendees, agenda, decisions, action items (with assignees), next steps
  - **Project Plan** — Overview, goals, milestones, tasks (with checkboxes), resources, risks
  - **Daily Journal** — Date header, gratitude, priorities, reflection, tomorrow's focus
  - **Blank** — Empty page (default)
- [ ] **Template picker**: When creating a new page (sidebar "New page" or wiki-link "Create page"), show a modal/dropdown to select a template before creating.
  - Sidebar: "New page" → opens template picker → on select, creates page with template content → navigates to editor.
  - Wiki-link "Create page 'Title'" → uses "Blank" template by default, or shows picker if Shift+Enter.
- [ ] **Custom templates (user-created)**:
  - "Save as template" action in editor (toolbar or page menu) → prompts for template name → saves current page content as a user template.
  - User templates stored in a new `templates` table (or `settings` with key `user_templates` JSON array).
  - Template picker shows built-in + user templates in separate sections.
  - User can edit/delete their templates (manage templates modal).
- [ ] **Template variables**: Support placeholders in templates that auto-fill on creation:
  - `{{date}}` → today's date (YYYY-MM-DD)
  - `{{time}}` → current time (HH:mm)
  - `{{datetime}}` → ISO datetime
  - `{{title}}` → the page title being created (from wiki-link or rename)
  - `{{weekday}}`, `{{month}}`, `{{year}}` — date parts
- [ ] **Template structure**: A template defines:
  - `id` (UUID)
  - `name` (display name)
  - `description` (short)
  - `icon` (emoji for picker)
  - `content` (Markdown with variables)
  - `isBuiltIn` (boolean)
  - `createdAt`, `updatedAt`
- [ ] **Keyboard shortcut**: `Ctrl+Shift+N` (or `Cmd+Shift+N`) in Notes workspace → opens template picker for new page.

## Designs & Constraints

> Any non-obvious designs or constraints to the design that MUST be followed.

- [ ] **Storage for user templates**: Use `settings` table with key `user_templates` (JSON array of template objects). Simpler than new table for MVP. Built-in templates defined in code (TypeScript constant).
- [ ] **Template application**: When creating page from template:
  1. Resolve variables in template content (`{{date}}` → today, `{{title}}` → provided title)
  2. Call `db:pages:create` with resolved content, title, icon from template
  3. Navigate to editor
- [ ] **Built-in templates in code**: Define in `src/frontend/src/templates/builtinTemplates.ts` as a constant array. Easy to update, no DB migration needed.
- [ ] **Template picker UI**: Modal with grid/list of template cards showing icon, name, description. Click to select. Search/filter if many user templates.
- [ ] **Variable substitution**: Simple string replace. `content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '')`.
- [ ] **No template sync**: Templates are local-only (like all data). No cloud sync in MVP.
- [ ] **Accessibility**: Template picker is a modal dialog (`role="dialog"`, focus trap, Escape to close). Keyboard navigable.

## Code Changes

> List any source code files that need changes and describe the required changes.

### Frontend (Renderer)

| File                                                         | Change                                                                                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/templates/builtinTemplates.ts`             | **New file**. Constant array of built-in template objects (id, name, description, icon, content, isBuiltIn: true).                            |
| `src/frontend/src/components/notes/TemplatePickerModal.tsx`  | **New file**. Modal: template grid, search, built-in + user sections, select handler.                                                         |
| `src/frontend/src/components/notes/ManageTemplatesModal.tsx` | **New file**. Modal for user templates: list, edit, delete, "Save current page as template".                                                  |
| `src/frontend/src/hooks/useTemplates.ts`                     | **New file**. Load user templates from `settings:user_templates`, merge with built-in, provide `applyTemplate(template, variables)` function. |
| `src/frontend/src/components/notes/NotesSidebar.tsx`         | Modify "New page" / "New child page" → open TemplatePickerModal instead of direct create.                                                     |
| `src/frontend/src/components/notes/MarkdownEditor.tsx`       | Add "Save as template" button in toolbar/menu → opens ManageTemplatesModal with current page content pre-filled.                              |
| `src/frontend/src/components/notes/WikiLinkAutocomplete.tsx` | On "Create page 'Title'" → open TemplatePickerModal (or use Blank directly for speed).                                                        |
| `src/frontend/src/stores/notesStore.ts`                      | Add `userTemplates` state, actions for save/edit/delete template.                                                                             |
| `src/frontend/src/utils/templateVariables.ts`                | **New file**. `resolveVariables(content: string, variables: Record<string, string>): string`.                                                 |

### Backend (minimal)

| File                               | Change                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/backend/main/ipc-handlers.ts` | Verify `settings:get`/`set` handles `user_templates` key (already generic). No new IPC needed. |

## Acceptance Criteria

> Document the criteria that must be met for the ticket to be considered complete.
> Each criteria will be written as an automated test (e.g., Playwright) if possible.

- [ ] **Built-in templates load**: Template picker shows 5 built-in templates with correct icons, names, descriptions.
- [ ] **Create from template**: Select template → page created with resolved variables → navigates to editor with content pre-filled.
- [ ] **Variables resolve**: `{{date}}`, `{{time}}`, `{{title}}`, `{{weekday}}`, `{{month}}`, `{{year}}` replaced correctly.
- [ ] **Save as template**: In editor, "Save as template" → prompts name → saves to user templates → appears in picker.
- [ ] **User templates persist**: Restart app → user templates still in picker.
- [ ] **Edit/delete user templates**: Manage modal allows renaming, updating content, deleting user templates. Built-in templates cannot be edited/deleted.
- [ ] **Template picker keyboard**: ↑/↓ to navigate, Enter to select, Escape to close. Search filters.
- [ ] **Wiki-link create flow**: `[[New Page]]` → "Create page" → template picker (or Blank) → page created.
- [ ] **Shortcut works**: `Ctrl+Shift+N` in Notes workspace opens template picker.
- [ ] **TypeScript compiles**: `pnpm typecheck` passes.
- [ ] **Lint passes**: `pnpm lint` passes.

## Notes

> Any additional context, risks, or considerations.

- **Built-in template content examples**:
  - **Class Notes**:
    ```markdown
    # {{title}} — {{date}} ({{weekday}})

    ## Topic

    ## Key Points

    -

    ## Action Items

    - [ ]

    ## Questions

    -
    ```
  - **Meeting Notes**:
    ```markdown
    # {{title}} — {{date}} {{time}}

    ## Attendees

    -

    ## Agenda

    1.

    ## Decisions

    -

    ## Action Items

    - [ ] @person:

    ## Next Steps

    -
    ```
  - **Project Plan**:
    ```markdown
    # {{title}}

    ## Overview

    ## Goals

    -

    ## Milestones

    - [ ] Milestone 1 — {{date}}

    ## Tasks

    - [ ] Task 1
    - [ ] Task 2

    ## Resources

    -

    ## Risks

    -
    ```
  - **Daily Journal**:
    ```markdown
    # {{date}} ({{weekday}})

    ## Gratitude

    1.
    2.
    3.

    ## Today's Priorities

    - [ ]
    - [ ]
    - [ ]

    ## Reflection

    ## Tomorrow's Focus

    -
    ```
- **Variable resolution**: Provide `variables = { date: todayISO, time: nowTime, title: pageTitle, weekday: 'Monday', month: 'January', year: '2026', datetime: nowISO }`.
- **User template storage**: `settings.value` for key `user_templates` = JSON array of template objects (without `isBuiltIn` or with `isBuiltIn: false`).
- **Playwright tests**: `src/frontend/test/notes-templates.spec.ts`. Test: picker render, create from template, variable resolution, save/edit/delete user templates, persistence, wiki-link flow, shortcut.
- **Future**: Template categories, sharing templates, community templates, template marketplace (post-launch).

## Release Summary

> Provide a 1-line sentence (~120 characters) for the release notes.

Template system for pages: 5 built-in templates (Class Notes, Meeting, Project, Journal, Blank), custom templates, variable substitution, picker UI.
