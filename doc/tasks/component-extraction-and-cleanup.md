# Task: Component Extraction and Code Cleanup

**Context:** During the two-screen navigation refactor, the main `App.js` grew to ~690 lines. The file bundles the entire app (loading, login, note list, note editor, sync logic, rendering, styles) into a single component. This makes tool-based editing slow and error-prone.

## Goals

### 1. Extract sub-components

Split the monolithic `App.js` into focused, single-responsibility components:

| Component | File | Responsibility |
|-----------|------|----------------|
| `LoadingScreen` | `android/src/components/LoadingScreen.js` | Splash/loading state |
| `LoginScreen` | `android/src/components/LoginScreen.js` | Login/register form, auth state |
| `NoteListScreen` | `android/src/components/NoteListScreen.js` | Header, search bar, FlatList of notes, FAB |
| `NoteEditorScreen` | `android/src/components/NoteEditorScreen.js` | Back button, title/content inputs, toolbar, stats |
| `NoteItem` | `android/src/components/NoteItem.js` | Single note row rendering (icon, title, preview, date) |

### 2. Extract shared styles

Pull common styles (colors, typography, spacing) into a dedicated file:

- `android/src/constants/theme.js` — `COLORS`, `FONTS`, `SPACING` objects

### 3. Remove dead code

- Remove unused imports from `App.js` (e.g., `ScrollView` may be unused in post-login screens)
- Remove style keys that are no longer referenced (old `noteItemActive`, `noteItemTextActive`, `newNoteBtn`, `editorContainer`, `contentInput`, etc. were already removed, but verify)
- Remove the `currentNote` derived variable pattern if replaced by `openNote()` flow

### 4. Clean up state management

- Move `currentNoteId`, `title`, `content` state management into a custom hook (`useNoteEditor.js`)
- Move sync-related state into `useSync.js`
- Move auth state into `useAuth.js`

## Acceptance Criteria

- [ ] `App.js` is < 100 lines, acting only as a router/provider
- [ ] Each extracted component is < 200 lines
- [ ] No unused imports or style keys remain
- [ ] App functions identically before and after extraction
- [ ] Tests pass (manual: create, edit, delete, sync, login/logout)

## Priority: Medium

This is a quality-of-life improvement for future development, not a user-facing change.
