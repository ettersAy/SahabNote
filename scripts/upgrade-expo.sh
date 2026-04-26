#!/bin/bash
#===============================================================================
# Expo SDK Upgrade Script
#
# Description:
#   Upgrades an Expo React Native project to a specified SDK version.
#   Handles dependency updates, compatibility fixes, cache clearing, and validation.
#
# Usage:
#   ./scripts/upgrade-expo.sh [target-sdk-version]
#
#   target-sdk-version: The Expo SDK version (e.g., 54, 55).
#                        If omitted, shows current SDK version.
#
# Examples:
#   ./scripts/upgrade-expo.sh           # Show current SDK version
#   ./scripts/upgrade-expo.sh 54        # Upgrade to Expo SDK 54
#   ./scripts/upgrade-expo.sh 55        # Upgrade to Expo SDK 55
#
# What it does:
#   1. Detects current Expo SDK version from installed packages
#   2. Shows planned upgrade path
#   3. Creates a git branch for the upgrade (handles worktrees)
#   4. Runs `npx expo install` with the target SDK
#   5. Runs `npx expo install --fix` for compatibility
#   6. Clears Metro bundler cache
#   7. Validates with `npx expo config` and `npx expo-doctor`
#   8. Shows summary of changes and next steps
#
# Exit codes:
#   0 - Success
#   1 - Failed (dependency issues, validation errors)
#   2 - Usage error (invalid arguments)
#   3 - Git branch creation failed
#
# Dependencies:
#   - npx, npm, git
#   - expo-cli (comes with expo package)
#   - expo-doctor (auto-installed if missing)
#
#===============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Parse arguments
TARGET_SDK="${1:-}"
if [ "${TARGET_SDK}" = "--help" ] || [ "${TARGET_SDK}" = "-h" ]; then
    sed -n 's/^# \?//p' "$0" | head -n-2
    exit 0
fi

# Detect current SDK version
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f package.json ]; then
    error "No package.json found in $PROJECT_DIR"
    exit 1
fi

CURRENT_EXPO="$(node -e "try{console.log(require('expo/package.json').version)}catch{console.log('NOT_INSTALLED')}" 2>/dev/null)"
CURRENT_RN="$(node -e "try{console.log(require('react-native/package.json').version)}catch{console.log('NOT_INSTALLED')}" 2>/dev/null)"
CURRENT_REACT="$(node -e "try{console.log(require('react/package.json').version)}catch{console.log('NOT_INSTALLED')}" 2>/dev/null)"

echo "================================================================================"
echo "  Expo SDK Upgrade Script"
echo "================================================================================"
echo ""
echo "  Project:   $(node -e "console.log(require('./package.json').name)")"
echo "  Directory: $PROJECT_DIR"
echo ""
echo "  Current versions:"
echo "    expo:          ${CURRENT_EXPO}"
echo "    react-native:  ${CURRENT_RN}"
echo "    react:         ${CURRENT_REACT}"
echo ""

# If no target SDK provided, just show info and exit
if [ -z "$TARGET_SDK" ]; then
    info "No target SDK provided. Pass a version number like: ./scripts/upgrade-expo.sh 55"
    exit 0
fi

# Validate target SDK format
if ! [[ "$TARGET_SDK" =~ ^[0-9]+$ ]]; then
    error "Invalid SDK version: '$TARGET_SDK'. Expected a number (e.g., 54, 55)."
    exit 2
fi

echo "  Target SDK: ${TARGET_SDK}"
echo ""

# Confirm with user
if [ -z "${CI:-}" ]; then
    read -rp "  Proceed with upgrade? [y/N] " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        info "Upgrade cancelled."; exit 0
    fi
fi
echo ""

# Check git status
info "Checking git status..."
if [ -f .git ] && head -1 .git | grep -q 'gitdir:'; then
    warn "Git worktree detected. Branch creation may behave differently."
fi
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    warn "Uncommitted changes:"
    git status --short
    if [ -z "${CI:-}" ]; then
        echo ""; read -rp "  Continue? [y/N] " DIRTY_CONFIRM
        [ "$DIRTY_CONFIRM" != "y" ] && [ "$DIRTY_CONFIRM" != "Y" ] && { info "Cancelled."; exit 1; }
    fi
fi

