# Task: Worktree Documentation Sync Script

## Objective
Create a `scripts/sync-worktree.sh` script that mirrors documentation and key config files between a git worktree and the parent repository.

## Problem It Solves
When working in a git worktree (e.g., `/home/AyoubEtters/.cline/worktrees/<hash>/SahabNote/`):
- The `doc/` directory (including `doc/tasks/`) may be missing from the worktree
- File contents can diverge between worktree and parent repo (e.g., `deploy_instructions.md`)
- After updating files in the worktree, changes must be manually `cp`'d to the parent repo

This causes wasted time searching for files and risk of inconsistent documentation.

## Recommended Implementation

### Script Location: `scripts/sync-worktree.sh`

### What It Should Do

1. **Detect paths**: Determine if we're in a worktree vs the parent repo (check `.git` file vs `.git/` directory)
2. **Determine direction**: Sync from parent → worktree (setup) or worktree → parent (publish)

### Sync Operations (parent → worktree)
```bash
./scripts/sync-worktree.sh --setup
```
- Copy `doc/` directory from parent to worktree (if missing)
- Copy `backend/scripts/` from parent to worktree (if missing)
- Warn about any files that exist in both but differ

### Sync Operations (worktree → parent)
```bash
./scripts/sync-worktree.sh --publish
```
- Copy changed files from worktree back to parent repo
- Safelist of files to sync: `doc/`, `backend/deploy_instructions.md`, `scripts/README.md`, `.clinerules`
- Show a diff of what will be synced before applying

### Detection Logic
```bash
# Check if we're in a worktree
if [ -f ".git" ]; then
    WORKTREE_DIR=$(pwd)
    PARENT_DIR=$(dirname "$(realpath "$(cut -d' ' -f2 .git)")")
    echo "In worktree: $WORKTREE_DIR"
    echo "Parent repo: $PARENT_DIR"
else
    echo "In parent repo (or not a worktree)"
fi
```

## Documentation Updates Required
- Add to `scripts/README.md` — mention the script and its purpose
- Update `.clinerules` — reference the sync script in Worktree Notes section

## Dependencies
- Standard Unix utilities: `realpath`, `cut`, `diff`, `rsync` (or `cp`)
- No external packages needed
