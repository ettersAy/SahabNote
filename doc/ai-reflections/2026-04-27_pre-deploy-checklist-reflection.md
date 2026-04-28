# Mission Reflection – 2026-04-27 — Pre-Deploy Checklist

## Discovery & Investigation Process

### Effectiveness
- **Good**: Parallel file searches quickly located the task document in the parent repo when it wasn't in the worktree. Using multiple MCP tools simultaneously (search_codebase, search_files, directory_tree) gave a broad picture fast.
- **Good**: Reading the CLINE.md, .clinerules, AI_INSTRUCTIONS.md, and doc/draft.md upfront provided essential project context before diving into code.
- **Good**: Reading the full backend (routes, models, auth, tests) before writing the script ensured the validation checks matched the actual codebase.
- **Could improve**: I read many files individually when a project index/manifest could have told me the structure at a glance.

### Improvement
- A lightweight project manifest file (`.project-index.json` or a section in `CLINE.md`) listing key file locations, their purpose, and their relationships would reduce the "scatter-read" pattern in future missions.

## Automation & Reuse Opportunities

### 1. Worktree Sync Automation
The worktree and parent repo had **different versions** of `deploy_instructions.md` (the worktree had an older, minimal version while the parent repo had the full version with admin panel docs). I had to:
- Manually detect which version was in the worktree
- Update both locations separately
- Copy the new `backend/scripts/pre_deploy_check.py` to the parent repo manually via `cp`

**Automation idea**: A `scripts/sync-worktree.sh` script that mirrors key documentation and script files from worktree → parent repo (or vice versa) after changes are made.

### 2. Task Doc Sync
The `doc/tasks/` directory existed in the parent repo (`/srv/dev/SahabNote/doc/tasks/`) but was **missing** from the worktree (`/home/AyoubEtters/.cline/worktrees/80f91/SahabNote/doc/`). The `@/doc/tasks/pre-deploy-checklist.md` reference initially failed because the worktree didn't have the tasks directory.

**Automation idea**: A setup step for worktrees that copies the `doc/` directory structure from the parent repo so task documents are always accessible.

### 3. Pre-Deploy Check in CI
The `pre_deploy_check.py` script has a `--json` flag designed for CI integration, but no GitHub Actions workflow exists yet to run it automatically on PRs.

**Automation idea**: A GitHub Actions workflow that runs `python3 backend/scripts/pre_deploy_check.py --json` on every PR targeting deployment branches.

## Stuck Points & Repeated Steps

### Issue 1: Editor tool failed on first attempt
**What happened**: When editing `deploy_instructions.md` in the worktree, the editor tool said "text not found". This was because I copied the exact text from the **parent repo's version** (the full version with admin panel docs) but the worktree had an **older, shorter version** without that content.

**Root cause**: I had read the parent repo's version first (more complete), and my brain cached that as "the content." I didn't verify the worktree had the same content before attempting the edit.

**How to prevent**: Always re-read the target file from the exact path being edited immediately before editing. Never assume file contents are the same across worktree and parent repo — they can diverge.

### Issue 2: Two locations to update
**What happened**: After finishing the worktree changes, I had to manually `cp` the script to the parent repo and separately edit the parent repo's `deploy_instructions.md`, `scripts/README.md`, and `.clinerules`.

**Root cause**: The project uses git worktrees, so changes in the worktree don't automatically propagate to the parent repo. The parent repo is the "canonical" source.

**How to prevent**: Either:
1. Always work directly in the parent repo (not a worktree) for documentation-heavy tasks
2. Or create a sync script that propagates changes (see automation suggestion above)

### Issue 3: File reference `@/doc/tasks/...` didn't resolve
**What happened**: The task referenced `@/doc/tasks/pre-deploy-checklist.md` which didn't exist in the worktree. I spent extra search cycles finding it in the parent repo.

**Root cause**: The worktree was missing the `doc/tasks/` directory entirely. The parent repo had it but the worktree didn't.

**How to prevent**: The setup instructions in `.clinerules` or a worktree creation script should ensure `doc/` directory structure is replicated from the parent repo.

## Recurring Patterns & Gaps

### Worktree Divergence
- **Pattern**: Files in the worktree can be older/less complete than the parent repo. This caused confusion and extra work.
- **Gap**: No documented process for syncing doc files between worktree and parent repo.

### Missing Project Index
- **Pattern**: Each mission starts by reading many files to understand the project structure.
- **Gap**: No single file that summarizes which files exist, their purpose, and their relationships.

### Pre-Deploy Script Dependencies
- **Pattern**: The `pre_deploy_check.py` script needs `pytest`, `uvicorn`, and backend dependencies to run fully.
- **Gap**: The script assumes these are installed. A `requirements-dev.txt` or documentation about dev dependencies would help.

### Disconnected Documentation
- **Pattern**: The parent repo has richer documentation (admin panel docs, full deploy instructions) that isn't available in worktrees.
- **Gap**: Documentation isn't synced when worktrees are created.

## Actionable Improvements for Future Missions

### Simple improvements (implement now):
1. **Add a `.gitignore` entry for `backend/data/`** if not already present, to prevent committing the SQLite DB
2. **Add a note in `.clinerules` about worktree doc syncing**: "When working in a worktree, check parent repo's `doc/` directory for task files if they're missing locally"

### Task-separate improvements (create `doc/tasks/` files):
1. **`doc/tasks/worktree-sync-setup.md`** — Create a script that syncs `doc/` and key config files from parent repo to worktree on creation
2. **`doc/tasks/project-manifest-file.md`** — Create a `.project-index.json` manifest file listing all key source files, their purpose, and dependencies
3. **`doc/tasks/github-actions-ci.md`** — Add a GitHub Actions workflow for running `pre_deploy_check.py` on PRs
4. **`doc/tasks/dev-requirements-file.md`** — Create a `backend/requirements-dev.txt` with testing/development dependencies

## Summary of Key Learnings

| Lesson | Action |
|--------|--------|
| Worktree and parent repo can diverge | Always verify file content at the exact path before editing |
| Task docs may live in parent repo only | Check parent repo's `doc/tasks/` if `@/doc/tasks/` reference fails |
| Manual file sync between worktree and parent repo is error-prone | Create a sync script for future use |
| Reading many files upfront is slow | Create a project manifest to speed up discovery |
| Pre-deploy check works well but needs CI integration | Create a GitHub Actions workflow task |
