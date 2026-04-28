# Task: Workflow and Tooling Improvements

**Context:** During the Android two-screen navigation task, several tooling gaps and workflow friction points were identified. These are cross-cutting improvements that would benefit future work across the entire project.

## Goals

### 1. Search exclusion for `.aider.*` files

The `search_codebase` tool includes `.aider.chat.history.md` (600K+) in results, polluting output with chat history matches.

**Proposal:**
- Add a mechanism to exclude `.aider.*`, `node_modules/`, `.expo/` patterns from codebase searches
- OR: add a `excludePattern` parameter to the search tool
- OR: create an alias script: `grep --exclude='.aider.*'`

### 2. Large file writing capability

The `editor` tool has a ~6K character limit for `old_text`/`new_text`, making full-file rewrites require 8-10 separate edit calls.

**Proposal:**
- Implement an `overwrite_file` or `write_file` tool that replaces the entire file content atomically
- OR: implement a patch/diff-based editor that accepts unified diffs instead of old_text matching
- OR: document the fallback process (multiple surgical `editor` calls) as a reusable workflow step

### 3. JSX/React Native syntax validation

No way to verify RN file syntax without running the Metro bundler or an emulator.

**Proposal:**
- Add a `check-syntax` npm script to `package.json`:
  ```json
  "check:js": "npx -y @babel/core --no-bundle --presets=@react-native/babel-preset --check ./android/src/App.js"
  ```
- OR: use `npx tsc --noEmit --jsx react-native` if TypeScript types are installed
- OR: document the `node -e "require(...)"` check (catches syntax errors, fails on JSX — but confirms non-JSX files are valid)

### 4. Project structure scanner script

Each new task starts with `ls`, `find`, and `package.json` reading. This is repetitive.

**Proposal:**
- Create a `scripts/scanner.sh` that prints:
  ```
  Project: SahabNote
  Entry: index.js → ./android/src/App.js
  Dirs: android/ chrome-extension/ backend/ web/ desktop/ assets/ doc/
  Key deps: expo ~54.0.33, react-native 0.81.5, async-storage 2.2.0
  ```
- Run once at the start of each task to orient quickly
- Output could be saved to a `.project-snapshot` cache file

### 5. Commit message template

Commit messages varied in consistency. A commit template ensures structured messages.

**Proposal:**
- Create `.gitmessage` with:
  ```
  <type>: <short summary (max 72 chars)>

  <detailed body explaining what and why, wrapped at 72 chars>

  Fixes: #<issue>
  ```
- Run: `git config commit.template .gitmessage`

## Priority: High

These improvements directly reduce task completion time and error rates. High-value, low-effort.
