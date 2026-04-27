# AI Reflection — 2026-04-26: Android Login/Sync/Keyboard Fixes

## Mission Summary

Three workstreams:
1. **Keyboard not opening on Android** — Fixed `KeyboardAvoidingView` behavior from `height` to `padding`
2. **Sync between Chrome Extension and Android** — Traced sync pipeline, identified sync key, confirmed production backend at `https://sahabnote.onrender.com`
3. **Simplified Android login flow** — Replaced settings-modal auth with dedicated login/register screen, hardcoded server URL, loading states, auto-token saving, auto-sync
4. **Documentation update** — Updated `.clinerules` and `README.md` with deployment info and client config
5. **Admin interface task** — Created detailed task description at `doc/tasks/admin-interface.md`

---

## 1. Discovery & Investigation Process

**What went well:**
- Read full backend, Chrome extension, and Android app code before making changes
- Queried SQLite database to confirm notes existed on server
- Used `curl` to verify sync pull endpoint worked with the sync key
- Separated keyboard and sync issues early

**What could be improved:**
- Missed production deployment info — `scripts/health_tray.py` and `scripts/health-widget.html` already contained the Render URL and should have been read earlier
- `.clinerules` was incomplete — missing production URLs, client config, and health scripts
- Didn't read `start_backend.sh` or `deploy_instructions.md` soon enough

**Recommendation:** Add a project onboarding checklist: read `.clinerules`, `README.md`, `scripts/`, config files, and deployment docs as the first step.

---

## 2. Automation & Documentation Opportunities

**Already exists:** Health monitor scripts (`health_tray.py`, `health-widget.html`) automatically check the production URL

**New documentation added:**
- Sync key for user "etters" in `.clinerules` and `README.md`
- Production backend URL (`https://sahabnote.onrender.com`) in both docs
- Client configuration guide explaining sync key sharing
- Health monitoring scripts section

**New automation ideas for future:**
1. **Health check startup script** — Bash script checking both production and local backend before starting work
2. **Database inspection utility** — Quick CLI to view users and notes without raw SQL
3. **Cross-client sync validator** — Script that creates a note via API and verifies it on pull

---

## 3. Stuck Points & Bottlenecks

### Major Issue: Writing App.js consumed ~40% of mission time

**Failure chain:**
1. `editor` tool has 6000-char limit — App.js was ~20KB
2. `insert_line` failed when line count didn't match expectations
3. Python heredocs broke on JSX syntax characters
4. Node.js inline scripts broke on backticks and template literals in shell
5. Base64 approach abandoned due to encoding complexity

**Solution found:** Write a `.js` script to `/tmp/` using quoted heredoc (`<< 'ENDSCRIPT'`), then execute it with `node /tmp/script.js`

**Root cause:** The `editor` tool's 6000-char limit is reasonable for edits but insufficient for full-file rewrites. Command-line escaping is fundamentally limited for JSX/React.

**Prevention:** For files >5000 chars, immediately use the "write script → run script" two-step pattern. Don't attempt inline commands.

### Secondary Issue: Branch confusion with worktree detached HEAD

PR #8 was already merged to main, but I was on detached HEAD. Had to stash, create branch from `origin/main`, pop stash.

**Fix:** Check `git log --oneline main -5` and `git branch -a` earlier.

---

## 4. Recurring Patterns & Tooling Gaps

### Missing tooling:
| Tool | Why It Would Help |
|------|-------------------|
| File write tool without char limits | Avoid shell escaping issues entirely |
| Database MCP for SQLite | Avoid ad-hoc Python one-liners |
| Template-aware editor for JSX | Current editor struggles with JSX special chars |

### Permission / Environment:
- Worktree symlinks to `/srv/dev/SahabNote/` for node_modules
- Writing to `/srv/dev/SahabNote/doc/tasks/` works directly
- Backend runs on port 8000 without sudo
- Node.js v24.14.1 available

### Workflow gaps:
1. No standardized database inspection script (had to craft ad-hoc each time)
2. No Expo/React Native build validation in this environment
3. No automated PR workflow script

---

## 5. Key Learnings

### For project maintainer:
1. Keep `.clinerules` updated with production URLs — AI agents look here first
2. Document all deployed service URLs in `.clinerules` and `DEPLOYMENT.md`
3. Health scripts are valuable — they contain live endpoints, read them early

### For AI agent:
1. Start with `.clinerules` + README + scripts/ as initial read set
2. For large file writes, use two-step script approach immediately
3. Check `git log` and `git branch` early to understand branch state
4. Use a reusable command template for database inspection
5. When a PR already exists for the branch, update it rather than creating a new one
