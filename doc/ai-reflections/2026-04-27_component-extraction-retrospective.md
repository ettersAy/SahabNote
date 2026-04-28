# Reflection: Component Extraction & Code Cleanup Mission

**Date:** 2026-04-27
**Task:** [doc/tasks/component-extraction-and-cleanup.md](../tasks/component-extraction-and-cleanup.md)

## 1. Discovery & Investigation Effectiveness

**Strengths:**
- Read the full task doc first, then `App.js` (~693 lines) in full before planning — gave complete context.
- Checked `storage.js` and `sync.js` to understand the API surface before extracting components.
- Good pre-planning: listed all 10 files to create, with dependencies mapped out.

**Weaknesses:**
- Underestimated the complexity of splitting stateful logic from the monolithic file. The tight coupling between auth, sync, and editor state made hook extraction non-trivial.
- Should have verified the `editor` tool's constraint (6000 char limit on `old_text`) before starting. I hit this mid-task and had to switch strategies.

## 2. Stuck Points & Root Cause Analysis

### Stuck Point 1: `editor` tool `old_text` size limit

**What happened:** The `editor` tool rejected my large replacement blocks (>6000 chars for `old_text`). I tried partial replacements 3-4 times, each time creating an inconsistent intermediate state with old functions referencing variable names that no longer existed. The file was garbage for several edit cycles.

**Why:** The `editor` tool has a ~6000 character limit on `old_text` for performance reasons. I didn't account for this when planning how to rewrite App.js.

**How it could be prevented:**
1. **Plan for full-file overrides** when the new file is structurally different from the old one. Use `cat > file` for complete rewrites instead of incremental `editor` calls.
2. **Cache the old file content** before editing — if partial edits fail, you can reconstruct from scratch rather than trying to fix a broken intermediate state.

### Stuck Point 2: `edit_file` vs `editor` tool confusion

**What happened:** I first tried `edit_file` (which doesn't exist) then switched to `editor`. The error messages for "unknown tool" were clear, but I lost time switching mental models.

**Why:** Different MCP servers with similar-sounding tools. `editor` is from the `filesystem` MCP server; `edit_file` doesn't exist in any server.

**How it could be prevented:** Always check tool names in the system prompt before calling them.

### Stuck Point 3: syncClient ref ownership conflict

**What happened:** Both `useAuth` and `useSync` hooks needed the same `SyncClient` instance. Initially `useSync` created its own `useRef(new SyncClient())`, while `App.js` also created one for `useAuth`. This caused a duplicate client instance.

**Why:** Poor initial design — I didn't plan the shared dependency between hooks.

**How it could be prevented:** When designing hooks that share a resource (like a network client), always accept the resource as a parameter rather than creating it internally. Apply this pattern by default for singleton-like objects.

## 3. Workflow Automation Ideas

### Idea 1: File extraction script (MEDIUM)
A reusable script that takes a source file, a range of lines, and an output file — extracting a function or block into its own file while updating imports. Something like:

```bash
scripts/extract-module.sh android/src/App.js "LoadingScreen" android/src/components/LoadingScreen.js
```

This would:
- Copy the selected function/component
- Create the new file with proper imports scaffold
- Remove the extracted code from the source
- This would have saved ~30 minutes of manual extraction work.

### Idea 2: Codebase structure validation (LOW)
A script that verifies no file exceeds a line-count threshold, checks for unused imports via regex, and validates that all imported modules exist. Could be run before PR submission.

## 4. Recurring Patterns & Gaps

| Pattern/Gap | Impact |
|---|---|
| **Large file refactoring** always hits `editor` tool limits | Need a standard workflow: `cat` for full rewrites, `git diff` for review |
| **Shared dependencies** between hooks not planned upfront | Design hook interfaces before implementing; use dependency injection pattern |
| **No ESLint/Prettier** in project | Would catch unused imports and syntax issues early; reduce PR noise |
| **No directory structure documentation** | `android/src/` layout isn't documented anywhere except by reading code |

## 5. Improvements Implemented This Task

- Extracted `useAuth(syncClientRef, setNotes)` to accept shared dependencies — avoids singleton conflicts.
- Extracted `useSync(syncClientRef)` to use the same ref — both hooks now share the same `SyncClient` instance.
- Moved `COLORS` and `DEFAULT_SERVER_URL` into `constants/theme.js` — single source of truth.

## 6. Task File Suggestions

See companion task file:
- [doc/tasks/codebase-validate-script.md](../tasks/codebase-validate-script.md)
