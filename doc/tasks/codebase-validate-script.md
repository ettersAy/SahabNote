# Task: Codebase Validation Script

## Context

During the component extraction mission, I encountered several issues that could have been caught earlier with automated checks:
- Files exceeding line-count targets
- Unused imports left behind after refactoring
- Broken references between files after partial edits

A reusable validation script would catch these issues early and reduce PR review noise.

## Goals

### 1. File size checker
Verify no file exceeds configurable line count thresholds:
```bash
scripts/validate-codebase.sh
# Output: "android/src/App.js: 693 lines (max 100) ✗"
```

### 2. Import validation
Check that all local imports resolve to existing files:
- Scan all `.js` files under `android/src/`
- For each `import ... from './relative/path'`, verify the target file exists
- Report broken imports

### 3. Unused import detection (basic)
- Track imported names across files
- Flag names that are imported but never referenced in the file body (excluding re-exports)

### 4. Integration with existing scripts
- Add to `npm run validate` in `package.json`
- Should exit non-zero on any failure

## Acceptance Criteria

- [ ] Script runs from project root
- [ ] Detects files exceeding line limits with clear output
- [ ] Detects broken local imports
- [ ] Reports clear success/failure with file paths and line numbers
- [ ] Integrates into `npm run validate`
- [ ] Non-zero exit code on failures, zero on clean
- [ ] How to use documentation md file
- [ ] update .clinerules to add a small note about the existence of this tool

## Priority: Low

Nice-to-have quality tool, not blocking any current work.