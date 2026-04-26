#!/usr/bin/env bash
# ============================================================================
# detect-env.sh — Detect environment constraints for AI agent missions
#
# PROBLEM:
#   AI agents waste time discovering environment quirks mid-mission:
#   - Git worktree vs. main repo (branch checkout restrictions)
#   - MCP filesystem server permissions (can't write to project)
#   - Available tooling (gh, node, python, etc.)
#
# USAGE:
#   ./scripts/detect-env.sh [--json]
#   Run at mission start. Outputs environment summary so the agent
#   can adapt its workflow from the beginning.
#
# OUTPUT (--json): Machine-readable JSON with:
#   - worktree: true/false + path info
#   - mcp_filesystem_allowed: list of dirs MCP can write to
#   - tools: availability of gh, node, python, etc.
#   - git_status: current branch, dirty state
#   - recommendations: actions for the agent to take
#
# EXAMPLE:
#   bash scripts/detect-env.sh --json
# ============================================================================

set -euo pipefail

OUTPUT_JSON=false
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for arg in "$@"; do
  case "$arg" in
    --json) OUTPUT_JSON=true ;;
  esac
done

# --- Git Detection ---
GIT_WORKTREE=false
GIT_WORKTREE_PATH=""
GIT_CURRENT_BRANCH="detached"
GIT_MAIN_WORKTREE=""
GIT_DIRTY=false

if git rev-parse --git-dir > /dev/null 2>&1; then
  GIT_DIR="$(git rev-parse --git-dir)"
  GIT_CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'detached')"
  if [[ -f "$GIT_DIR" ]]; then
    GIT_WORKTREE=true
    GIT_WORKTREE_PATH="$PROJECT_ROOT"
    GIT_MAIN_WORKTREE="$(dirname "$(dirname "$(cat "$GIT_DIR")")")"
  fi
  if ! git diff --quiet HEAD 2>/dev/null; then
    GIT_DIRTY=true
  fi
fi

# --- MCP Filesystem Detection ---
MCP_FS_WRITABLE=false
MCP_FS_ALLOWED=""
if [[ -n "${MCP_FILESYSTEM_ALLOWED_DIRS:-}" ]]; then
  MCP_FS_ALLOWED="$MCP_FILESYSTEM_ALLOWED_DIRS"
  for dir in $MCP_FILESYSTEM_ALLOWED_DIRS; do
    if [[ "$PROJECT_ROOT" == "$dir"* ]]; then
      MCP_FS_WRITABLE=true
    fi
  done
fi

# --- Tool Availability ---
TOOL_GH=false; TOOL_GIT=false; TOOL_NODE=false
TOOL_PYTHON3=false; TOOL_NPM=false; TOOL_CARGO=false
command -v gh > /dev/null 2>&1 && TOOL_GH=true
command -v git > /dev/null 2>&1 && TOOL_GIT=true
command -v node > /dev/null 2>&1 && TOOL_NODE=true
command -v python3 > /dev/null 2>&1 && TOOL_PYTHON3=true
command -v npm > /dev/null 2>&1 && TOOL_NPM=true
command -v cargo > /dev/null 2>&1 && TOOL_CARGO=true

# --- Build Recommendations ---
RECO_WORKTREE=false
RECO_MCP_FS=false

if [[ "$GIT_WORKTREE" == true ]]; then
  RECO_WORKTREE=true
fi

if [[ "$MCP_FS_WRITABLE" == false ]]; then
  RECO_MCP_FS=true
fi

# --- Output ---
if [[ "$OUTPUT_JSON" == true ]]; then
  cat << JSONEOF
{
  "project_root": "$PROJECT_ROOT",
  "git": {
    "worktree": $GIT_WORKTREE,
    "worktree_path": "${GIT_WORKTREE_PATH:-null}",
    "main_worktree": "${GIT_MAIN_WORKTREE:-null}",
    "current_branch": "${GIT_CURRENT_BRANCH}",
    "dirty": $GIT_DIRTY
  },
  "tools": {
    "gh": $TOOL_GH, "git": $TOOL_GIT, "node": $TOOL_NODE,
    "python3": $TOOL_PYTHON3, "npm": $TOOL_NPM, "cargo": $TOOL_CARGO
  },
  "mcp_filesystem": {
    "writable": $MCP_FS_WRITABLE,
    "allowed_dirs": "${MCP_FS_ALLOWED:-query via MCP list_allowed_directories tool}"
  },
  "recommendations": {
    "worktree": $RECO_WORKTREE,
    "mcp_fs_write": $RECO_MCP_FS
  }
}
JSONEOF
else
  echo "============================================"
  echo " Environment Detection"
  echo "============================================"
  echo " Project root:  $PROJECT_ROOT"
  echo ""
  echo "--- Git ---"
  echo " Worktree:      $GIT_WORKTREE"
  [[ -n "$GIT_MAIN_WORKTREE" ]] && echo " Main worktree: $GIT_MAIN_WORKTREE"
  echo " Current branch: $GIT_CURRENT_BRANCH"
  echo " Dirty:         $GIT_DIRTY"
  echo ""
  echo "--- MCP Filesystem ---"
  echo " Writable:      $MCP_FS_WRITABLE"
  [[ -n "$MCP_FS_ALLOWED" ]] && echo " Allowed dirs:  $MCP_FS_ALLOWED"
  echo ""
  echo "--- Tools ---"
  echo " gh:     $TOOL_GH"
  echo " git:    $TOOL_GIT"
  echo " node:   $TOOL_NODE"
  echo " python3: $TOOL_PYTHON3"
  echo " npm:    $TOOL_NPM"
  echo " cargo:  $TOOL_CARGO"
  echo ""
  echo "--- Recommendations ---"
  if [[ "$RECO_WORKTREE" == true ]]; then
    echo " [WORKTREE] This is a secondary worktree."
    echo "   - Do NOT use 'git checkout <branch>' if branch exists in main worktree"
    echo "   - Push to remote: git push origin HEAD:refs/heads/<branch-name>"
    echo "   - New branch from detached: git branch <name> && git push origin <name>"
  fi
  if [[ "$RECO_MCP_FS" == true ]]; then
    echo " [MCP_FS] Filesystem MCP cannot write to project root."
    echo "   - Use run_commands (shell) for file write/create operations"
    echo "   - MCP allowed dirs: query via list_allowed_directories tool"
  fi
  if [[ "$RECO_WORKTREE" == false && "$RECO_MCP_FS" == false ]]; then
    echo " (none - environment is standard)"
  fi
  echo "============================================"
fi
