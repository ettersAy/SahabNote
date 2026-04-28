#!/usr/bin/env bash
#
# project-scanner.sh — Print project structure summary for quick orientation
# Usage: bash scripts/scanner.sh [--cached]
#
# Options:
#   --cached    Write output to .project-snapshot and skip re-scan on next run
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo "  Project Scanner — $(basename "$ROOT")"
echo "=========================================="
echo ""

# --- Entry point ---
if [ -f "package.json" ]; then
  MAIN=$(node -e "console.log(require('./package.json').main || 'index.js')" 2>/dev/null || echo "index.js")
  echo " Entry point: $MAIN"
  NAME=$(node -e "console.log(require('./package.json').name || 'unnamed')" 2>/dev/null || echo "unnamed")
  echo " Name:        $NAME"
fi
echo ""

# --- Key directories ---
echo " Directories:"
for d in android chrome-extension backend web desktop assets doc scripts; do
  if [ -d "$d" ]; then
    FILE_COUNT=$(find "$d" -type f 2>/dev/null | wc -l)
    printf "   %-20s %d files\n" "$d/" "$FILE_COUNT"
  fi
done
echo ""

# --- Core dependencies ---
echo " Key dependencies:"
for pkg in expo react-native react @react-native-async-storage/async-storage expo-clipboard; do
  FILE="$ROOT/node_modules/$pkg/package.json"
  if [ -f "$FILE" ]; then
    VER=$(node -e "console.log(require('$FILE').version)" 2>/dev/null || echo "?")
    printf "   %-35s %s\n" "$pkg" "$VER"
  else
    printf "   %-35s %s\n" "$pkg" "(not installed — run npm install)"
  fi
done
echo ""

# --- Git info ---
echo " Git branch:"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(detached)")
echo "   $BRANCH"
COMMIT=$(git log --oneline -1 2>/dev/null || echo "")
if [ -n "$COMMIT" ]; then
  echo "   $COMMIT"
fi
echo ""

# --- NPM scripts ---
echo " Available npm scripts:"
node -e "
const s = require('./package.json').scripts || {};
for (const [k, v] of Object.entries(s)) {
  console.log('   %s: %s', k.padEnd(20), v);
}
" 2>/dev/null || echo "   (could not read package.json)"
echo ""

echo "=========================================="

# --- Cache for next run ---
if [ "${1:-}" = "--cached" ]; then
  echo " Wrote .project-snapshot"
  "$0" > .project-snapshot
fi