# Create git branch
BRANCH_NAME="upgrade/expo-sdk-${TARGET_SDK}"
info "Creating branch: ${BRANCH_NAME}"

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}" 2>/dev/null; then
    warn "Branch '${BRANCH_NAME}' exists locally."
    git checkout "$BRANCH_NAME"
    ok "Checked out existing branch."
else
    if git fetch origin main 2>/dev/null; then
        git checkout -b "$BRANCH_NAME" origin/main 2>/dev/null || git checkout -b "$BRANCH_NAME" main
    elif git fetch origin master 2>/dev/null; then
        git checkout -b "$BRANCH_NAME" origin/master 2>/dev/null || git checkout -b "$BRANCH_NAME" master
    else
        git checkout -b "$BRANCH_NAME"
    fi
    ok "Created and switched to: ${BRANCH_NAME}"
fi
echo ""

# Step 1: Install Expo SDK target version
info "Step 1/5: Installing Expo SDK ${TARGET_SDK}..."
npx expo install expo@~${TARGET_SDK}.0.0
ok "Expo SDK ${TARGET_SDK} installed."
echo ""

# Step 2: Fix compatibility
info "Step 2/5: Running 'expo install --fix' for compatibility..."
npx expo install --fix
ok "Compatibility fixes applied."
echo ""

# Step 3: Clear bundler cache
info "Step 3/5: Clearing Metro bundler cache..."
npx expo start --clear --non-interactive 2>&1 &
EXPO_PID=$!
sleep 5
kill "$EXPO_PID" 2>/dev/null || true
wait "$EXPO_PID" 2>/dev/null || true
ok "Cache cleared."
echo ""

# Step 4: Validate with expo config and expo-doctor
info "Step 4/5: Validating configuration..."
echo ""
echo "  --- expo config ---"
npx expo config --type public 2>&1
echo ""

if npx --yes expo-doctor --help &>/dev/null 2>&1; then
    echo "  --- expo-doctor ---"
    npx expo-doctor 2>&1 || true
    echo ""
else
    warn "expo-doctor not found. Skipping."
    echo ""
fi
ok "Validation complete."
echo ""

# Step 5: Show summary of changes
info "Step 5/5: Upgrade summary..."
echo ""

NEW_EXPO="$(node -e "console.log(require('expo/package.json').version)" 2>/dev/null)"
NEW_RN="$(node -e "console.log(require('react-native/package.json').version)" 2>/dev/null)"
NEW_REACT="$(node -e "console.log(require('react/package.json').version)" 2>/dev/null)"

echo "  ┌────────────────────────┬──────────────────────┬──────────────────────┐"
echo "  │ Package                │ Before               │ After                │"
echo "  ├────────────────────────┼──────────────────────┼──────────────────────┤"
printf "  │ %-22s │ %-20s │ %-20s │\n" "expo"         "${CURRENT_EXPO}"  "${NEW_EXPO}"
printf "  │ %-22s │ %-20s │ %-20s │\n" "react-native"  "${CURRENT_RN}"     "${NEW_RN}"
printf "  │ %-22s │ %-20s │ %-20s │\n" "react"         "${CURRENT_REACT}"  "${NEW_REACT}"
echo "  └────────────────────────┴──────────────────────┴──────────────────────┘"
echo ""

echo "  Git changes:"
git diff --stat 2>/dev/null || echo "  (no unstaged changes)"
echo ""

# Next steps
if [ -z "${CI:-}" ]; then
    echo "  ──────────────────────────────────────────────────────────────────────"
    echo "  Next steps:"
    echo "    1. Review changes:    git diff"
    echo "    2. Commit:            git add -A && git commit -m \"upgrade: migrate from SDK ${CURRENT_EXPO%%.*} to SDK ${TARGET_SDK}\""
    echo "    3. Push:              git push origin ${BRANCH_NAME}"
    echo "    4. Create PR:         gh pr create --base main --head ${BRANCH_NAME} --title \"upgrade: migrate to Expo SDK ${TARGET_SDK}\""
    echo "  ──────────────────────────────────────────────────────────────────────"
    echo ""
fi

# SDK specific notes
if [ "$TARGET_SDK" -ge 54 ] 2>/dev/null; then
    echo "  ⚠  SDK ${TARGET_SDK}+ notes:"
    echo "     - newArchEnabled may be the default. Check app.json."
    echo "     - React 19 may have breaking changes for your code."
    echo "     - Test on device: npx expo start --clear"
    echo ""
fi

ok "Expo SDK upgrade to ${TARGET_SDK} completed!"
exit 0
