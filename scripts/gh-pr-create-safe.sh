#!/usr/bin/env bash
# ============================================================================
# gh-pr-create-safe.sh — Safe PR creation avoiding shell escaping issues
#
# PROBLEM:
#   Using `gh pr create --body '...'` with Markdown backticks causes the
#   shell to interpret them as command substitution, corrupting the PR body.
#
# USAGE:
#   ./scripts/gh-pr-create-safe.sh [gh pr create arguments...]
#
#   Reads PR body from stdin or from a file using -F/--body-file argument.
#   Automatically writes body to a temp file so shell escaping is avoided.
#
# EXAMPLE:
#   ./scripts/gh-pr-create-safe.sh --base main --head my-branch \
#     --title "fix: something" << 'EOF'
#   ## Changes
#   - Fixed `chrome.alarms` undefined error
#   EOF
#
#   # Or with a file:
#   ./scripts/gh-pr-create-safe.sh --base main --head my-branch \
#     --title "fix: something" -F /path/to/body.md
#
# REQUIREMENTS:
#   - gh (GitHub CLI) installed and authenticated
# ============================================================================

set -euo pipefail

ARGS=()
BODY_FILE=""
READ_BODY_FROM_STDIN=false

# Parse arguments to detect -F / --body-file
while [[ $# -gt 0 ]]; do
  case "$1" in
    -F|--body-file)
      if [[ -n "$2" ]]; then
        BODY_FILE="$2"
        shift 2
      else
        echo "ERROR: -F/--body-file requires a file path" >&2
        exit 1
      fi
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

# If no body file provided and stdin is not a terminal, read from stdin
if [[ -z "$BODY_FILE" ]]; then
  if [[ ! -t 0 ]]; then
    TEMP_BODY=$(mktemp /tmp/pr-body-XXXXXX.md)
    trap 'rm -f "$TEMP_BODY"' EXIT
    cat > "$TEMP_BODY"
    BODY_FILE="$TEMP_BODY"
  fi
fi

# Build and execute the gh command
CMD=(gh pr create "${ARGS[@]}")

if [[ -n "$BODY_FILE" ]]; then
  CMD+=(-F "$BODY_FILE")
fi

echo "Running: ${CMD[*]}" >&2
exec "${CMD[@]}"
