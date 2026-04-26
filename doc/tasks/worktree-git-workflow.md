# Task: Document Worktree Git Workflow in .clinerules

## Objective
Add a clear, step-by-step guide to `.clinerules` for working with git in this project's worktree setup, so future AI sessions don't waste time discovering the workflow by trial and error.

## Problem It Solves
This project uses git worktrees. The AI works in `/home/AyoubEtters/.cline/worktrees/<hash>/SahabNote/` while the parent repo is at `/srv/dev/SahabNote/`. This creates several constraints:

- **Cannot checkout `main`** — it's already checked out at the parent repo. `git checkout main` fails with "already checked out"
- **Cannot checkout existing branches** — if a branch is checked out at the parent, it's locked
- **Detached HEAD confusion** — after commits, `git branch -m <name>` doesn't work from detached HEAD
- **Push requires full refspec** — `git push origin branchname` fails from detached HEAD. Must use `git push origin HEAD:refs/heads/branchname`

These constraints caused multiple wasted attempts and confusion during this mission.

## Recommended Implementation Details

### Where to Add
In `.clinerules`, under a new section "## Git Worktree Workflow" (before the existing sections).

### Content to Include

```markdown
## Git Worktree Workflow

This project uses git worktrees. You work in:
  /home/AyoubEtters/.cline/worktrees/<hash>/SahabNote/
Parent repo:
  /srv/dev/SahabNote/

### Constraints
- You CANNOT checkout `main` (locked by parent repo)
- You CANNOT checkout a branch that's checked out in the parent
- After commits, you are on detached HEAD

### Step-by-Step Workflow

1. **Start a new feature:**
   ```bash
   git fetch origin main
   # Create a new branch from main (--force because branch might already exist remotely)
   git branch -f my-branch-name origin/main
   git checkout my-branch-name
   ```
   
   Note: If the branch name is already checked out at parent, use a different name.

2. **Make changes and commit:**
   ```bash
   git add -A
   git commit -m "description of changes"
   ```

3. **Push to remote (from detached HEAD or named branch):**
   ```bash
   # From a named branch:
   git push -u origin my-branch-name
   
   # From detached HEAD (if above fails):
   git push origin HEAD:refs/heads/my-branch-name
   ```

4. **Create a Pull Request:**
   Use the GitHub MCP server tools. Do NOT use `gh` CLI (may not be authenticated).
   ```bash
   # Instead, use create_pull_request tool with:
   # owner: ettersAy
   # repo: SahabNote
   # head: my-branch-name
   # base: main
   ```

5. **Update an existing PR with new commits:**
   ```bash
   git push origin HEAD:refs/heads/my-branch-name --force
   ```

### Common Pitfalls
- `git push origin branchname` without full refspec fails from detached HEAD
- `git branch -m newname` does NOT work from detached HEAD — use `git branch newname <commit-hash>` instead
- After pushing with `--force`, the PR updates automatically
```

## Expected Benefits
- Eliminates ~30 minutes of trial-and-error per mission on git commands
- Avoids the "can't checkout main" panic
- Clear workflow from start to PR creation
- Reduces the chance of pushing to wrong branches

## Documentation Updates Required
- Only `.clinerules` needs updating
- The content above is ready to paste in

## Dependencies
- None (pure documentation)
